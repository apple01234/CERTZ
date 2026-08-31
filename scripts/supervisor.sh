#!/bin/sh
# SERTZ 웹 서버 감독자 — 프로세스가 죽으면 2초 뒤 재기동 (port 3000)
cd /home/z/my-project
while true; do
  NODE_ENV=production PORT=3000 node server.js >> server-prod.log 2>&1
  echo "[supervisor] $(date '+%F %T') 서버 종료 감지 — 2초 후 재기동" >> server-prod.log
  sleep 2
done
