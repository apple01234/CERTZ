#!/usr/bin/env bash
# CERTZ APK release build (v1.4.26/vc118 — build_apk.sh 표준 복원판)
# 절차: node kill(OOM방지) → serverless 라우트 격리(trap 절대경로 복원) → next export build → cap sync → gradle assembleRelease
set -uo pipefail
export PROJECT_ROOT=/home/z/my-project
export JAVA_HOME=/home/z/jdk
export ANDROID_HOME=/home/z/.android-sdk
export PATH="$JAVA_HOME/bin:$PATH"
cd "$PROJECT_ROOT"

echo "[0] node server.js kill (OOM 방지)"
pkill -f "node server.js" 2>/dev/null; sleep 1

HOLD="$PROJECT_ROOT/.apk-hold/api-routes"
ROUTES="admin auth market rank support"

cleanup() {
  echo "[cleanup] 라우트 복원 (절대경로)"
  if [ -d "$HOLD" ]; then
    for r in $ROUTES; do
      [ -d "$HOLD/$r" ] && rm -rf "$PROJECT_ROOT/src/app/api/$r" && mv "$HOLD/$r" "$PROJECT_ROOT/src/app/api/$r"
    done
    rm -rf "$PROJECT_ROOT/.apk-hold"
  fi
}
trap cleanup EXIT

echo "[1] serverless 라우트 격리 → .apk-hold"
mkdir -p "$HOLD"
for r in $ROUTES; do
  mv "$PROJECT_ROOT/src/app/api/$r" "$HOLD/$r"
done

echo "[2] next build (APK_EXPORT=1)"
APK_EXPORT=1 npx next build || { echo "BUILD FAIL: next"; exit 1; }

echo "[3] cap sync android"
npx cap sync android || { echo "BUILD FAIL: cap sync"; exit 1; }

echo "[4] gradle assembleRelease"
cd "$PROJECT_ROOT/android"
./gradlew assembleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease || { echo "BUILD FAIL: gradle"; exit 1; }

echo "[5] 산출물"
ls -la "$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk"
echo "DONE"
