#!/bin/bash
# v3.0.23 — 잔여 130s 트랙 재인코딩 (make_fixed_loops.py와 동일 필터, 목록 기반)
set -u
CAP=205
for key in "$@"; do
  src="scripts/bgm_work/raw/${key}.mp3"
  dst="public/assets/audio/${key}.ogg"
  ffmpeg -y -loglevel error -i "$src" \
    -af "loudnorm=I=-18:TP=-1.5:LRA=11,adelay=200|200,apad=whole_dur=${CAP},afade=t=in:st=0:d=0.35,atrim=0:${CAP},afade=t=out:st=202.50:d=2.5" \
    -c:a libvorbis -q:a 1 "$dst" && echo "OK $key $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")"
done
echo "BATCH DONE"
