#!/usr/bin/env bash
# release_1_4_28.sh — GitHub Release v1.4.28 생성 + APK 업로드(curl --data-binary — undici 100MB+ 불안정 회피)
set -uo pipefail
GH=$(cat /home/z/my-project/.secrets/github_token)
API="https://api.github.com/repos/apple01234/CERTZ"
APK=/tmp/SERTZ-v1.4.28.apk

BODY=$(cat <<'EOF'
## SERTZ v1.4.28 (vc120)

### 변경
- **채팅 전송 버튼 가림 픽스** — NPC 대화창이 열려 있을 때 채팅 입력·전송 버튼이 대화창 뒤로 숨어 탭이 "대화 진행"으로 먹히던 문제 수정 (입력행 z-40 상승)
- **세로 좁은 화면 물약 버튼 재배치** — 세로 폰(폭 576px 미만)에서 물약·자동 버튼이 공격 버튼에서 ~270px 떨어져 있던 것을 **공격 버튼 바로 왼쪽(83px)** 으로 재배치 (v1.4.25 가로 화면 픽스와 동일 위상)
- v1.4.27 포함: 채팅·파티 부활(서버리스 릴레이 폴링)·채팅 수신 폴링/발신자명 픽스·PC 포탈 줌 픽스·자동전투 개선

### 설치
- v1.4.27 덮어설치 가능 (동일 서명 키)
- v1.4.24~26 설치분은 기동 시 자동 갱신 안내 수신
EOF
)

echo "[1] 릴리스 생성"
RID=$(curl -s -X POST "$API/releases" -H "Authorization: Bearer $GH" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name':'v1.4.28','target_commitish':'main','name':'SERTZ v1.4.28 — 채팅 가림·세로화면 물약 배치 픽스','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$BODY")" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id') or '')
import sys as s
if not d.get('id'): print(d.get('message','?'), file=s.stderr)")
echo "릴리스 ID: $RID"
[ -z "$RID" ] && { echo "릴리스 생성 실패"; exit 1; }

echo "[2] APK 업로드 (135MB — curl --data-binary)"
SZ=$(stat -c%s "$APK")
curl -s -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=SERTZ-v1.4.28.apk" \
  -H "Authorization: Bearer $GH" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" | python3 -c "import json,sys;d=json.load(sys.stdin);print('업로드:', d.get('state'), d.get('size'), d.get('name') or d.get('message'))"

echo "[3] 검증"
curl -sIL "https://github.com/apple01234/CERTZ/releases/download/v1.4.28/SERTZ-v1.4.28.apk" 2>/dev/null | rg -i "HTTP/|content-length" | tail -2
