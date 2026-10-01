#!/bin/sh
# SERTZ 웹 서버 감독자 — 프로세스가 죽으면 2초 뒤 재기동 (port 3000)
cd /home/z/my-project
while true; do
  # v1.0.3 — GM(관리자) 아이디: 쉼표 구분. 이 아이디로 가입/로그인하면 마을에 GM NPC 등장 (미설정 시 accounts 기본값 사용)
  NODE_ENV=production PORT=3000 SERTZ_ADMIN_USERS="${SERTZ_ADMIN_USERS:-admin,apple01234}" node server.js >> server-prod.log 2>&1
  echo "[supervisor] $(date '+%F %T') 서버 종료 감지 — 2초 후 재기동" >> server-prod.log
  sleep 2
done
