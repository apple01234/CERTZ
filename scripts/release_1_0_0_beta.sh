#!/usr/bin/env bash
# release_1_0_0_beta.sh — GitHub Release v1.0.0-beta 생성 + APK·AAB 업로드
# (curl --data-binary — undici 100MB+ 불안정 회피, release_1_4_28.sh 패턴 계승)
set -uo pipefail
GH=$(cat /home/z/my-project/.secrets/github_token)
API="https://api.github.com/repos/apple01234/CERTZ"
APK=/home/z/my-project/download/SERTZ-v1.0.0-beta.apk
AAB=/home/z/my-project/download/SERTZ-v1.0.0-beta.aab

BODY=$(cat <<'EOF'
## SERTZ v1.0.0-beta (vc121) — 정식 출시 베타

버전 체계를 **v1.0.0-beta**로 전환한 정식 출시(베타) 빌드입니다. Google Play(AAB) 동시 준비.

### 포함 (v1.4.28까지 전체)
- **채팅·파티 부활** — Vercel 서버리스 릴레이 폴링 (실제 멀티 채팅·파티 동작)
- **채팅 가림 픽스** — NPC 대화창이 열려 있어도 채팅 입력·전송 가능 (z-40)
- **세로 좁은 화면 물약 버튼** — 공격 버튼 바로 왼쪽(83px) 재배치
- **자동전투 개선** — 포위 시 선제 물약·HP 안전망 40%·MP 회복선 35%
- 그 외 v1.0.x~v1.4.x 전 기능 (유니온·몬스터 파크·원소 반응·세트 효과·컬렉션·정예·멀티킬 등)

### 설치
- 기존 버전 덮어설치 가능 (동일 서명 키 — 세이브 그대로 유지)
- Play Store 출시용 AAB: SERTZ-v1.0.0-beta.aab
EOF
)

echo "[1] 릴리스 생성 (tag: v1.0.0-beta)"
RID=$(curl -s -X POST "$API/releases" -H "Authorization: Bearer $GH" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name':'v1.0.0-beta','target_commitish':'main','name':'SERTZ v1.0.0-beta — 정식 출시 베타','body':sys.stdin.read(),'draft':False,'prerelease':True}))" <<< "$BODY")" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id') or '')
import sys as s
if not d.get('id'): print(d.get('message','?'), file=s.stderr)")
echo "릴리스 ID: $RID"
[ -z "$RID" ] && { echo "릴리스 생성 실패"; exit 1; }

echo "[2] APK 업로드 (135MB — curl --data-binary)"
curl -s -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=SERTZ-v1.0.0-beta.apk" \
  -H "Authorization: Bearer $GH" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" | python3 -c "import json,sys;d=json.load(sys.stdin);print('APK:', d.get('state'), d.get('size'), d.get('name') or d.get('message'))"

echo "[3] AAB 업로드 (134MB — curl --data-binary)"
curl -s -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=SERTZ-v1.0.0-beta.aab" \
  -H "Authorization: Bearer $GH" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" | python3 -c "import json,sys;d=json.load(sys.stdin);print('AAB:', d.get('state'), d.get('size'), d.get('name') or d.get('message'))"

echo "[4] 검증 (공개 다운로드 헤더)"
curl -sIL "https://github.com/apple01234/CERTZ/releases/download/v1.0.0-beta/SERTZ-v1.0.0-beta.apk" 2>/dev/null | grep -iE "^HTTP/|^content-length" | tail -2
curl -sIL "https://github.com/apple01234/CERTZ/releases/download/v1.0.0-beta/SERTZ-v1.0.0-beta.aab" 2>/dev/null | grep -iE "^HTTP/|^content-length" | tail -2
