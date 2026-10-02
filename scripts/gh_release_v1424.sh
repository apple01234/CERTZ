#!/bin/bash
# v1.4.24 — GitHub 릴리스 생성 + APK 업로드 (연결 상태 오타보 수정)
set -e
TOKEN="$(cat /home/z/my-project/.secrets/github_token 2>/dev/null)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed 's|https://\([^@]*\)@github.com.*|\1|')"
fi
REPO="apple01234/CERTZ"
TAG="v1.4.24"
APK="/home/z/my-project/download/SERTZ-v1.4.24.apk"

echo "[1/3] 릴리스 생성 (tag: $TAG)"
RELEASE_JSON=$(cat <<EOF
{
  "tag_name": "$TAG",
  "target_commitish": "main",
  "name": "SERTZ v1.4.24 — APK 연결 상태 표시 수정",
  "body": "## v1.4.24 (versionCode 116)\n\n### 수정 (유저 리포트: APK에서 서버 주소가 올바른데도 \"연결 실패\" 표시)\n- **연결 판정 전환**: 기존엔 멀티플레이 소켓 접속 여부로 판정 — ②안(Vercel serverless)에서는 소켓 서버가 없어(설계상 오프라인) 12초 후 무조건 \"연결 실패\" 오타보가 떴음\n- **계정 API 헬스체크로 교체**: 저장된 서버 주소의 /api/version을 직접 확인(CORS 허용 실측) — 서버가 살아있으면 녹색 \"서버 연결됨\" 표시\n- 실제 계정·거래소·랭킹·클라우드세이브는 v1.4.23부터 정상 동작 중이던 기능 — 이번 수정은 표시만 바로잡음\n\n### v1.4.23 내용 포함\n- 이동·스킬 사용 시 검은 화면 반짝임 수정(desynchronized 제거·GPU 불안정 브레이커·Canvas 폴백)\n- 계정·거래소·랭킹·클라우드세이브 Vercel 직결\n\n### 설치 안내\n- 기존 설치 앱 위에 그대로 설치(덮어쓰기) 가능 — 서명 키 동일\n- 인앱 업데이트: 앱 실행 시 자동 갱신 안내 (1.4.23 → 1.4.24)\n\n### 웹\n- https://sertz.vercel.app",
  "draft": false,
  "prerelease": false
}
EOF
)
RESP=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RELEASE_JSON" \
  "https://api.github.com/repos/$REPO/releases")
RELEASE_ID=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 응답:"; echo "$RESP" | head -5
  RELEASE_ID=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
  echo "기존 릴리스 ID 재조회: $RELEASE_ID"
fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2/3] APK 업로드"
UPLOAD_RESP=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.24.apk")
echo "$UPLOAD_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('state:', d.get('state'), '| size:', d.get('size'), '| name:', d.get('name'))
" 2>/dev/null || echo "$UPLOAD_RESP" | head -5

echo "[3/3] 검증"
curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('tag:', d.get('tag_name'), '| assets:', [(a['name'], a['size']) for a in d.get('assets', [])])
"
