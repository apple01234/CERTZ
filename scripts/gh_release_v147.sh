#!/bin/bash
# SERTZ v1.4.7 GitHub Release 생성 + APK 업로드 (토큰은 git remote URL에서 추출)
set -e
REMOTE_URL="$(git -C /home/z/my-project config --get remote.origin.url)"
TOKEN="$(echo "$REMOTE_URL" | sed -n 's|^https://x-access-token:\([^@]*\)@github.com/.*|\1|p')"
if [ -z "$TOKEN" ]; then echo "토큰 추출 실패"; exit 1; fi

API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.4.7.apk"
TAG="v1.4.7"
MD5="3da1ba65190c1157018d5a670d522381"

echo "[1] 릴리스 생성 ($TAG)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v1.4.7",
    "target_commitish": "main",
    "name": "SERTZ v1.4.7 — 오류나는 페이지 전면 철거: 이상한 비석 제거·/secret 삭제 (vc99)",
    "body": "## SERTZ v1.4.7 (versionCode 99)\n\n### 🪦 오류나는 페이지 전면 철거 (유저 지시)\n- 마을 **이상한 비석 완전 제거** — ARG 웹페이지(/secret/)를 열던 트리거 오브제를 게임에서 삭제 (무한 재부팅 사건의 근원)\n- **세계수의 기록(/secret) 페이지 서버에서 완전 삭제** — 구버전 APK·북마크의 잔존 링크는 지원센터(/support)로 308 자동 안내\n- 비밀수첩 [힌트 페이지] 버튼 철거 — [지원센터·문의] 버튼만 유지\n- ARG 힌트는 **외부 공식 지원센터 웹페이지로 이원화** — 정답 코드 입력은 비밀수첩에 그대로 유지\n- 재부팅 방어 체계(예산·수동 복구 오버레이·복귀 유예)는 이중 안전망으로 유지\n\n### ♻️ 회귀 확인 (E2E 19/19 PASS)\n- NPC 3명 대화 → Lv.3 (v1.4.4) · 등급업 큐브 승급 (v1.4.3) · 지원센터/개인정보 페이지 (v1.4.6)\n\n### 💾 세이브 안내\n- 기존 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다\n\n---\n- md5: '"$MD5"'\n- size: 117541818B\n- applicationId: com.sertz.myapp · versionCode: 99 · versionName: 1.4.7\n- 서명: 기존 릴리스 키 동일 (SHA-256 cc774f34…)\n",
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
    if a.get('name') == 'SERTZ-v1.4.7.apk':
        print(a['id'])
" 2>/dev/null)
if [ -n "$OLD" ]; then
  curl -s -X DELETE -H "Authorization: token $TOKEN" "$API/releases/assets/$OLD" && echo "기존 에셋 삭제($OLD)"
fi

echo "[3] APK 업로드..."
UPLOAD_URL="https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.7.apk"
UP_RESP=$(curl -s --max-time 600 --retry 3 --retry-delay 5 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "$UPLOAD_URL")
ASSET_ID=$(echo "$UP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$ASSET_ID" ] && echo "업로드 완료 (asset $ASSET_ID)" || { echo "업로드 실패"; echo "$UP_RESP" | head -5; exit 1; }

echo "[4] 원격 재다운로드 md5 검증..."
curl -sL --max-time 600 -o /tmp/remote-v147.apk "https://github.com/apple01234/CERTZ/releases/download/v1.4.7/SERTZ-v1.4.7.apk"
REMOTE_MD5=$(md5sum /tmp/remote-v147.apk | cut -d' ' -f1)
LOCAL_MD5=$(md5sum "$APK" | cut -d' ' -f1)
echo "remote=$REMOTE_MD5 local=$LOCAL_MD5"
if [ "$REMOTE_MD5" = "$LOCAL_MD5" ]; then echo "MD5 일치 ✓"; else echo "MD5 불일치 ✗"; exit 1; fi
rm -f /tmp/remote-v147.apk
echo "[5] v1.4.7 릴리스 완료 — https://github.com/apple01234/CERTZ/releases/tag/v1.4.7"
