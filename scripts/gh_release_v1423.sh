#!/bin/bash
# v1.4.23 — GitHub 릴리스 생성 + APK 업로드 (깜빡임 픽스 + ②안 Vercel 직결)
set -e
TOKEN="$(cat /home/z/my-project/.secrets/github_token 2>/dev/null)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed 's|https://\([^@]*\)@github.com.*|\1|')"
fi
REPO="apple01234/CERTZ"
TAG="v1.4.23"
APK="/home/z/my-project/download/SERTZ-v1.4.23.apk"

echo "[1/3] 릴리스 생성 (tag: $TAG)"
RELEASE_JSON=$(cat <<EOF
{
  "tag_name": "$TAG",
  "target_commitish": "main",
  "name": "SERTZ v1.4.23 — 이동·스킬 시 검은 화면 반짝임 수정 + 계정·거래소 직결",
  "body": "## v1.4.23 (versionCode 115)\n\n### 수정 (유저 리포트: 움직이거나 스킬을 사용하면 화면이 검게 반짝임)\n- **render.desynchronized 제거**: 이동·스킬처럼 갱신이 격한 순간 Android WebView에서 검은 프레임을 유발하는 문서화된 옵션 — 근본 유발점 제거\n- **GPU 불안정 브레이커**: WebGL 컨텍스트가 60초 안에 2회 유실되면 자동으로 fx 절전 모드 강제(블룸·툰 셰이더 프레임버퍼 경로 즉시 해제) + 화면 배너 안내\n- **Canvas 백엔드 폴백**: 컨텍스트 유실 4회 누적 시 세션 예약 후 안전 재부팅 — 이후 부팅부터 Canvas 렌더러(실측 60fps, 검은 프레임 0건). ?renderer=webgl로 세션 해제 가능\n\n### 계정·거래소 직결 (v1.4.22 내용 포함)\n- 계정·거래소·랭킹·클라우드세이브가 Vercel(sertz.vercel.app)에서 직접 동작 — 구 게임 서버(sertz11/5) 의존 완전 제거, 저장분 자동 이행\n- 멀티플레이(실시간 접속전)은 오프라인 모드로 대체\n\n### 설치 안내\n- 기존 설치 앱 위에 그대로 설치(덮어쓰기) 가능 — 서명 키 동일\n- 인앱 업데이트: 앱 실행 시 자동 갱신 안내 (1.4.21 이하 → 1.4.23)\n\n### 웹\n- https://sertz.vercel.app (웹은 새로고침 시 픽스 적용)",
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
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.23.apk")
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
