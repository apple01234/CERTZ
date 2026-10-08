#!/bin/bash
# vc141_apk_pipeline.sh — vc141 APK/AAB 백그라운드 빌드+릴리스 업로드 파이프라인
# 1) Android SDK 부재 시 설치 2) build_apk.sh 3) build_aab.sh 4) GitHub 릴리스 자산 업로드(신규 이름 — vc138 DELETE 장애 회피 패턴)
set -uo pipefail
export PROJECT_ROOT=/home/z/my-project
LOG=/tmp/vc141_apk.log
cd "$PROJECT_ROOT"

GT=$(git remote get-url origin | sed -n 's#https://apple01234:\([^@]*\)@github.com/.*#\1#p')
[ -n "$GT" ] || { echo "git token 없음 — 업로드 불가"; exit 1; }

echo "=== [$(date '+%H:%M:%S')] 1) Android SDK 확인/설치 ==="
if [ ! -d /home/z/android-sdk/build-tools ]; then
  bash scripts/install_android_sdk.sh || { echo "SDK 설치 실패"; exit 1; }
else
  echo "SDK 이미 존재 — 스킵"
fi
export ANDROID_HOME=/home/z/android-sdk

echo "=== [$(date '+%H:%M:%S')] 2) APK 빌드 ==="
bash build_apk.sh || { echo "APK 빌드 실패"; exit 1; }
APK_SRC="$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK_SRC" ] || { echo "APK 산출물 없음"; exit 1; }

echo "=== [$(date '+%H:%M:%S')] 3) AAB 빌드 ==="
bash build_aab.sh || echo "AAB 빌드 실패 — APK만 업로드 진행"
AAB_SRC="$PROJECT_ROOT/android/app/build/outputs/bundle/release/app-release.aab"

cp "$APK_SRC" "$PROJECT_ROOT/download/SERTZ-vc141.apk"
MAP="$PROJECT_ROOT/android/app/build/outputs/mapping/release/mapping.txt"
[ -f "$MAP" ] && cp "$MAP" "$PROJECT_ROOT/download/SERTZ-vc141-mapping.txt"
[ -f "$AAB_SRC" ] && cp "$AAB_SRC" "$PROJECT_ROOT/download/SERTZ-vc141.aab"

echo "=== [$(date '+%H:%M:%S')] 4) GitHub 릴리스 업로드 ==="
upload_asset() { # upload_asset <file> <name> <content-type>
  local f="$1" n="$2" ct="$3"
  [ -f "$f" ] || { echo "업로드 스킵(파일 없음): $n"; return 0; }
  for i in 1 2 3 4 5; do
    SZ=$(stat -c%s "$f")
    HTTP=$(curl -s -o /tmp/up.json -w "%{http_code}" -m 1800 \
      -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/tags/v1.0.5-beta/assets?name=$n" \
      -H "Authorization: Bearer $GT" -H "Content-Type: $ct" -H "Content-Length: $SZ" \
      --data-binary "@$f")
    echo "  [$i] $n → HTTP $HTTP ($(stat -c%s "$f") B)"
    if [ "$HTTP" = "201" ]; then echo "  ✓ $n 업로드 완료"; return 0; fi
    sleep 60
  done
  echo "  ✗ $n 업로드 실패"; return 1
}

upload_asset "$PROJECT_ROOT/download/SERTZ-vc141.apk" "SERTZ-vc141.apk" "application/vnd.android.package-archive"
upload_asset "$PROJECT_ROOT/download/SERTZ-vc141-mapping.txt" "SERTZ-vc141-mapping.txt" "text/plain"
upload_asset "$PROJECT_ROOT/download/SERTZ-vc141.aab" "SERTZ-vc141.aab" "application/octet-stream"

echo "=== [$(date '+%H:%M:%S')] 파이프라인 종료 ==="
ls -la "$PROJECT_ROOT/download/" | grep vc141 || true
