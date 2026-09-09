#!/bin/bash
# 포어그라운드 서버 + 자기 감시: 리스너 없어지면 스스로 재기동 (단일 세션 유지)
cd /home/z/my-project
export NODE_ENV=production SERTZ_ADMIN_USERS=admin,apple01234
while true; do
  node server.js >> /tmp/sertz_server.log 2>&1 &
  SRV=$!
  # 최대 300초 감시 — 죽거나 리스너 잃으면 재기동
  for i in $(seq 1 100); do
    sleep 3
    if ! kill -0 $SRV 2>/dev/null; then break; fi
    if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/; then
      echo "[keep] $(date +%H:%M:%S) 리스너 소실 → kill 후 재기동" >> /tmp/supervisor.log
      kill -9 $SRV 2>/dev/null
      break
    fi
  done
done
