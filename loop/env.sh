#!/usr/bin/env bash
# ============================================================================
# loop/env.sh — 자율 개발 루프 설정
#
# "이 파일만 고친다. loop.sh는 건드리지 않는다."
# loop.sh가 source 한다. 값은 환경변수로 덮어쓸 수 있다 (테스트에 유용).
#   예: MAX_CYCLES=2 CYCLE_WAIT_SEC=2 bash loop/loop.sh
# ============================================================================

# ── 에이전트 실행 방법 ─────────────────────────────────────────────────────
# 한 바퀴마다 "새" 헤드리스 세션으로 실행된다.
# 대화를 이어붙이는 옵션(--continue / --resume / 세션ID 재사용)은 절대 넣지 않는다.
#   → 이전 바퀴와 이어지면 파일 기억(docs/)이 무의미해지고 메모리가 부풀어 터진다.
AGENT_BIN="${AGENT_BIN:-claude}"                 # 헤드리스 실행 파일명 (claude / gemini / codex / aider ...)
AGENT_MODEL="${AGENT_MODEL:-}"                   # 모델. 예: sonnet / opus (빈 값 = CLI 기본값)
AGENT_EXTRA_ARGS="${AGENT_EXTRA_ARGS:---dangerously-skip-permissions}"  # 헤드리스 자율 작업 인자 (권한 확인 프롬프트로 멈추지 않게)

# ── 루프 동작 ──────────────────────────────────────────────────────────────
MAX_TURNS="${MAX_TURNS:-40}"          # 한 바퀴 최대 턴 수 (0 = 제한 없음). 에이전트가 지원하면 --max-turns 로 전달
CYCLE_WAIT_SEC="${CYCLE_WAIT_SEC:-60}" # 바퀴 사이 대기(초). STOP 파일을 1초 단위로 감시하며 대기
MAX_CYCLES="${MAX_CYCLES:-0}"         # 최대 바퀴 수 (0 = 무한). 도달하면 정상 종료

# ── 세션 실행 함수 ─────────────────────────────────────────────────────────
# PROMPT.md 를 표준입력으로 넣고, 표준출력/에러는 loop.sh가 logs/날짜.log 로 흘려보낸다.
# 다른 CLI 에이전트로 바꾸려면 이 함수만 고치면 된다.
run_agent_session() {
  local prompt_file="$1"
  local args=(-p)                                  # -p = print/headless 모드 (새 세션, 대화 이어붙임 없음)
  [ -n "$AGENT_MODEL" ] && args+=(--model "$AGENT_MODEL")
  [ "${MAX_TURNS:-0}" -gt 0 ] 2>/dev/null && args+=(--max-turns "$MAX_TURNS")
  # shellcheck disable=SC2086  # 의도적으로 단어 분리 (여러 인자 나열용)
  [ -n "$AGENT_EXTRA_ARGS" ] && args+=($AGENT_EXTRA_ARGS)
  "$AGENT_BIN" "${args[@]}" < "$prompt_file"
}
