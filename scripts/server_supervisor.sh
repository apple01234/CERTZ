#!/bin/bash
# v1.0.8 — 서버 감독자: 리스너가 죽으면 3초 내 재기동 (컨테이너의 백그라운드 사일런트 사망 대응)
cd /home/z/my-project
while true; do
  if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/; then
    echo "[supervisor] $(date +%H:%M:%S) 서버 응답 없음 → 재기동" >> /tmp/supervisor.log
    pkill -9 -f "node server.js" 2>/dev/null
    sleep 1
    NODE_ENV=production SERTZ_ADMIN_USERS=admin,apple01234 nohup node server.js >> /tmp/sertz_server.log 2>&1 &
  fi
  sleep 3
done
