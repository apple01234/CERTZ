#!/bin/bash
# v3.0.24 — 스킬 SFX(mp3) → 게임용 OGG 변환 (44.1kHz · libvorbis q4 · 긴 원본 트리밍+페이드아웃)
set -e
cd /home/z/my-project/scripts/sfx-fetch/dl
OUT=/home/z/my-project/public/assets/audio
mkdir -p "$OUT"

conv() { # 이름, 길이제한(0=원본), 페이드시작(0=없음)
  local n="$1" t="$2" fs="$3"
  if [ "$t" != "0" ]; then
    if [ "$fs" != "0" ]; then
      ffmpeg -y -v error -i "$n.mp3" -t "$t" -af "afade=t=out:st=$fs:d=$(python3 -c "print($t-$fs)")" -ar 44100 -c:a libvorbis -q:a 4 "$OUT/$n.ogg"
    else
      ffmpeg -y -v error -i "$n.mp3" -t "$t" -ar 44100 -c:a libvorbis -q:a 4 "$OUT/$n.ogg"
    fi
  else
    ffmpeg -y -v error -i "$n.mp3" -ar 44100 -c:a libvorbis -q:a 4 "$OUT/$n.ogg"
  fi
  echo "$n.ogg: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$n.ogg")s $(stat -c%s "$OUT/$n.ogg")B"
}

# --- 원본 그대로 (짧은 타격/시전음) ---
conv skl_arrow1       0 0
conv skl_cast1        0 0
conv skl_knife1       0 0
conv skl_flame1       0 0
conv skl_electron1    0 0
conv skl_arrowpierce1 0 0
conv skl_wind1        0 0
conv skl_iainuki1     0 0
conv skl_sword3       0 0
conv skl_ambush1      0 0
conv skl_thunder2     0 0
conv skl_chain4       0 0
conv skl_gravity1     0 0
conv skl_bigsword1    0 0
conv skl_timestop1    0 0
conv skl_superhit1    0 0

# --- 게임 연출 길이에 맞춘 트리밍 ---
conv skl_cure2      2.6 2.2    # 정화의 파동 — 여운 정리
conv skl_quake1     2.4 2.0    # 성벽 강타 지진
conv skl_dark1      2.2 1.8    # 암흑 마법
conv skl_heavydash1 2.0 1.6    # 중장 돌진
conv skl_wind2      2.6 2.2    # 질풍
conv skl_holy1      2.8 2.4    # 신성 폭발
conv skl_slowmo1    3.2 2.8    # 시간 왜곡
conv skl_rage1      2.6 2.2    # 피의 격노
conv skl_warcry1    2.6 2.2    # 전장의 함성
conv skl_manaburst1 2.4 2.0    # 마나 붕괴
conv skl_skyflight1 3.4 3.0    # 천공의 폭풍

echo "=== 완료 ==="
