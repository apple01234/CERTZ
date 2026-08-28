#!/usr/bin/env bash
# ============================================================================
# loop/loopctl.sh — 루프 켜기 / 끄기 / 상태 보기 (한 곳에서 전부)
#
#   ./loop/loopctl.sh start       켜기 — STOP 제거 + systemd 등록·시작(재부팅 후에도 자동)
#   ./loop/loopctl.sh stop        부드럽게 끄기 — 현재 바퀴까지 마치고 멈춤 (STOP 파일 생성)
#   ./loop/loopctl.sh hardstop    즉시 끄기 — 진행 중 세션 포함 강제 종료
#   ./loop/loopctl.sh status      상태 보기 — 실행 여부 + STOP 상태 + 오늘 로그 요약
#   ./loop/loopctl.sh restart     즉시 끄고 다시 켜기
#   ./loop/loopctl.sh test [N]    스텁으로 N바퀴(기본 2) 스모크 테스트 (전경에서 실행)
#   ./loop/loopctl.sh log         오늘(또는 최근) 로그 실시간 보기
#
# systemd 사용자 세션이 있으면 유닛을 설치·등록하고,
# 없으면(컨테이너 등) nohup 백그라운드로 폴백한다 (재부팅 자동 시작은 systemd 환경 전용).
# ============================================================================
set -u

LOOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$LOOP_DIR/.." && pwd)"
STOP_FILE="$LOOP_DIR/STOP"
PID_FILE="$LOOP_DIR/loop.pid"
LOG_DIR="$ROOT_DIR/logs"
UNIT_SRC="$LOOP_DIR/systemd/sertz-loop.service.in"
UNIT_DST="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/sertz-loop.service"
UNIT_NAME="sertz-loop.service"

have() { command -v "$1" >/dev/null 2>&1; }

systemd_available() {
  have systemctl || return 1
  systemctl --user show-environment >/dev/null 2>&1
}

