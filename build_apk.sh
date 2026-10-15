#!/usr/bin/env bash
# CERTZ APK release build (v1.4.26/vc118 — build_apk.sh 표준 복원판)
# 절차: node kill(OOM방지) → serverless 라우트 격리(trap 절대경로 복원) → next export build → cap sync → gradle assembleRelease
set -uo pipefail
# v1.0.13 최적화 — PROJECT_ROOT 하드코딩 제거: 스크립트 위치(저장소 루트) 자동 감지.
#  저장소가 하위 디렉터리(예: /home/z/my-project/CERTZ)에 클론돼도 동작. 외부에서
#  PROJECT_ROOT 환경변수로 덮어쓸 수도 있다.
export PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)}"
# vc140 — 환경 재구축 대응: 시스템 OpenJDK 21 경로 자동 탐지(/home/z/jdk 소실 대비)
export JAVA_HOME="${JAVA_HOME:-/home/z/jdk}"
[ -x "$JAVA_HOME/bin/java" ] || export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME="${ANDROID_HOME:-/home/z/.android-sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
cd "$PROJECT_ROOT"

echo "[0] node server.js kill (OOM 방지)"
pkill -f "node server.js" 2>/dev/null; sleep 1

HOLD="$PROJECT_ROOT/.apk-hold/api-routes"
# v1.4.27 — 릴레이 채팅/파티 라우트도 격리(동적 라우트 — output:export 충돌)
ROUTES="admin auth market rank support chat party"

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
# v1.0.13 가드 — 이전 빌드가 격리 직후 사망(SIGKILL/OOM 등)해 trap 복원 없이 끝난 경우
#  .apk-hold에 라우트가 남는다. 이 상태로 격리를 재실행하면 src에서 라우트가 소실된 채
#  커밋·배포될 수 있으므로, 시작 시 잔존분을 먼저 원복한다 (실제 사건 581b8c0).
if [ -d "$HOLD" ]; then
  echo "  [가드] 잔존 .apk-hold 발견 → 원복 후 진행"
  for r in $ROUTES; do
    [ -d "$HOLD/$r" ] && rm -rf "$PROJECT_ROOT/src/app/api/$r" && mv "$HOLD/$r" "$PROJECT_ROOT/src/app/api/$r"
  done
  for f in middleware.ts middleware.js proxy.ts proxy.js; do
    [ -f "$HOLD/$f" ] && mv "$HOLD/$f" "$PROJECT_ROOT/src/$f"
  done
  rm -rf "$HOLD"
fi
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
