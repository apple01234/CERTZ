#!/bin/bash
# 업로드 에셋 팩 전체 추출 — 팩당 100초 타임아웃, 실패 기록 후 계속
cd /home/z/my-project/upload
mkdir -p extracted
LOG=/home/z/my-project/upload/extract.log
: > "$LOG"
for z in *.zip; do
  d="extracted/${z%.zip}"
  if [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    echo "SKIP $z" >> "$LOG"; continue
  fi
  mkdir -p "$d"
  if timeout 100 unzip -qo "$z" -d "$d" 2>>"$LOG"; then
    echo "OK   $z" >> "$LOG"
  else
    echo "FAIL $z" >> "$LOG"
  fi
done
echo "=== DONE ===" >> "$LOG"
du -sh extracted/* | sort -rh | head -30 >> "$LOG"