latest_log() {
  local t
  t="$LOG_DIR/$(date '+%F').log"
  [ -f "$t" ] && { echo "$t"; return; }
  ls -1 "$LOG_DIR"/*.log 2>/dev/null | tail -n 1
}

pid_alive() {
  [ -f "$PID_FILE" ] || return 1
  local p
  p="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$p" ] && kill -0 "$p" 2>/dev/null
}

install_unit() {
  [ -f "$UNIT_SRC" ] || { echo "유닛 템플릿이 없다: $UNIT_SRC"; return 1; }
  mkdir -p "$(dirname "$UNIT_DST")"
  # 설치 시점에 실제 에이전트/노드 경로를 찾아 PATH 에 박아 넣는다 (자동 실행은 터미널 PATH 를 못 받는다)
  local extra_path=""
  local b p
  for b in claude gemini codex aider node npm git bun; do
    p="$(command -v "$b" 2>/dev/null || true)"
    [ -n "$p" ] && extra_path="$extra_path:$(dirname "$p")"
  done
  sed -e "s|@ROOT@|$ROOT_DIR|g" \
      -e "s|@HOME@|$HOME|g" \
      -e "s|@EXTRA_PATH@|$extra_path|g" \
      "$UNIT_SRC" > "$UNIT_DST"
  systemctl --user daemon-reload
  echo "유닛 설치 완료: $UNIT_DST"
}

cmd_start() {
  mkdir -p "$LOG_DIR"
  rm -f "$STOP_FILE"
  if systemd_available; then
    install_unit || return 1
    systemctl --user enable --now "$UNIT_NAME"   # 로그인 시 자동 시작 등록 + 지금 켬
    have loginctl && loginctl enable-linger "$USER" >/dev/null 2>&1 || true  # 로그인 전(재부팅 직후)에도 돌게
    echo "켰다 (systemd). 상태: systemctl --user status $UNIT_NAME"
  else
    if pid_alive; then
      echo "이미 실행 중이다 (PID $(cat "$PID_FILE"))."
      return 0
    fi
    echo "systemd 사용자 세션이 없어 nohup 백그라운드로 켠다. (재부팅 자동 시작은 systemd 환경에서만 가능)"
    nohup bash "$LOOP_DIR/loop.sh" >> "$LOG_DIR/loop-console.log" 2>&1 &
    echo "PID $! — 로그: $LOG_DIR/loop-console.log"
  fi
}

cmd_stop() {
  touch "$STOP_FILE"
  echo "STOP 파일을 만들었다: 현재 바퀴를 마치면 멈춘다 (진행 중인 바퀴는 끝까지 수행)."
  echo "즉시 끄려면: ./loop/loopctl.sh hardstop"
}

cmd_hardstop() {
  touch "$STOP_FILE"   # 다음 로그인/재부팅 때도 켜지지 않게 꺼짐 스위치를 남긴다
  if systemd_available && systemctl --user is-active --quiet "$UNIT_NAME" 2>/dev/null; then
    systemctl --user stop "$UNIT_NAME"
    echo "즉시 종료했다 (systemd stop)."
  elif pid_alive; then
    local p
    p="$(cat "$PID_FILE")"
    kill "$p" 2>/dev/null
    sleep 1
    kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null
    echo "즉시 종료했다 (PID $p)."
  else
    echo "실행 중인 루프가 없다."
  fi
}

cmd_status() {
  echo "── 루프 상태 ($(date '+%F %T')) ─────────────────────────"
  if systemd_available; then
    local st
    st="$(systemctl --user is-active "$UNIT_NAME" 2>/dev/null || echo inactive)"
    echo " systemd 유닛 : $st ($UNIT_NAME)"
    st="$(systemctl --user is-enabled "$UNIT_NAME" 2>/dev/null || echo disabled)"
    echo " 로그인 자동시작: $st"
  else
    echo " systemd      : 사용 불가 (nohup 폴백 모드)"
  fi
  if pid_alive; then
    echo " 프로세스     : 실행 중 (PID $(cat "$PID_FILE"))"
  else
    echo " 프로세스     : 없음"
  fi
  if [ -f "$STOP_FILE" ]; then
    echo " STOP 스위치  : ON — 다음 바퀴에서 멈춤 / 새로 못 켬 (start 가 제거함)"
  else
    echo " STOP 스위치  : OFF — 정상 가동 가능"
  fi
  local lf
  lf="$(latest_log)"
  if [ -n "$lf" ] && [ -f "$lf" ]; then
    local n
    n="$(rg -c "^\[[0-9: -]+\] 바퀴 [0-9]+ 시작" "$lf" 2>/dev/null || echo 0)"
    echo " 오늘 로그    : $lf (바퀴 ${n}회 기록)"
    echo "── 최근 로그 15줄 ─────────────────────────────────────"
    tail -n 15 "$lf"
  else
    echo " 로그         : 아직 없음 ($LOG_DIR/)"
  fi
}

cmd_restart() {
  cmd_hardstop >/dev/null 2>&1
  sleep 1
  cmd_start
}

cmd_test() {
  local n="${1:-2}"
  rm -f "$STOP_FILE"
  echo "[test] 스텁으로 $n 바퀴 스모크 테스트 (실제 에이전트 호출 없음)..."
  LOOP_STUB=1 MAX_CYCLES="$n" CYCLE_WAIT_SEC=2 bash "$LOOP_DIR/loop.sh"
  echo "[test] 완료. 로그:"
  tail -n 30 "$(latest_log)" 2>/dev/null
}

cmd_log() {
  local lf
  lf="$(latest_log)"
  [ -z "$lf" ] || [ ! -f "$lf" ] && { echo "로그가 아직 없다."; return 0; }
  echo "tail -f: $lf  (끝내려면 Ctrl+C)"
  tail -n 40 -f "$lf"
}

case "${1:-}" in
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  hardstop) cmd_hardstop ;;
  status)   cmd_status ;;
  restart)  cmd_restart ;;
  test)     shift; cmd_test "${1:-2}" ;;
  log)      cmd_log ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
