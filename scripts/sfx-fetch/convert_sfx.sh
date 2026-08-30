#!/bin/bash
# 다운로드한 SFX(mp3) → 게임용 OGG 변환
#  - 44.1kHz 통일, libvorbis q4 (APK 사이즈 최적화)
#  - 지나치게 긴 원본은 게임 연출 길이에 맞춰 트리밍 + 페이드아웃
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

# --- 원본 그대로 ---
conv sfx_swing   0 0
conv sfx_hit     0 0
conv sfx_crit    0 0
conv sfx_dash    0 0
conv sfx_portal  0 0
conv sfx_pickup  0 0
conv sfx_coin    0 0
conv sfx_hurt    0 0
conv sfx_levelup 0 0
conv sfx_upgradeOk 0 0
conv sfx_quest   0 0
conv sfx_roar    0 0          # 보스 등장 — 배너/대사 연출과 함께 재생되므로 유지
conv sfx_bossdie 0 0          # 보스 사망 대폭발 연출용 유지

# --- 게임 연출 길이에 맞춘 트리밍 ---
conv sfx_spin        1.5 1.2   # 회전베기 모션 ~250ms — 여운 1.5s
conv sfx_equip       1.4 1.1   # 갑옷 장착 '딸깍' 부분
conv sfx_potion      2.6 2.2   # 회복 마법 여운
conv sfx_die         2.2 1.8   # 몬스터 사망 — 짧고 명확하게
conv sfx_upgradeFail 0.8 0.5   # 24초 부저 원본 → 앞 '빠아앙'만

echo "=== 완료 ==="
