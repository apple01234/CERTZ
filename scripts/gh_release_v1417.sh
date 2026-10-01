#!/bin/bash
# v1.4.17 — GitHub 릴리스 생성 + APK 업로드
# 배경: v1.4.16 때 batch-6 수정본이 릴리스에 업로드되지 않아 유저가 구버전 APK를
#       받았고(다운로드 1회), 인앱 업데이터도 버전 미인상으로 갱신 불가였다.
#       이번에는 릴리스 에셋 업로드를 빌드 파이프라인의 필수 단계로 수행한다.
set -e
TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed 's|https://\([^@]*\)@github.com.*|\1|')"
REPO="apple01234/CERTZ"
TAG="v1.4.17"
APK="/home/z/my-project/download/SERTZ-v1.4.17.apk"

echo "[1/3] 릴리스 생성 (tag: $TAG)"
RELEASE_JSON=$(cat <<EOF
{
  "tag_name": "$TAG",
  "target_commitish": "main",
  "name": "SERTZ v1.4.17 — 공격버튼 코너 복귀 + 여캐 정상화",
  "body": "## v1.4.17 (versionCode 109)\n\n### 수정\n- **기본공격 버튼**: 우하단 코너 복귀 + 지름 100px 대형화 (PC 112px) — 스킬 부채꼴은 동일 중심 동심원 유지\n- **여캐 스프라이트 전면 정상화**: 남캐와 동일한 아트 스타일(긴 머리 + 스커트 실루엣, 피부 6종)로 168프레임 전부 재생성 — '에셋이 안 불러와진 것 같다'로 보이던 갈색 덩어리 실루엣 해소\n- **장식 앵커**(왕관/리본/날개) 여캐 실루엣에 맞춰 재산출\n\n### 설치 안내\n- 기존 설치 앱 위에 그대로 설치(덮어쓰기) 가능 — 서명 키 동일\n- 인앱 업데이트: 앱 실행 시 자동 갱신 안내 (1.4.16 → 1.4.17)\n\n### 웹\n- https://sertz11.vercel.app (멀티플레이는 서버 연결 필요)",
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
  # 기존 릴리스면 ID 재조회
  RELEASE_ID=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
  echo "기존 릴리스 ID 재조회: $RELEASE_ID"
fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2/3] APK 업로드 (135MB — 수 분 소요)"
UPLOAD_RESP=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.4.17.apk")
echo "$UPLOAD_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'state' in d:
    print('업로드 완료:', d['name'], d['size'], 'bytes, state=', d['state'])
else:
    print('업로드 응답:', json.dumps(d)[:300])
"

echo "[3/3] 검증"
curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('release:', d.get('tag_name'), d.get('name'))
for a in d.get('assets',[]):
    print('  asset:', a['name'], a['size'], a['state'])
"
echo "DONE"
