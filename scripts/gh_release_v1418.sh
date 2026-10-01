#!/bin/bash
# v1.4.18 — GitHub 릴리스 생성 + APK 업로드 (batch-7 교훈: 릴리스 업로드는 파이프라인 필수 단계)
set -e
TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed 's|https://\([^@]*\)@github.com.*|\1|')"
REPO="apple01234/CERTZ"
TAG="v1.4.18"
APK="/home/z/my-project/download/SERTZ-v1.4.18.apk"

echo "[1/3] 릴리스 생성 (tag: $TAG)"
RELEASE_JSON=$(cat <<EOF
{
  "tag_name": "$TAG",
  "target_commitish": "main",
  "name": "SERTZ v1.4.18 — 화면 깨짐 3종 근본 수정",
  "body": "## v1.4.18 (versionCode 110)\n\n### 수정 (유저 리포트: 웹 배포에서 이동할 때마다 화면 깨짐)\n- **세로 화면 조이스틱·버튼 겹침 제거**: 좁은 세로 화면에서 물약/자동사냥 버튼이 조이스틱 영역(왼쪽 46%) 위에 겹쳐 이동할 때마다 물약이 발리며 화면이 깨지던 문제 — 겹침 시 클러스터를 스킬 아크 위 우측 가로열로 자동 플로팅\n- **socket.io 무한 재연결 스톰 차단**: 서버 없는 정적 배포(Vercel 등)에서 404/308 재시도가 영원히 반복되며 프레임을 잠식하던 문제 — 4회 실패 후 오프라인 모드 확정\n- **줌 스냅 점프 차단**: 모바일 주소창 토글 등 resize 노이즈로 카메라 줌이 0.25스텝 경계에서 점프하던 것 — 96px 미만 변화 무시 + 300ms 디바운스\n\n### 설치 안내\n- 기존 설치 앱 위에 그대로 설치(덮어쓰기) 가능 — 서명 키 동일 (cc774f34)\n- 인앱 업데이트: 앱 실행 시 자동 갱신 안내 (1.4.17 → 1.4.18)\n\n### 웹\n- https://sertz11.vercel.app (멀티플레이는 멀티 서버 연결 필요 — 웹 서버 미연결 시 오프라인 모드)",
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
RELEASE_ID=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 응답:"; echo "$RESP" | head -5
  RELEASE_ID=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
  echo "기존 릴리스 ID 재조회: $RELEASE_ID"
fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2/3] APK 업로드 (135MB)"
UPLOAD_RESP=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.18.apk")
echo "$UPLOAD_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('state:', d.get('state'), '| size:', d.get('size'), '| name:', d.get('name'))
"

echo "[3/3] 검증"
curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('tag:', d.get('tag_name'), '| assets:', [(a['name'], a['size']) for a in d.get('assets', [])])
"
