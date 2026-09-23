#!/bin/bash
# SERTZ v1.4.3 GitHub Release 생성 + APK 업로드 (토큰은 git remote URL에서 추출)
set -e
REMOTE_URL="$(git -C /home/z/my-project config --get remote.origin.url)"
TOKEN="$(echo "$REMOTE_URL" | sed -n 's|^https://x-access-token:\([^@]*\)@github.com/.*|\1|p')"
if [ -z "$TOKEN" ]; then echo "토큰 추출 실패"; exit 1; fi

API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.4.3.apk"
TAG="v1.4.3"

echo "[1] 릴리스 생성 ($TAG)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v1.4.3",
    "target_commitish": "main",
    "name": "SERTZ v1.4.3 — 무한 재부팅 수정 · Lv.3 진행 해결 · 플레이스토어 대비",
    "body": "## SERTZ v1.4.3 (versionCode 95)\n\n유저 리포트 7건 + 플레이스토어 대비:\n- **무한 재부팅 근본 수정** — ARG 웹페이지 등 외부 페이지 복귀 후 반복 재시작 루프를 재부팅 예산 체계로 차단 (2분 창 최대 2회, 초과 시 수동 복구 화면 + 복귀 직후 15초 관찰 유예 + 텍스처 선수복)\n- **첫 사냥터 Lv.3 진행 해결** — 마을의 카이엔 교관 + 주민 + 마을 아이, 3명 대화를 모두 끝내면 자동으로 Lv.3 성장\n- **마을 요새 유적 2층 구조물 삭제** — 계단·발코니·목책·보이지 않는 히트박스 제거, 보물 상자만 잔존\n- **등급업 큐브 가방에서 바로 사용** — 무기/방어구 등급업 버튼 + 실패 사유 상세 안내\n- **UI 아이콘 로드 실패 자동 재시도** — 보스 유물 등 깨진 아이콘 복구\n- **멀티 진입 노출** — HUD 더보기 멀티 버튼 + 파티/친구 위젯 좌측 이동\n- **재림 보스 전용 유물 3종** — 파수꾼의 감시안/세계수의 껍질 조각/종언의 모래시계 (보스 유물 시리즈 완성)\n- **플레이스토어 대비** — 광고 ID 미사용 선언, applicationId com.sertz.myapp, 지원센터(/support)·개인정보처리방침(/privacy)·계정 삭제 API, HTTPS 강제\n\n※ 패키지명 변경(com.sertz.yggdrasil → com.sertz.myapp): 구버전 위에 덮어설치 불가 — 구버전 삭제 후 신규 설치\n※ 계정 로그인 유저는 클라우드 세이브 복원으로 이어서 플레이 가능\n\napk md5: `f0c298b6486b77a0fb7e98de18af042a` (111,715,611B)",
    "draft": false,
    "prerelease": false
  }')
echo "$CREATE_RESP" > /tmp/gh_release_create_143.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패: $(head -c 400 /tmp/gh_release_create_143.json)"
  exit 1
fi
echo "    릴리스 ID: $RELEASE_ID"

echo "[2] APK 업로드 (107MB)..."
UPLOAD_RESP=$(curl -s --max-time 560 --retry 2 --retry-delay 5 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  -X POST \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.3.apk")
echo "$UPLOAD_RESP" > /tmp/gh_asset_upload_143.json
ASSET_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browser_download_url','') or d.get('message','FAIL'))" 2>/dev/null)
echo "    결과: $ASSET_URL"
