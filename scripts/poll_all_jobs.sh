#!/bin/bash
# Poll all pending loader.to jobs (parallel per job); log progress.
cd /home/z/my-project
FMT=${1:-m4a}
LOG=tmp/music/poll_all.log
echo "=== poll_all(parallel) start $(date)" >> $LOG
for round in $(seq 1 40); do
  PENDING=0
  PIDS=""
  for j in tmp/music/jobs/*_$FMT.json; do
    DONE=$(python3 -c "import json;print(json.load(open('$j')).get('done',False))")
    if [ "$DONE" != "True" ]; then
      PENDING=1
      BASE=$(basename $j .json)
      VID="${BASE%_$FMT}"
      (
        echo "--- poll $BASE round $round $(date +%H:%M:%S)" >> $LOG
        python3 scripts/loader_job.py poll "$VID" "$FMT" >> $LOG 2>&1
      ) &
      PIDS="$PIDS $!"
    fi
  done
  if [ "$PENDING" = "0" ]; then echo "=== ALL DONE $(date)" >> $LOG; break; fi
  # 최대 8분 대기 (다운로드 병렬 완료 기다림)
  wait $PIDS 2>/dev/null
  sleep 20
done
echo "=== poll_all end $(date)" >> $LOG
