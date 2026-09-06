#!/bin/bash
# gofile + pixeldrain 동시 업로드 (APK 재배포용)
# 결과를 /tmp/upload_result_gofile.txt / /tmp/upload_result_pixeldrain.txt 에 기록

APK="/home/z/my-project/download/SERTZ-v3.1.0.apk"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# ---------- gofile ----------
upload_gofile() {
  echo "[$(date +%T)] gofile: 서버 목록 조회" > /tmp/upload_result_gofile.txt
  SRV=$(curl -s --max-time 20 "https://api.gofile.io/servers?wt=mc9ncj" | python3 -c "
import sys, json
d = json.load(sys.stdin)
servers = d.get('data', {}).get('servers', d.get('data', []))
print(servers[0]['name'] if servers else '')
" 2>/dev/null)
  if [ -z "$SRV" ]; then
    echo "gofile: 서버 조회 실패" >> /tmp/upload_result_gofile.txt
    return 1
  fi
  echo "[$(date +%T)] gofile: 서버=$SRV 업로드 시작 (140MB)" >> /tmp/upload_result_gofile.txt
  RESP=$(curl -s --max-time 900 -A "$UA" \
    -F "file=@${APK};filename=SERTZ-v3.1.0.apk;type=application/zip" \
    "https://${SRV}.gofile.io/contents/uploadfile")
  echo "$RESP" > /tmp/gofile_upload_resp.json
  PAGE=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('data', {}).get('downloadPage', ''))
except:
    print('')
" 2>/dev/null)
  if [ -n "$PAGE" ]; then
    echo "[$(date +%T)] gofile: 성공 → $PAGE" >> /tmp/upload_result_gofile.txt
  else
    echo "[$(date +%T)] gofile: 실패 → ${RESP:0:300}" >> /tmp/upload_result_gofile.txt
  fi
}

# ---------- pixeldrain ----------
upload_pixeldrain() {
  echo "[$(date +%T)] pixeldrain: 업로드 시작 (140MB)" > /tmp/upload_result_pixeldrain.txt
  RESP=$(curl -s --max-time 900 -A "$UA" \
    -u ":anonymous" \
    -T "$APK" \
    "https://pixeldrain.com/api/file/SERTZ-v3.1.0.apk")
  echo "$RESP" > /tmp/pixeldrain_upload_resp.json
  ID=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('id', ''))
except:
    print('')
" 2>/dev/null)
  if [ -n "$ID" ]; then
    echo "[$(date +%T)] pixeldrain: 성공 → https://pixeldrain.com/u/$ID" >> /tmp/upload_result_pixeldrain.txt
  else
    echo "[$(date +%T)] pixeldrain: 실패 → ${RESP:0:300}" >> /tmp/upload_result_pixeldrain.txt
  fi
}

upload_gofile &
GOFILE_PID=$!
upload_pixeldrain &
PIXEL_PID=$!
wait $GOFILE_PID $PIXEL_PID
echo "=== 업로드 종료 ==="
cat /tmp/upload_result_gofile.txt
cat /tmp/upload_result_pixeldrain.txt
