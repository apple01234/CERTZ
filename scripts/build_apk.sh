#!/bin/bash
# SERTZ APK 원커맨드 재빌드 — 웹 소스 수정 후 이 스크립트만 실행
# 사용: bash scripts/build_apk.sh   (체크아웃 위치 무관 — SCRIPT_DIR 기준 산출)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "[0/5] 빌드 도구 환경 감지"
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
fi
export JAVA_HOME
if [ -z "${ANDROID_HOME:-}" ]; then
  for c in /home/z/my-project/.android-sdk /home/z/android-sdk /opt/android-sdk "$PROJECT_ROOT/.android-sdk"; do
    if [ -d "$c" ]; then ANDROID_HOME="$c"; break; fi
  done
fi
export ANDROID_HOME
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

echo "[0.5/5] public/ 내 APK 임시 격리 — export 빌드가 .next-apk로 복사하기 '전'에 (v3.0.25·27 비대화 사고 예방)"
mkdir -p "$PROJECT_ROOT/.apk-hold"
find public -maxdepth 1 -name "*.apk" -exec mv {} "$PROJECT_ROOT/.apk-hold/" \; 2>/dev/null || true

echo "[1/5] 정적 export 빌드 (APK_EXPORT=1 next build)"
APK_EXPORT=1 npx next build

echo "[1.3/5] .next-apk 잔여 APK 이중 제거 (안전벨트)"
rm -f .next-apk/*.apk

echo "[2/5] Capacitor sync (web assets → android)"
npx cap sync android

echo "[2.5/5] public/ APK 복원"
mv "$PROJECT_ROOT/.apk-hold/"*.apk public/ 2>/dev/null || true

echo "[3/5] Gradle assembleRelease"
cd android
./gradlew assembleRelease --no-daemon

echo "[4/5] APK 복사"
cp -f app/build/outputs/apk/release/app-release.apk "$PROJECT_ROOT/download/SERTZ-v3.1.0.apk"

echo "[5/5] 완료 → $PROJECT_ROOT/download/SERTZ-v3.1.0.apk"
ls -la "$PROJECT_ROOT/download/SERTZ-v3.1.0.apk"
