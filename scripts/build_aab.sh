#!/bin/bash
# SERTZ AAB(Android App Bundle) 빌드 — 플레이 스토어 출시용 (v4.6.0)
# 사용: JAVA_HOME=/home/z/jdk ANDROID_HOME=/home/z/.android-sdk bash scripts/build_aab.sh
#  * cap sync는 build_apk.sh가 이미 수행한 직후에 실행하는 것을 권장 (이중 sync 방지)
#    단독 실행 시 이 스크립트가 cap sync도 수행한다.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "[0/3] 환경 감지"
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -x /home/z/jdk/bin/java ]; then JAVA_HOME=/home/z/jdk; else
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
  fi
fi
export JAVA_HOME
if [ -z "${ANDROID_HOME:-}" ]; then
  for c in /home/z/.android-sdk /home/z/my-project/.android-sdk /opt/android-sdk; do
    if [ -d "$c" ]; then ANDROID_HOME="$c"; break; fi
  done
fi
export ANDROID_HOME
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

echo "[1/3] Capacitor sync (단독 실행 시 — 최신 웹 에셋 반영)"
if [ "${SKIP_SYNC:-0}" != "1" ]; then
  APK_EXPORT=1 npx next build
  npx cap sync android
fi

echo "[2/3] Gradle bundleRelease (서명: sertz-release.keystore)"
cd android
./gradlew bundleRelease --no-daemon

echo "[3/3] AAB 복사"
VER="$(grep -o 'versionName "[0-9.]*"' app/build.gradle | head -1 | grep -o "[0-9.]*")"
cp -f app/build/outputs/bundle/release/app-release.aab "$PROJECT_ROOT/download/SERTZ-v${VER}.aab"
ls -la "$PROJECT_ROOT/download/SERTZ-v${VER}.aab"
echo "완료 → download/SERTZ-v${VER}.aab (플레이 콘솔 업로드용)"
