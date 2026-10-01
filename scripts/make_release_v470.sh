#!/bin/bash
# v4.7.0 GitHub Release 업로드 (APK + AAB) + 재다운로드 md5 검증
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.7.0.apk"
AAB="/home/z/my-project/download/SERTZ-v4.7.0.aab"
APK_MD5=$(md5sum "$APK" | cut -d' ' -f1)
AAB_MD5=$(md5sum "$AAB" | cut -d' ' -f1)
echo "APK_MD5=$APK_MD5  AAB_MD5=$AAB_MD5"

echo "[1] 릴리스 생성 v4.7.0"
BODY=$(python3 -c "
import json
body = '''## v4.7.0 (versionCode 62) — Phaser 4 엔진 전환 & 3D 느낌 VFX 1단계

- 🚀 Phaser 4 (4.2.1 최신 버전) 엔진 전환 — 신형 렌더러로 전면 이식 (WebGL 파이프라인)
- 🌀 차원문 GLSL 소용돌이 셰이더 — 절차적 셰이더 기반 3D 느낌 VFX 첫 단계 (fx/PortalFX, 미지원 환경 자동 폴백)
- ✨ 보스전 블룸 — Phaser 4 신 렌더러 이펙트(AddEffectBloom)로 동일 강도 이식 (일반 0.46 / 재림 카오스 0.68)
- 📦 Cainos 상자 개봉 애니메이션 — 목재/무쇠/은/금 4종 개봉 모션 (CC0)
- 🛡 기존 틀 유지 — 맵/보스/퀘스트/세이브 구조 동일 (구버전 세이브 그대로 이어하기)
- APK md5: $APK_MD5
- AAB md5: $AAB_MD5
- 세이브 그대로 유지 · 덮어설치 가능'''
print(json.dumps({'tag_name':'v4.7.0','target_commitish':'main','name':'v4.7.0 — Phaser 4 전환 & 3D 느낌 VFX 1단계','body':body,'draft':False,'prerelease':False}))
")
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases -d "$BODY")
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -5; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.7.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] AAB 업로드"
UP2=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.7.0.aab")
echo "$UP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[4] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check470.apk "https://github.com/$REPO/releases/download/v4.7.0/SERTZ-v4.7.0.apk"
echo "remote: $(md5sum /tmp/dl_check470.apk)"
echo "local : $(md5sum $APK)"
curl -sL -o /tmp/dl_check470.aab "https://github.com/$REPO/releases/download/v4.7.0/SERTZ-v4.7.0.aab"
echo "remote: $(md5sum /tmp/dl_check470.aab)"
echo "local : $(md5sum $AAB)"

echo "[5] 구버전 v4.6.0 에셋 제거 (릴리스 자체는 유지)"
OLD_JSON=$(curl -s -H "Authorization: token $TOKEN" https://api.github.com/repos/$REPO/releases/tags/v4.6.0)
OLD_ID=$(echo "$OLD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
if [ -n "$OLD_ID" ]; then
  for AID in $(echo "$OLD_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(str(a['id']) for a in d.get('assets',[])))"); do
    curl -s -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/$OLD_ID/assets/$AID" && echo "deleted asset $AID"
  done
fi
echo "DONE"
