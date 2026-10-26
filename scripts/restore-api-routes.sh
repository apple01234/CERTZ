#!/usr/bin/env bash
# SERTZ — APK/EXE 정적 export 후 API 라우트 복원
#
# `bash scripts/static-export.sh` 가 trap 으로 자동 복원하지만,
# 그 이전에 중단됐거나 손으로 빌드한 경우 이 스크립트로 되돌린다.
# 되돌린 뒤 개수를 검증하고, 부족하면 non-zero 로 끝나 CI 에서 잡힌다.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

ROUTE_DIRS="admin auth market rank support chat party"
HOLD=".apk-hold"

if [ ! -d "$HOLD/api-routes" ]; then
  echo "[restore] 격리된 라우트 없음 — 정상"
  find src/app/api -name route.ts | wc -l | xargs echo "[restore] 현재 route.ts 수:"
  exit 0
fi

for d in $ROUTE_DIRS; do
  if [ -d "$HOLD/api-routes/$d" ] && [ ! -d "src/app/api/$d" ]; then
    mv "$HOLD/api-routes/$d" "src/app/api/$d"
    echo "[restore] src/app/api/$d"
  fi
done
for b in middleware.ts middleware.js proxy.ts proxy.js; do
  if [ -f "$HOLD/$b" ] && [ ! -f "src/$b" ]; then mv "$HOLD/$b" "src/$b"; echo "[restore] src/$b"; fi
done
rmdir "$HOLD/api-routes" "$HOLD" 2>/dev/null

n=$(find src/app/api -name route.ts | wc -l | tr -d ' ')
echo "[restore] route.ts $n 개"
if [ "$n" -lt 20 ]; then
  echo "[restore] 치명 — 라우트가 20개 미만입니다. git status 확인 후 커밋하지 마세요."
  exit 2
fi
