#!/bin/bash
# 서버 기동 → 프로브 실행 → 서버 종료 (한 세션 안에서)
cd /home/z/my-project
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
sleep 1
node server.js > /tmp/server_probe.log 2>&1 &
SPID=$!
for i in $(seq 1 20); do
  sleep 1
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then break; fi
done
echo "server ready ($CODE)"
node "$1" 2>&1
RC=$?
kill -9 $SPID 2>/dev/null
wait $SPID 2>/dev/null
exit $RC
