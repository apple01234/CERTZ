#!/usr/bin/env bash
# tests/smoke/run.sh — 스모크 3종 러너 (P1-5)
#
# 왜 필요한가
#   WorldScene 16,471줄을 분할하려면 회귀를 자동으로 잡을 안전망이 먼저 있어야 한다.
#   현재 *.test.ts 는 0개이고, 회귀는 사람이 눈으로만 확인하고 있었다.
#
# 무엇을 검증하나
#   boot   : 타이틀 도달, 4xx/5xx 0건(P0-1 회귀 감시), pageerror 0건
#   combat : 월드 진입, 마을 테마(D4) 로드, 적 스폰, 적 HP 감소
#   save   : buildSave 반환, localStorage 기록, 새로고침 복원(좌표·스테이지 일치)
#
# 전제
#   dev 서버가 http://127.0.0.1:3000 에 떠 있어야 한다.
#   서버가 없으면 이 스크립트가 하나 띄우고 끝나면 정리한다.
#
# 사용
#   bash tests/smoke/run.sh            # 3종 전부
#   bash tests/smoke/run.sh combat     # 특정 항목만
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

BASE="${SERTZ_BASE:-http://127.0.0.1:3000}"
TARGETS="${1:-boot combat save}"

started_server=0
if ! curl -s -o /dev/null --max-time 4 "$BASE/"; then
  echo "[smoke] 서버 없음 — 기동합니다"
  node server.js > /tmp/sertz-smoke-server.log 2>&1 &
  started_server=$!
  for _ in $(seq 1 40); do
    sleep 3
    curl -s -o /dev/null --max-time 4 "$BASE/" && break
  done
fi

cleanup() { if [ "$started_server" != "0" ]; then kill "$started_server" 2>/dev/null; fi; }
trap cleanup EXIT

fail=0
for t in $TARGETS; do
  echo ""
  echo "════════ $t ════════"
  if ! node "tests/smoke/$t.js"; then fail=$((fail+1)); echo "[smoke] $t 실패"; fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "[smoke] 전부 통과"
  exit 0
else
  echo "[smoke] $fail 개 실패"
  exit 1
fi
