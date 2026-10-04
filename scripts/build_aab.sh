#!/bin/bash
# SERTZ AAB(Android App Bundle) 빌드 — 플레이 스토어 출시용
# 사용: JAVA_HOME=/home/z/jdk ANDROID_HOME=/home/z/.android-sdk bash scripts/build_aab.sh
#  * cap sync는 build_apk.sh가 이미 수행한 직후에 실행하는 것을 권장 (이중 sync 방지)
#    단독 실행 시 이 스크립트가 cap sync도 수행한다.
# v1.0.0-beta 보강(build_apk.sh 패리티):
#  ① node server.js kill(OOM 방지) ②serverless 라우트 5개 임시 격리(output:export 비호환 — trap EXIT 복원)
#  ③lintVital 3종 -x(3GB 박스 OOM 방지) ④versionName 파싱 [0-9.]* → [^"]*("1.0.0-beta" 문자 버전 대응)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "[0/3] 환경 감지"
pkill -f "node server.js" 2>/dev/null || true
sleep 1
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

echo "[0.6/3] serverless 라우트 5개 임시 격리 (output:export 비호환 — trap EXIT로 항상 복원)"
mkdir -p "$PROJECT_ROOT/.apk-hold/api-routes"
ROUTE_DIRS="admin auth market rank support chat party"
for d in $ROUTE_DIRS; do
  if [ -d "src/app/api/$d" ]; then mv "src/app/api/$d" "$PROJECT_ROOT/.apk-hold/api-routes/"; fi
done
echo "[0.7/3] middleware 임시 격리 (output:export 비호환 — trap EXIT 복원)"
MIDDLEWARE_FILES="src/middleware.ts src/middleware.js src/proxy.ts src/proxy.js"
for f in $MIDDLEWARE_FILES; do
  if [ -f "$f" ]; then mv "$f" "$PROJECT_ROOT/.apk-hold/"; fi
done
restore_routes_aab() {
  for d in $ROUTE_DIRS; do
    if [ -d "$PROJECT_ROOT/.apk-hold/api-routes/$d" ]; then mv "$PROJECT_ROOT/.apk-hold/api-routes/$d" "$PROJECT_ROOT/src/app/api/$d"; fi
  done
  # 웹 플레이 차단 middleware 복원 (export 빌드 전 격리분)
  for f in middleware.ts middleware.js proxy.ts proxy.js; do
    if [ -f "$PROJECT_ROOT/.apk-hold/$f" ]; then mv "$PROJECT_ROOT/.apk-hold/$f" "$PROJECT_ROOT/src/$f"; fi
  done
}
trap restore_routes_aab EXIT

echo "[1/3] Capacitor sync (단독 실행 시 — 최신 웹 에셋 반영)"
if [ "${SKIP_SYNC:-0}" != "1" ]; then
  APK_EXPORT=1 npx next build
  npx cap sync android
fi

echo "[2/3] Gradle bundleRelease (서명: sertz-release.keystore — lint 3종 제외 OOM 방지)"
cd android
./gradlew bundleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

echo "[3/3] AAB 복사"
VER="$(grep -o 'versionName "[^"]*"' app/build.gradle | head -1 | sed 's/versionName "//;s/"//')"
cp -f app/build/outputs/bundle/release/app-release.aab "$PROJECT_ROOT/download/SERTZ-v${VER}.aab"
ls -la "$PROJECT_ROOT/download/SERTZ-v${VER}.aab"
echo "완료 → download/SERTZ-v${VER}.aab (플레이 콘솔 업로드용)"
