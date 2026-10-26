#!/usr/bin/env bash
# SERTZ — 정적 export(APK/EXE) 빌드 래퍼
#
# 왜 이 스크립트가 필요한가
#   `output: "export"` 는 서버리스 API 라우트가 남아 있으면 빌드를 실패시킨다
#   (`export const dynamic = "force-static"` 미설정 시). 그래서 APK 빌드는
#   src/app/api/{admin,auth,market,rank,support,chat,party} 를 잠시 .apk-hold/ 로
#   옮겼다가 되돌린다.
#   문제는 그 이동을 **인라인 셸에서** 했다는 점이다. 빌드가 중간에 죽거나
#   사람이 손으로 돌리다 trap 이 안 걸리면 라우트가 격리된 채로 남고,
#   그 상태에서 `git add -A` 를 하면 **삭제가 커밋된다**.
#   실제로 vc187 에서 이 사고가 났고, Vercel 에 /api/auth/* 가 사라져
#   PC·웹 로그인이 전부 404 가 됐다.
#
# 이 스크립트의 보장
#   ① 어떤 경로로 끝나든(성공·실패·Ctrl-C·SIGTERM) 라우트를 되돌린다
#   ② 되돌린 뒤 **개수를 세어** 원래대로인지 확인한다. 다르면 exit 2
#   ③ 빌드 산출물이 없으면 exit 1
#
# 사용
#   bash scripts/static-export.sh            # APK 용 (.next-apk)
#   STATIC_EXPORT=1 bash scripts/static-export.sh   # Vercel 미러용 (out/)
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

ROUTE_DIRS="admin auth market rank support chat party"
MIDDLEWARE_FILES="src/middleware.ts src/middleware.js src/proxy.ts src/proxy.js"
HOLD=".apk-hold"

need=$(printf '%s\n' $ROUTE_DIRS | wc -l | tr -d ' ')
have=$(find src/app/api -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')

if [ -d "$HOLD/api-routes" ]; then
  echo "[static-export] 중단 — $HOLD/api-routes 가 이미 존재합니다."
  echo "  이전 빌드가 라우트를 격리한 채 끝났을 수 있습니다. 먼저 복원하세요:"
  echo "    bash scripts/restore-api-routes.sh"
  exit 3
fi

restore() {
  local rc=$?
  trap - EXIT INT TERM
  for d in $ROUTE_DIRS; do
    if [ -d "$HOLD/api-routes/$d" ]; then mv "$HOLD/api-routes/$d" "src/app/api/$d"; fi
  done
  for f in $MIDDLEWARE_FILES; do
    b=$(basename "$f")
    if [ -f "$HOLD/$b" ]; then mv "$HOLD/$b" "src/$b"; fi
  done
  rmdir "$HOLD/api-routes" "$HOLD" 2>/dev/null

  local now
  now=$(find src/app/api -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  if [ "$now" -ne "$have" ]; then
    echo "[static-export] 치명 — 라우트 복원 실패 ($now / $have). 즉시 확인: git status"
    exit 2
  fi
  echo "[static-export] 라우트 복원 확인 — 디렉터리 $now 개"
  exit $rc
}
trap restore EXIT INT TERM

mkdir -p "$HOLD/api-routes"
for d in $ROUTE_DIRS; do
  if [ -d "src/app/api/$d" ]; then mv "src/app/api/$d" "$HOLD/api-routes/"; fi
done
for f in $MIDDLEWARE_FILES; do
  if [ -f "$f" ]; then mv "$f" "$HOLD/"; fi
done
echo "[static-export] 라우트 격리 — 대상 $need 개"

if [ "${STATIC_EXPORT:-}" = "1" ]; then
  STATIC_EXPORT=1 NODE_OPTIONS=--max-old-space-size=4096 npx next build || exit 1
  test -f out/index.html || { echo "[static-export] out/index.html 없음"; exit 1; }
  echo "[static-export] export OK (out/)"
else
  APK_EXPORT=1 NODE_OPTIONS=--max-old-space-size=4096 npx next build || exit 1
  test -f .next-apk/index.html || { echo "[static-export] .next-apk/index.html 없음"; exit 1; }
  echo "[static-export] export OK (.next-apk/)"
fi
