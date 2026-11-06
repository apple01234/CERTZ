#!/usr/bin/env bash
# verify_exe_export.sh — EXE(정적 export) 빌드가 통과하는지 로컬에서 재현 검증
#
# 워크플로(exe-build.yml)의 "Static export" 스텝을 그대로 재현한다.
# 핵심: serverless 라우트를 격리한 채 `APK_EXPORT=1 next build` 가 성공해야 한다.
#       (과거 실패 원인: 격리 목록에 `maps` 가 빠져 /api/maps 동적 라우트가 export 를 깨뜨림)
#
# 안전장치: trap EXIT 로 어떤 경로로 끝나도 라우트를 반드시 복원한다.
set -uo pipefail

ROUTE_DIRS="admin auth market rank support chat party campaign iap maps"
HOLD=".apk-hold/api-routes"

cleanup() {
  for d in $ROUTE_DIRS; do
    if [ -d "$HOLD/$d" ] && [ ! -d "src/app/api/$d" ]; then
      mv "$HOLD/$d" "src/app/api/$d"
    fi
  done
  rmdir -p "$HOLD" 2>/dev/null || true
  rm -rf .apk-hold
}
trap cleanup EXIT INT TERM

echo "=== 1) serverless 라우트 격리 ==="
mkdir -p "$HOLD"
for d in $ROUTE_DIRS; do
  if [ -d "src/app/api/$d" ]; then mv "src/app/api/$d" "$HOLD/"; fi
done
echo "남은 api: $(ls src/app/api/ | tr '\n' ' ')"

echo
echo "=== 2) APK_EXPORT=1 next build ==="
APK_EXPORT=1 NODE_OPTIONS=--max-old-space-size=4096 npx next build
EC=$?

echo
echo "=== 3) export 산출물 확인 ==="
if [ "$EC" -eq 0 ] && [ -f .next-apk/index.html ]; then
  echo "PASS — .next-apk/index.html 존재"
  ls .next-apk/*.html 2>/dev/null | wc -l | xargs echo "정적 html:"
else
  echo "FAIL (exit=$EC) — index.html 없음"
  [ "$EC" -eq 0 ] && EC=1
fi
exit "$EC"
