#!/bin/bash

set -euo pipefail

# v2.7 — 부팅 시 프로덕션 게임 서버(socket.io 포함)를 띄운다.
#  이전: bun run dev(개발 서버) — 리빌드 지연/불안정. 현재: node server.js(standalone + socket.io).
#  이 스크립트는 /start.sh(부팅 트리)에서 백그라운드 서브셸로 실행되므로
#  여기서 foreground로 서버를 띄우면 컨테이너 수명 내내 살아있는다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

log_step_start() {
        local step_name="$1"
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: $step_name"
        echo "=========================================="
        export STEP_START_TIME
        STEP_START_TIME=$(date +%s)
}

log_step_end() {
        local step_name="${1:-Unknown step}"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - STEP_START_TIME))
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: $step_name"
        echo "[LOG] Step: $step_name | Duration: ${duration}s"
        echo "=========================================="
        echo ""
}

wait_for_service() {
        local host="$1"
        local port="$2"
        local service_name="$3"
        local max_attempts="${4:-90}"
        local attempt=1

        echo "Waiting for $service_name to be ready on $host:$port..."

        while [ "$attempt" -le "$max_attempts" ]; do
                if curl -s --connect-timeout 2 --max-time 5 "http://$host:$port" >/dev/null 2>&1; then
                        echo "$service_name is ready!"
                        return 0
                fi

                echo "Attempt $attempt/$max_attempts: $service_name not ready yet, waiting..."
                sleep 1
                attempt=$((attempt + 1))
        done

        echo "ERROR: $service_name failed to start within $max_attempts seconds"
        return 1
}

log_step_start "Dependencies"
if [ ! -d node_modules ]; then
        echo "[INIT] node_modules 없음 — bun install 실행"
        bun install
else
        echo "[INIT] node_modules 존재 — 설치 생략"
fi
log_step_end "Dependencies"

log_step_start "Database setup"
bun run db:push || echo "[WARN] db:push 실패 — 게임은 로컬 세이브로 계속 동작"
log_step_end "Database setup"

log_step_start "Production build"
if [ ! -f .next/BUILD_ID ]; then
        echo "[INIT] .next 빌드물 없음 — next build 실행 (수 분 소요)"
        npx next build
else
        echo "[INIT] .next 빌드물 존재 — 빌드 생략"
fi
log_step_end "Production build"

log_step_start "Starting SERTZ production server"
echo "[SRV] NODE_ENV=production node server.js (socket.io 멀티플레이 포함)"
NODE_ENV=production PORT=3000 node server.js >> server-prod.log 2>&1 &
SRV_PID=$!
echo "[SRV] 서버 PID: $SRV_PID"
log_step_end "Starting SERTZ production server"

log_step_start "Server health check"
wait_for_service "localhost" "3000" "SERTZ game server" || {
        echo "[SRV] 헬스체크 실패 — server-prod.log 확인"
        tail -20 server-prod.log || true
}
log_step_end "Server health check"

start_mini_services() {
        local mini_services_dir="$PROJECT_DIR/mini-services"
        if [ ! -d "$mini_services_dir" ]; then
                return 0
        fi
        for service_dir in "$mini_services_dir"/*; do
                [ -f "$service_dir/package.json" ] || continue
                grep -q '"dev"' "$service_dir/package.json" || continue
                (
                        cd "$service_dir"
                        bun install
                        exec bun run dev
                ) >"$PROJECT_DIR/.zscripts/mini-service-$(basename "$service_dir").log" 2>&1 &
                disown $! 2>/dev/null || true
        done
}
start_mini_services

echo "[SRV] SERTZ 서버 부팅 완료 — http://localhost:3000"
# 무한 감독 루프 — 서버가 죽으면 3초 뒤 재기동 (부팅 트리 내에서 영구 유지)
while true; do
        if ! kill -0 "$SRV_PID" 2>/dev/null; then
                echo "[SRV] $(date '+%F %T') 서버 종료 감지 — 재기동" >> server-prod.log
                NODE_ENV=production PORT=3000 node server.js >> server-prod.log 2>&1 &
                SRV_PID=$!
        fi
        sleep 15
done
