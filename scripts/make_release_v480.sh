#!/bin/bash
# v4.8.0 GitHub Release 업로드 (APK + AAB) + 재다운로드 md5 검증
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.8.0.apk"
AAB="/home/z/my-project/download/SERTZ-v4.8.0.aab"
APK_MD5=$(md5sum "$APK" | cut -d' ' -f1)
AAB_MD5=$(md5sum "$AAB" | cut -d' ' -f1)
echo "APK_MD5=$APK_MD5  AAB_MD5=$AAB_MD5"

echo "[1] 릴리스 생성 v4.8.0"
BODY=$(python3 -c "
import json
body = '''## v4.8.0 (versionCode 63) — 타격감 강화 & 3D 느낌 VFX 2단계

- 💥 충격파 링 셰이더 — 크리티컬 타격(금색 링)·약점 타격(원소색 링)에 GLSL 확장 링 폭발 (fx/ShockwaveFX)
- 🐉 보스 격파 대형 충격파 — 보스 처치 순간 오브 색상 대형 링 (스토리/재림/GM 경로 공통)
- 🥋 도장 연습 크리티컬 피드백 — 허수아비 연습 중에도 충격파 표시
- ⚡ 기존 이펙트 전부 유지 — 보강 레이어 방식, 미지원 기기 자동 끄기, 동시 3개 프레임 예산 상한
- APK md5: $APK_MD5
- AAB md5: $AAB_MD5
- 세이브 그대로 유지 · 덮어설치 가능'''
print(json.dumps({'tag_name':'v4.8.0','target_commitish':'main','name':'v4.8.0 — 타격감 강화 & 3D 느낌 VFX 2단계','body':body,'draft':False,'prerelease':False}))
")
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases -d "$BODY")
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -5; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.8.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] AAB 업로드"
UP2=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.8.0.aab")
echo "$UP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[4] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check480.apk "https://github.com/$REPO/releases/download/v4.8.0/SERTZ-v4.8.0.apk"
echo "remote: $(md5sum /tmp/dl_check480.apk)"
echo "local : $(md5sum $APK)"
curl -sL -o /tmp/dl_check480.aab "https://github.com/$REPO/releases/download/v4.8.0/SERTZ-v4.8.0.aab"
echo "remote: $(md5sum /tmp/dl_check480.aab)"
echo "local : $(md5sum $AAB)"
echo "DONE"
