#!/bin/bash
# v1.4.25 — GitHub 릴리스 생성 + APK 업로드 (물약키 거리 픽스)
set -e
TOKEN="$(cat /home/z/my-project/.secrets/github_token 2>/dev/null)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed 's|https://\([^@]*\)@github.com.*|\1|')"
fi
REPO="apple01234/CERTZ"
TAG="v1.4.25"
APK="/home/z/my-project/download/SERTZ-v1.4.25.apk"

echo "[1/3] 릴리스 생성 (tag: $TAG)"
RELEASE_JSON=$(cat <<EOF
{
  "tag_name": "$TAG",
  "target_commitish": "main",
  "name": "SERTZ v1.4.25 — 물약 버튼 위치 개선",
  "body": "## v1.4.25 (versionCode 117)\n\n### 수정 (유저 리포트: 모바일에서 기본공격 키와 물약키가 너무 멀어요)\n- **물약(HP/MP)·자동 버튼을 기본공격 버튼 바로 아래-왼쪽으로 이동** — 와일드리프트 스펠 자리 배치\n- 기존: 공격 버튼(우하단 코너) ↔ 물약 버튼(화면 반대편) 거리 약 230px → **74px로 단축**\n- 엄지를 화면을 가로질러 옮길 필요 없이 공격 버튼 바로 아래에서 HP/MP 물약 즉시 사용\n- 좁은 세로 화면(플로팅 배치)은 기존 유지\n\n### v1.4.24 내용 포함\n- APK 연결 상태 표시 수정 — 서버 정상 시 \"서버 연결됨\" 표시(계정 API 헬스체크)\n\n### v1.4.23 내용 포함\n- 이동·스킬 사용 시 검은 화면 반짝임 수정(desynchronized 제거·GPU 불안정 브레이커·Canvas 폴백)\n- 계정·거래소·랭킹·클라우드세이브 Vercel 직결\n\n### 설치 안내\n- 기존 설치 앱 위에 그대로 설치(덮어쓰기) 가능 — 서명 키 동일(cc774f34)\n- 인앱 업데이트: 앱 실행 시 자동 갱신 안내 (1.4.24 → 1.4.25)\n\n### 웹\n- https://sertz.vercel.app",
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
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.25.apk")
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
