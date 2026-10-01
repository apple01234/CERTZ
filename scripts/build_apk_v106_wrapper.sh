#!/bin/bash
# v1.0.6 APK 빌드 래퍼 — 사망 시 자동 재시도 (최대 3회), 성공 시 DONE 마커
JAVA_HOME=/home/z/jdk
ANDROID_HOME=/home/z/.android-sdk
export JAVA_HOME ANDROID_HOME
STATUS=/home/z/my-project/apk_build_v106.status
echo "RUNNING $(date '+%F %T')" > "$STATUS"
for i in 1 2 3; do
  echo "=== ATTEMPT $i $(date '+%F %T') ===" >> /home/z/my-project/apk_build_v106.log
  bash /home/z/my-project/scripts/build_apk.sh >> /home/z/my-project/apk_build_v106.log 2>&1
  RC=$?
  if [ $RC -eq 0 ] && [ -f /home/z/my-project/download/SERTZ-v1.0.6.apk ]; then
    echo "DONE attempt=$i $(date '+%F %T')" > "$STATUS"
    exit 0
  fi
  echo "RETRY attempt=$i rc=$RC $(date '+%F %T')" >> /home/z/my-project/apk_build_v106.log
  sleep 5
done
echo "FAILED $(date '+%F %T')" > "$STATUS"
exit 1
