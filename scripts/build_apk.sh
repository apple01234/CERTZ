#!/bin/bash
# SERTZ APK 원커맨드 재빌드 — 웹 소스 수정 후 이 스크립트만 실행
# 사용: bash scripts/build_apk.sh   (체크아웃 위치 무관 — SCRIPT_DIR 기준 산출)
# v1.4.25 보강: ①부팅 전 node server.js kill(3.9GB 상자 OOM 방지 — v1.4.23 때 lint가 java 1.7GB로 OOM킬)
# ②②안 serverless 라우트 5개(admin·auth·market·rank·support) 임시 격리(output:export 비호환 — force-static 미선언,
#   trap EXIT로 복원) ③lintVital 3개 태스크 -x(모호한 이름 "lintVital" 단독은 실패 — 정확한 태스크명 필수)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "[0/5] 빌드 도구 환경 감지"
# OOM 방지 — 로컬 본체(약 1GB)는 ②안 정책상 원래 중지 원칙(VC-1 이중 쓰기 방지)
pkill -f "node server.js" 2>/dev/null || true
sleep 1
if [ -z "${JAVA_HOME:-}" ]; then
  # v1.4.19 — PATH의 java가 JRE만 깔린 시스템 JVM(javac 없음)을 잡아
  # "does not provide the required capabilities: [JAVA_COMPILER]"로 실패하던 것 수정:
  # 툴체인 스크립트(rebuild_toolchain.sh)가 설치하는 풀 JDK(/home/z/jdk)를 우선 사용.
  if [ -x /home/z/jdk/bin/javac ]; then
    JAVA_HOME=/home/z/jdk
  else
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
  fi
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

echo "[0.6/5] ②안 serverless 라우트 5개 임시 격리 (output:export 비호환 — trap EXIT로 항상 복원)"
mkdir -p "$PROJECT_ROOT/.apk-hold/api-routes"
ROUTE_DIRS="admin auth market rank support chat party"
for d in $ROUTE_DIRS; do
  if [ -d "src/app/api/$d" ]; then mv "src/app/api/$d" "$PROJECT_ROOT/.apk-hold/api-routes/"; fi
done
echo "[0.7/5] middleware 임시 격리 (output:export 비호환 — trap EXIT 복원)"
MIDDLEWARE_FILES="src/middleware.ts src/middleware.js src/proxy.ts src/proxy.js"
for f in $MIDDLEWARE_FILES; do
  if [ -f "$f" ]; then mv "$f" "$PROJECT_ROOT/.apk-hold/"; fi
done
restore_routes() {
  # v1.4.25 버그 수정: trap은 스크립트 끝(cd android 이후)에 실행되므로 상대경로면 실패 — 절대경로 필수
  for d in $ROUTE_DIRS; do
    if [ -d "$PROJECT_ROOT/.apk-hold/api-routes/$d" ]; then mv "$PROJECT_ROOT/.apk-hold/api-routes/$d" "$PROJECT_ROOT/src/app/api/$d"; fi
  done
  # 웹 플레이 차단 middleware 복원 (export 빌드 전 격리분)
  for f in middleware.ts middleware.js proxy.ts proxy.js; do
    if [ -f "$PROJECT_ROOT/.apk-hold/$f" ]; then mv "$PROJECT_ROOT/.apk-hold/$f" "$PROJECT_ROOT/src/$f"; fi
  done
}
trap restore_routes EXIT

echo "[1/5] 정적 export 빌드 (APK_EXPORT=1 next build)"
APK_EXPORT=1 npx next build

echo "[1.3/5] .next-apk 잔여 APK 이중 제거 (안전벨트)"
rm -f .next-apk/*.apk

echo "[2/5] Capacitor sync (web assets → android)"
npx cap sync android

echo "[2.5/5] public/ APK 복원"
mv "$PROJECT_ROOT/.apk-hold/"*.apk public/ 2>/dev/null || true

echo "[3/5] Gradle assembleRelease (lint 3종 제외 — OOM 방지)"
cd android
./gradlew assembleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

echo "[4/5] APK 복사"
VER="$(grep -o 'versionName "[0-9.]*"' app/build.gradle | head -1 | grep -o "[0-9.]*")"
cp -f app/build/outputs/apk/release/app-release.apk "$PROJECT_ROOT/download/SERTZ-v${VER}.apk"

echo "[5/5] 완료 → $PROJECT_ROOT/download/SERTZ-v${VER}.apk"
ls -la "$PROJECT_ROOT/download/SERTZ-v${VER}.apk"
