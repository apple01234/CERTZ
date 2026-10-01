#!/bin/bash
# GitHub Release v3.1.0 생성 + APK 업로드
# 보안: 토큰은 환경변수 GH_TOKEN 으로 전달 (파일에 하드코딩 금지 — 시크릿 푸시 보호)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v3.1.0.apk"

echo "[1] 릴리스 생성 (v3.1.0)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v3.1.0",
    "target_commitish": "main",
    "name": "SERTZ v3.1.0 — 이그드라실 : 아홉 왕국",
    "body": "## SERTZ v3.1.0 (versionCode 44)\n\n유저 피드백 13건 반영:\n- BGM/효과음 분리 볼륨 슬라이더\n- 전직 스토리(시련) 선행 후 전직 진행\n- 판매 수량 입력 + MAX 전량 판매\n- 늪 몬스터 명칭 교정 (능대)\n- 스토리 보스 전용 난이도 (노말 상향)\n- 맵 이동 흑화 버그 수정\n- 전직 시련 잡몹 리스폰 차단\n- HUD 스로틀 최적화\n\neye md5: `ed1c4e9ae44599148deb4990709fbcb6`",
    "draft": false,
    "prerelease": false
  }')
echo "$CREATE_RESP" > /tmp/gh_release_create.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패: $(head -c 300 /tmp/gh_release_create.json)"
  exit 1
fi
echo "    릴리스 ID: $RELEASE_ID"

echo "[2] APK 업로드 (140MB)..."
UPLOAD_RESP=$(curl -s --max-time 550 --retry 2 --retry-delay 5 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  -X POST \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v3.1.0.apk")
echo "$UPLOAD_RESP" > /tmp/gh_asset_upload.json
ASSET_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browser_download_url','') or d.get('message','FAIL'))" 2>/dev/null)
echo "    결과: $ASSET_URL"

echo "[3] 완료 — 다운로드 URL:"
echo "    https://github.com/apple01234/CERTZ/releases/download/v3.1.0/SERTZ-v3.1.0.apk"
