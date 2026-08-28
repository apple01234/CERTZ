#!/usr/bin/env bash
# ============================================================================
# loop/loop.sh — 자율 개발 루프 본체
#
# 요구사양 (그대로 구현):
#   1. 무한 반복. 한 바퀴마다 헤드리스 세션을 "새로" 연다. 대화를 이어붙이지 않는다.
#   2. 세션에는 loop/PROMPT.md 를 읽고 일하라고 준다.
#   3. 한 바퀴마다 logs/ 에 날짜별 로그를 남긴다.
#   4. loop/STOP 파일이 있으면 현재 바퀴를 마치고 멈춘다.
#   5. 설정은 loop/env.sh 로 분리 (모델 / 최대 턴 / 바퀴 사이 대기 / 최대 바퀴 수)
#
# ⚠ 주의: 이 스크립트를 터미널에서 직접 실행하면 그 터미널/창에 묶이고,
#          창을 닫으면 같이 죽는다. 평소에는 loop/loopctl.sh 로 켜고 끈다.
#          (systemd 등록 시: 창을 닫아도, 재부팅해도 돌고, 비정상 종료면 재시작)
#
# 스모크 테스트(에이전트 없이 기계장치만 검증):
#   LOOP_STUB=1 MAX_CYCLES=2 CYCLE_WAIT_SEC=2 bash loop/loop.sh
# ============================================================================
set -u

LOOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$LOOP_DIR/.." && pwd)"
ENV_FILE="$LOOP_DIR/env.sh"
PROMPT_FILE="$LOOP_DIR/PROMPT.md"
STOP_FILE="$LOOP_DIR/STOP"
LOCK_FILE="$LOOP_DIR/loop.lock"
PID_FILE="$LOOP_DIR/loop.pid"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

# ── 설정 로드 ──────────────────────────────────────────────────────────────
# shellcheck source=env.sh
source "$ENV_FILE"

# ── 유틸 ───────────────────────────────────────────────────────────────────
today_log() { printf '%s/%s.log' "$LOG_DIR" "$(date '+%F')"; }

log() {  # 콘솔(stdout → systemd journal / nohup 파일)과 오늘 로그 파일 양쪽에 기록
  local line
  line="[$(date '+%F %T')] $*"
  echo "$line"
  echo "$line" >> "$(today_log)"
}

# ── 단일 인스턴스 보장 (이중 실행 방지) ────────────────────────────────────
exec 9>"$LOCK_FILE"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { echo "[loop] 이미 루프가 실행 중이다 — 이중 실행하지 않는다. (확인: loop/loopctl.sh status)"; exit 1; }
fi
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

# ── 시그널 처리: 종료 요청 시 진행 중 세션까지 정리하고 비정상 종료로 나간다 ──
AGENT_PID=""
on_signal() {
  log "시그널 수신 — 진행 중 세션을 정리하고 종료한다."
  [ -n "$AGENT_PID" ] && kill "$AGENT_PID" 2>/dev/null
  exit 143
}
trap on_signal INT TERM

# ── 스모크 테스트 모드 (LOOP_STUB=1): 실제 에이전트 대신 스텁이 돈다 ────────
if [ "${LOOP_STUB:-0}" = "1" ]; then
  run_agent_session() {
    local prompt_file="$1"
    echo "[STUB] 실제 에이전트 대신 스텁 세션이 돌고 있다 (LOOP_STUB=1)"
    echo "[STUB] 새 세션으로 '$prompt_file' ($(wc -l < "$prompt_file") 줄) 읽고 일했다 친다."
    echo "[STUB] (1)읽기 → (2)하나만 만들기 → (3)실행해서 눈으로 확인 → (4)커밋 → (5)STATUS 갱신 ... 시뮬레이션"
    sleep 2
    echo "[STUB] 한 바퀴 작업 시뮬레이션 완료."
    return 0
  }
fi

# ── 한 바퀴: 새 세션을 열고 로그를 남긴다 ──────────────────────────────────
run_cycle() {
  local n="$1"
  local f rc started elapsed
  f="$(today_log)"
  started=$(date +%s)
  {
    echo ""
    echo "============================================================"
    echo " 바퀴 ${n} 시작 — $(date '+%F %T')"
    echo " · 세션 새로 열림 (대화 이어붙임 없음) · 프롬프트: loop/PROMPT.md"
    [ "${LOOP_STUB:-0}" = "1" ] && echo " · [스모크 테스트 모드: LOOP_STUB=1]"
    echo "============================================================"
  } >> "$f"

  run_agent_session "$PROMPT_FILE" >> "$f" 2>&1 &
  AGENT_PID=$!
  wait "$AGENT_PID"
  rc=$?
  AGENT_PID=""

  elapsed=$(( $(date +%s) - started ))
  {
    echo "------------------------------------------------------------"
    printf ' 바퀴 %d 종료 — 종료코드 %d · 소요 %d분 %d초\n' "$n" "$rc" $((elapsed/60)) $((elapsed%60))
    echo "------------------------------------------------------------"
  } >> "$f"
  return "$rc"
}

# ── 바퀴 사이 대기 (1초 단위로 STOP 감시 — stop이 최대 1초 안에 반응) ───────
wait_between_cycles() {
  [ "${CYCLE_WAIT_SEC:-60}" -le 0 ] && return 0
  local waited=0
  while [ "$waited" -lt "$CYCLE_WAIT_SEC" ]; do
    [ -f "$STOP_FILE" ] && return 1
    sleep 1
    waited=$((waited+1))
  done
  return 0
}

# ── 시작 전 확인 ───────────────────────────────────────────────────────────
if [ ! -f "$PROMPT_FILE" ]; then
  echo "[loop] $PROMPT_FILE 이(가) 없다 — 지시서 없이는 돌지 않는다." >&2
  exit 1
fi

if [ -f "$STOP_FILE" ]; then
  log "STOP 파일이 있다 ($STOP_FILE) — 시작하지 않는다. 켜려면: ./loop/loopctl.sh start"
  exit 0
fi

# ── 메인 루프 ──────────────────────────────────────────────────────────────
log "루프 시작 — 루트: $ROOT_DIR | 모델: ${AGENT_MODEL:-기본값} | 최대 턴: $MAX_TURNS | 바퀴 대기: ${CYCLE_WAIT_SEC}s | 최대 바퀴: ${MAX_CYCLES:-0(무한)}"
cycle=0
while :; do
  if [ -f "$STOP_FILE" ]; then
    log "STOP 파일 발견 — 새 바퀴를 열지 않고 멈춘다."
    exit 0
  fi
  cycle=$((cycle+1))
  if [ "${MAX_CYCLES:-0}" -gt 0 ] && [ "$cycle" -gt "$MAX_CYCLES" ]; then
    log "최대 바퀴 수(${MAX_CYCLES}) 도달 — 정상 종료한다. (다시 켜려면: ./loop/loopctl.sh start)"
    exit 0
  fi

  log "바퀴 $cycle 시작"
  run_cycle "$cycle"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    log "바퀴 $cycle 정상 종료"
  else
    log "바퀴 $cycle 비정상 종료(종료코드 $rc) — 다음 바퀴의 새 세션이 docs/STATUS.md 와 커밋 기준으로 이어받는다."
  fi

  if [ -f "$STOP_FILE" ]; then
    log "현재 바퀴를 마쳤고 STOP 이 있으므로 여기서 멈춘다."
    exit 0
  fi

  if wait_between_cycles; then :; else
    log "대기 중 STOP 감지 — 멈춘다."
    exit 0
  fi
done
