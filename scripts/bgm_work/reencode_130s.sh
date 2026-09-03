#!/bin/bash
# v3.0.23 최종 규격 — 130초 캡 (메모리 안전: v3.0.21/22 검증 프로파일)
# 205초본은 PCM 디코딩 ~1.4GB로 브라우저/웹뷰 크래시 확인("Target crashed").
# 이미 loudnorm 적용된 ogg를 소스로 사용(정규화 유지) — 페이드 인/아웃만 적용해 루프 이음새 부드럽게.
set -u
cd /home/z/my-project
for f in public/assets/audio/bgm_*.ogg; do
  key=$(basename "$f" .ogg)
  tmp="public/assets/audio/${key}.tmp.ogg"
  ffmpeg -y -loglevel error -i "$f" \
    -af "afade=t=in:st=0:d=0.35,atrim=0:130,afade=t=out:st=127.50:d=2.5" \
    -c:a libvorbis -q:a 1 "$tmp" && mv "$tmp" "$f" && \
    echo "OK $key $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
echo "ALL DONE"
