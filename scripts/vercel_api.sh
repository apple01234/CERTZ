#!/bin/bash
# vercel_api.sh — Vercel REST API 관리 헬퍼 (토큰 기반, CLI 로그인 불필요)
# 토큰: .secrets/vercel_token (git 제외 — .gitignore L116)
# ※ 이 토큰은 스코프드 토큰: /v2/user 해석 불가 → vercel CLI(whoami/deploy)는 사용 불가,
#   반드시 REST API + teamId 경유로만 동작함.
#
# 사용법:
#   scripts/vercel_api.sh status            # 프로젝트·최신배포·별칭·라이브 버전 종합
#   scripts/vercel_api.sh deployments [N]   # 최근 배포 N개 (기본 5)
#   scripts/vercel_api.sh redeploy [ref]    # 프로덕션 재배포 트리거 (기본 main, git 소스)
#   scripts/vercel_api.sh wait <deployId>   # 배포 완료까지 폴링
#   scripts/vercel_api.sh alias             # 별칭 → 배포 매핑
#   scripts/vercel_api.sh env               # 프로젝트 환경변수 목록 (값 포함)
#   scripts/vercel_api.sh envset <KEY> <VALUE>  # env 변경 + 프로덕션 재배포 (서버 본체 전환)
#   scripts/vercel_api.sh live              # sertz.vercel.app /api/version

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="$(cat "$ROOT/.secrets/vercel_token")"
TEAM="team_tU80jP4GxpzCqs69YnAYe0jl"          # 202630719-4818s
PROJECT_ID="prj_aV9S7OMQ2Qq6TFTT7HCAlfvIADG5" # sertz
PROJECT_NAME="sertz"
GIT_ORG="apple01234"
GIT_REPO="CERTZ"
API="https://api.vercel.com"

api() { # api <method> <path> [json-body]
  local m="$1" p="$2" b="${3:-}"
  if [ -n "$b" ]; then
    curl -s -m 30 -X "$m" "$API$p" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$b"
  else
    curl -s -m 30 "$API$p" -H "Authorization: Bearer $TOKEN"
  fi
}

cmd="${1:-status}"
case "$cmd" in
  status)
    echo "== 프로젝트 =="
    api GET "/v9/projects/$PROJECT_ID?teamId=$TEAM" | python3 -c "import json,sys;d=json.load(sys.stdin);print('name:',d['name'],'| framework:',d.get('framework'),'| updated:',d.get('updatedAt'))"
    echo "== 최신 프로덕션 배포 =="
    api GET "/v6/deployments?limit=3&teamId=$TEAM&projectId=$PROJECT_ID&target=production" | python3 -c "
import json,sys,datetime
d=json.load(sys.stdin)
for x in d.get('deployments',[]):
    ts=datetime.datetime.fromtimestamp(x['createdAt']/1000).strftime('%Y-%m-%d %H:%M')
    print('-', x['uid'][:20], '|', ts, '|', x.get('state'), '|', (x.get('meta') or {}).get('githubCommitMessage','')[:60])
"
    echo "== 별칭 =="
    api GET "/v4/aliases?teamId=$TEAM&projectId=$PROJECT_ID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('aliases',[]):
    print('-', a.get('alias'), '->', (a.get('deployment') or {}).get('uid','')[:20])
"
    echo "== 라이브 버전 =="
    curl -s -m 10 https://sertz.vercel.app/api/version | python3 -c "import json,sys;d=json.load(sys.stdin);print('latest:',d.get('latest'),'| code:',d.get('code'))" || echo "(조회 실패)"
    ;;
  deployments)
    N="${2:-5}"
    api GET "/v6/deployments?limit=$N&teamId=$TEAM&projectId=$PROJECT_ID" | python3 -c "
import json,sys,datetime
d=json.load(sys.stdin)
for x in d.get('deployments',[]):
    ts=datetime.datetime.fromtimestamp(x['createdAt']/1000).strftime('%m-%d %H:%M')
    print('-', x['uid'], '|', ts, '|', x.get('state'), '| target:', x.get('target'), '|', (x.get('meta') or {}).get('githubCommitMessage','')[:50])
"
    ;;
  redeploy)
    REF="${2:-main}"
    REPO_ID=$(curl -s -m 8 https://api.github.com/repos/$GIT_ORG/$GIT_REPO | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
    echo "→ $GIT_ORG/$GIT_REPO@$REF 재배포 트리거 (repoId=$REPO_ID)..."
    api POST "/v13/deployments?teamId=$TEAM&skipAutoDetectionConfirmation=1" \
      "{\"name\":\"$PROJECT_NAME\",\"gitSource\":{\"type\":\"github\",\"org\":\"$GIT_ORG\",\"repoId\":$REPO_ID,\"ref\":\"$REF\",\"projectId\":\"$PROJECT_ID\"},\"target\":\"production\",\"meta\":{}}" \
      > "$ROOT/.secrets/_last_redeploy.json"
    python3 -c "
import json
d=json.load(open('$ROOT/.secrets/_last_redeploy.json'))
if d.get('id'):
    print('DEPLOY CREATED:', d['id'], '| state:', d.get('readyState') or d.get('state'))
    print('→ 완료 대기: scripts/vercel_api.sh wait', d['id'])
else:
    print('ERROR:', d.get('error', d)); exit 1
"
    ;;
  wait)
    DID="$2"
    for i in $(seq 1 40); do
      sleep 12
      ST=$(api GET "/v13/deployments/$DID?teamId=$TEAM" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('readyState'),'|aliasAssigned:',d.get('aliasAssigned'))")
      echo "[$i] $ST"
      case "$ST" in READY*|ERROR*|CANCELED*) break;; esac
    done
    case "$ST" in READY*) echo "✓ 배포 완료 — 별칭 재할당됨";; *) echo "✗ 배포 실패/정체 — deployments 명령으로 확인"; exit 1;; esac
    ;;
  alias)
    api GET "/v4/aliases?teamId=$TEAM&projectId=$PROJECT_ID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('aliases',[]):
    print('-', a.get('alias'), '->', (a.get('deployment') or {}).get('uid','')[:24])
"
    ;;
  env)
    api GET "/v9/projects/$PROJECT_ID/env?teamId=$TEAM" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('envs',[]):
    v=e.get('value','(encrypted)')
    print('-', e['key'], '| type:', e.get('type'), '| target:', e.get('target'), '| value:', str(v)[:60])
"
    ;;
  envset) # envset <KEY> <VALUE> — 값 변경 + 프로덕션 재배포까지 한 번에 (서버 본체 전환 절차)
    KEY="$2"; VAL="$3"
    echo "→ $KEY = $VAL 업서트..."
    api POST "/v10/projects/$PROJECT_ID/env?teamId=$TEAM&upsert=true" \
      "[{\"key\":\"$KEY\",\"value\":\"$VAL\",\"type\":\"plain\",\"target\":[\"production\",\"preview\"]}]" \
      | python3 -c "import json,sys;d=json.load(sys.stdin);print('created:',len(d.get('created',[])),'| failed:',len(d.get('failed',[])))"
    echo "→ 프로덕션 재배포 트리거 (env는 다음 빌드에 반영)..."
    "$0" redeploy main
    ;;
  live)
    curl -s -m 10 https://sertz.vercel.app/api/version
    echo
    ;;
  *)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
