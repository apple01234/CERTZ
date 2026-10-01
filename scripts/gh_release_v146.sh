#!/bin/bash
# SERTZ v1.4.6 GitHub Release 생성 + APK 업로드 (토큰은 git remote URL에서 추출)
set -e
REMOTE_URL="$(git -C /home/z/my-project config --get remote.origin.url)"
TOKEN="$(echo "$REMOTE_URL" | sed -n 's|^https://x-access-token:\([^@]*\)@github.com/.*|\1|p')"
if [ -z "$TOKEN" ]; then echo "토큰 추출 실패"; exit 1; fi

API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.4.6.apk"
TAG="v1.4.6"
MD5="3350dceab41698a85dd580f610520fe6"

echo "[1] 릴리스 생성 ($TAG)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v1.4.6",
    "target_commitish": "main",
    "name": "SERTZ v1.4.6 — 비밀·문의 페이지 404 근본 수정 (vc98)",
    "body": "## SERTZ v1.4.6 (versionCode 98)\n\n### 🔐 비밀 페이지 404 수정 (세계수의 기록)\n- /secret/ 접속 시 308 리다이렉트 → /secret 404로 착지하던 사슬을 제거\n- 서버 레벨에서 후행 슬래시 유무와 무관하게 ARG 정적 페이지를 직접 서빙 (200)\n- /secret/second 별칭 추가\n\n### 🛰 문의 페이지 404 수정 (지원센터)\n- /inquiry · /contact · /account-delete · /delete-account · /account/delete · /delete → 전부 /support 로 308 안내\n- 게임 설정창 비밀수첩에 [지원센터·문의] 버튼 신설 — 문의·계정삭제·FAQ 통합 입구\n- APK에서도 지원센터의 문의 폼·계정 삭제가 저장된 서버(HTTPS)로 전송되도록 개선\n\n### 💾 세이브 안내\n- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다\n\n---\n- md5: '"$MD5"'\n- size: 117545433B\n- applicationId: com.sertz.myapp · versionCode: 98 · versionName: 1.4.6\n- 서명: 기존 릴리스 키 동일 (SHA-256 cc774f34…)\n",
    "draft": false,
    "prerelease": false
  }')
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
if [ -z "$RELEASE_ID" ]; then
  echo "생성 실패 — 기존 릴리스 재사용 시도"
  RELEASE_ID=$(curl -s -H "Authorization: token $TOKEN" "$API/releases/tags/$TAG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
fi
if [ -z "$RELEASE_ID" ]; then echo "릴리스 ID 확보 실패"; echo "$CREATE_RESP" | head -5; exit 1; fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2] 기존 동명 에셋 정리..."
OLD=$(curl -s -H "Authorization: token $TOKEN" "$API/releases/$RELEASE_ID/assets" | python3 -c "
import sys, json
for a in json.load(sys.stdin):
    if a.get('name') == 'SERTZ-v1.4.6.apk':
        print(a['id'])
" 2>/dev/null)
if [ -n "$OLD" ]; then
  curl -s -X DELETE -H "Authorization: token $TOKEN" "$API/releases/assets/$OLD" && echo "기존 에셋 삭제($OLD)"
fi

echo "[3] APK 업로드..."
UPLOAD_URL="https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.6.apk"
UP_RESP=$(curl -s --max-time 600 --retry 3 --retry-delay 5 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "$UPLOAD_URL")
ASSET_ID=$(echo "$UP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$ASSET_ID" ] && echo "업로드 완료 (asset $ASSET_ID)" || { echo "업로드 실패"; echo "$UP_RESP" | head -5; exit 1; }

echo "[4] 원격 재다운로드 md5 검증..."
curl -sL --max-time 600 -o /tmp/remote-v146.apk "https://github.com/apple01234/CERTZ/releases/download/v1.4.6/SERTZ-v1.4.6.apk"
REMOTE_MD5=$(md5sum /tmp/remote-v146.apk | cut -d' ' -f1)
LOCAL_MD5=$(md5sum "$APK" | cut -d' ' -f1)
echo "remote=$REMOTE_MD5 local=$LOCAL_MD5"
if [ "$REMOTE_MD5" = "$LOCAL_MD5" ]; then echo "MD5 일치 ✓"; else echo "MD5 불일치 ✗"; exit 1; fi
rm -f /tmp/remote-v146.apk
echo "[5] v1.4.6 릴리스 완료 — https://github.com/apple01234/CERTZ/releases/tag/v1.4.6"
