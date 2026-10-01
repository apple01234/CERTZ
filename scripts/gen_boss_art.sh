#!/bin/bash
# v1.4.9 — 보스 디자인 리뉴얼: 9종 보스 AI 재생성 (흰 배경 → 후처리로 알파화)
# 산출: scripts/boss_raw/boss_<key>_raw.png (1024x1024)
set -u
RAW=/home/z/my-project/scripts/boss_raw
mkdir -p "$RAW"

STYLE="2D mobile game boss illustration, dark fantasy hand-painted style, bold clean silhouette, dramatic rim lighting, glowing magical energy, single creature centered full body visible, isolated on pure white background, no ground, no shadow on ground, no text, no watermark, vibrant saturated colors, high quality professional game boss art"

declare -A P
P[boss]="colossal abyss guardian golem knight, dark purple crystal armor plates, glowing violet runes and eyes, floating purple energy shards, menacing heavy stance"
P[boss2]="giant frost behemoth monster, massive icy armor plates and frozen crystal spikes on back, blizzard snow swirling around body, pale blue glowing eyes"
P[boss3]="abyss demon overlord, horned dark crimson armored demon lord with sharp claws, crimson energy aura, deep red glowing eyes, dark crown"
P[boss_nidhog]="nidhogg undead corruption dragon, serpentine rotting dragon with tattered wings, toxic green breath glow from mouth, necrotic green rune scars"
P[boss_surt]="surt fire titan, molten lava giant with cracked obsidian black skin, blazing fire mane, magma cracks glowing orange, burning fists"
P[boss_fenrir]="mythical giant wolf fenrir, dark violet fur, broken glowing chain shackles, fierce glowing purple eyes, snarling fangs, four-legged stance"
P[boss_skoll]="skoll celestial golden wolf, flowing golden mane made of solar flames, radiant gold white fur, small sun glow above, majestic running stance"
P[boss_gram]="cursed rune blade wraith knight, dark spectral armor holding an enormous glowing teal greatsword, teal rune engravings on armor, ghostly tattered cape"
P[boss_abudditos]="primordial god of destruction, demonic deity wreathed in crimson and magenta chaos energy, multiple glowing eyes, floating broken halo rings, apocalyptic aura"

ORDER=(boss boss2 boss3 boss_nidhog boss_surt boss_fenrir boss_skoll boss_gram boss_abudditos)

for k in "${ORDER[@]}"; do
  out="$RAW/${k}_raw.png"
  if [ -s "$out" ] && python3 -c "from PIL import Image; im=Image.open('$out'); assert im.size==(1024,1024)" 2>/dev/null; then
    echo "[skip] $k 이미 존재"
    continue
  fi
  for attempt in 1 2 3; do
    echo "[gen] $k (시도 $attempt)"
    z-ai image -p "${P[$k]}, $STYLE" -o "$out" -s 1024x1024 && break
    sleep 3
  done
  if [ -s "$out" ]; then echo "[ok] $k"; else echo "[FAIL] $k"; fi
done
echo "=== 생성 결과 ==="
ls -la "$RAW"
