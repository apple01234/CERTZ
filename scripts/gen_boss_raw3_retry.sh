#!/bin/bash
# 재생성: behemoth(단일 일러스트 실패) / abysslord(3행뿐) — 격자 강조 프롬프트
set -u
RAW=/home/z/my-project/scripts/boss_raw3
mkdir -p "$RAW"

STYLE="retro pixel art game boss sprite sheet, chunky visible pixels, bold dark outline, rich saturated colors, dark fantasy RPG, side view facing right, pure white background, no text, no labels, no captions, no grid lines, no watermark"
GRID="SPRITE SHEET GRID LAYOUT: every row is a horizontal strip containing 6 evenly spaced copies of the SAME character with small white gaps between them, like a classic RPG spritesheet. 5 rows total, 30 cells."

declare -A P
P[behemoth]="CHARACTER: haunted ghost pirate ship seen from the side, wooden brown hull, black torn sails, teal ghostly glow, skull figurehead at the bow, small side cannons, floating over small waves. Row 1: floating idle with gentle bobbing. Row 2: sailing fast to the right with wave spray. Row 3: firing cannon broadside with muzzle flashes. Row 4: sinking down into water tilted. Row 5: ghost fire burst around the hull. $GRID $STYLE"
P[abysslord]="CHARACTER: elegant abyss demon lord, slim dark crimson and black armored demon, four curved horns, tattered crimson cape, sharp grin, red glowing eyes. Row 1: idle standing breathing. Row 2: walking forward. Row 3: slashing with claws. Row 4: dying, collapsing and dissolving into red embers. Row 5: summoning a red magic circle. $GRID $STYLE"

for k in behemoth abysslord; do
  out="$RAW/${k}_raw.png"
  mv "$out" "$out.old" 2>/dev/null
  ok=0
  for attempt in 1 2 3; do
    echo "[gen] $k (시도 $attempt)"
    z-ai image -p "${P[$k]}" -o "$out" -s 1024x1024 && ok=1 && break
    sleep 3
  done
  [ "$ok" = 1 ] && echo "[ok] $k" || echo "[FAIL] $k"
done
