#!/usr/bin/env bash
# stage-electron-game.sh — EXE 빌드용 웹 산출물 스테이징 (vc205, 감사 #16)
#
# 왜 필요한가
#   electron-builder 는 `electron/game/**` 을 패키징한다. 그 폴더는 `.next-apk`
#   (정적 export)를 복사한 것이고 git 에 추적되지 않는다(.gitignore).
#   종전엔 이 복사를 **손으로** 했다: 이전 폴더를 game.old 로 옮기고 cp -a.
#   그러다 293MB 잔여물이 남거나, 오래된 빌드를 패키징하는 사고가 났다.
#
# 이 스크립트가 하는 일
#   1) APK 와 동일한 정적 export 를 만든다 (APK_EXPORT=1 next build)
#      · output:export 비호환 라우트·middleware 를 임시 격리하고 trap EXIT 로 복원
#   2) electron/game 을 깨끗이 비우고 새 산출물로 교체
#   3) game.old 같은 임시 폴더를 남기지 않는다
#   4) index.html 존재를 확인하고, 없으면 실패
#
# 사용
#   bash scripts/stage-electron-game.sh
#   cd electron && npx electron-builder --win nsis --x64
#
# 주의
#   Linux(aarch64)에서는 electron-builder 의 NSIS 타깃을 만들 수 없다(wine 없음).
#   실제 EXE 는 .github/workflows/exe-build.yml (windows-latest)에서 만든다.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

HOLD="$ROOT/.apk-hold"
GAME="$ROOT/electron/game"
ROUTE_DIRS="admin auth market rank support chat party"

restore() {
  for d in $ROUTE_DIRS; do
    if [ -d "$HOLD/api-routes/$d" ]; then mv "$HOLD/api-routes/$d" "$ROOT/src/app/api/$d"; fi
  done
  for rf in route.ts; do
    if [ -f "$HOLD/api-routes/$rf" ]; then mv "$HOLD/api-routes/$rf" "$ROOT/src/app/api/$rf"; fi
  done
  for f in middleware.ts middleware.js proxy.ts proxy.js; do
    if [ -f "$HOLD/$f" ]; then mv "$HOLD/$f" "$ROOT/src/$f"; fi
  done
}
trap restore EXIT

echo "[1/4] 정적 export 라우트 격리"
mkdir -p "$HOLD/api-routes"
for d in $ROUTE_DIRS; do
  if [ -d "src/app/api/$d" ]; then mv "src/app/api/$d" "$HOLD/api-routes/"; fi
done
for rf in route.ts; do
  if [ -f "src/app/api/$rf" ]; then mv "src/app/api/$rf" "$HOLD/api-routes/$rf"; fi
done
for f in src/middleware.ts src/middleware.js src/proxy.ts src/proxy.js; do
  if [ -f "$f" ]; then mv "$f" "$HOLD/"; fi
done

echo "[2/4] 정적 export 빌드 (.next-apk)"
rm -rf .next-apk
APK_EXPORT=1 npx next build

echo "[3/4] electron/game 교체 (임시 폴더 남기지 않음)"
test -f .next-apk/index.html || { echo "  export 실패 — .next-apk/index.html 없음"; exit 1; }
rm -rf "$GAME"
mkdir -p "$GAME"
cp -a .next-apk/. "$GAME"/
test -f "$GAME/index.html" || { echo "  복사 실패 — game/index.html 없음"; exit 1; }

echo "[4/4] 확인"
du -sh "$GAME"
echo "  index.html: $(stat -c %s "$GAME/index.html") bytes"
echo "  완료 — electron/game 스테이징됨 (git 미추적)"
