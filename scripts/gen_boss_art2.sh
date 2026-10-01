#!/bin/bash
# v1.4.11 — 보스 디자인 전면 교체 2차: 애니 셀셰이드 방향 (SPUM 캐릭터 톤 매칭)
# 원작 고증 유지: 보스 9종의 정체성(이름·속성·역할)은 그대로, 비주얼 구현만 완전 신규
# 산출: scripts/boss_raw2/boss_<key>_raw.png (1024x1024)
set -u
RAW=/home/z/my-project/scripts/boss_raw2
mkdir -p "$RAW"

STYLE="2D anime action RPG boss illustration, maplestory-inspired vibrant cel shading with soft gradients, glossy anime colors, strong readable silhouette, dynamic menacing pose, single creature centered, full body visible edge to edge, isolated on pure white background, no ground, no shadow on ground, no text, no watermark, high quality professional mobile game boss art"

declare -A P
P[boss]="colossal abyss guardian golem knight, dark indigo armor with glowing violet crystal cores embedded in chest and shoulders, two floating crystal shards orbiting, single huge glowing purple eye slit, heavy champion stance with giant stone gauntlets"
P[boss2]="giant frost behemoth beast, thick pale-blue fur with translucent ice armor plates and glowing cyan crystal spikes on back, frost breath mist from jaws, orange pinner eyes, hunched charging pose"
P[boss3]="elegant abyss demon overlord, slim dark crimson armored demon with four curved horns and tattered crimson cape, one hand raised summoning red magic circle, sharp grin, floating pose"
P[boss_nidhog]="nidhogg rot dragon, serpentine wingless dragon coiling, mossy toxic green scales with glowing lime rune scars, dripping green venom from fangs, skull-like horned head, cobra ready-to-strike pose"
P[boss_surt]="surt fire titan, muscular giant with cracked volcanic obsidian skin and bright magma glowing through cracks, blazing orange fire mane and beard, fire chains wrapped on arms, smashing fists overhead pose"
P[boss_fenrir]="mythical giant wolf fenrir, dark violet-black fur with glowing purple runic chain fragments still hanging from neck, ice-blue pinner eyes, roaring with huge fangs, four-legged lunging pose"
P[boss_skoll]="skoll celestial sun wolf, bright golden fur with flowing solar flame mane and tail, warm white chest fur, tiny blazing sun orb floating above head, graceful mid-leap pose"
P[boss_gram]="cursed rune blade wraith knight, slim spectral dark armor with glowing teal rune engravings, tattered ghostly cape, wielding oversized glowing teal greatsword planted forward, hooded shadow face with two glowing eyes"
P[boss_abudditos]="primordial god of destruction, demonic deity with three glowing golden eyes, crimson and magenta chaos flames rising from shoulders, broken golden halo ring behind head, hands forming an apocalyptic sigil"

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
