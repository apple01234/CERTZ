#!/bin/bash
# 보스 전면 리메이크 — 12종 스프라이트 시트 AI 생성 (7행×6열, 설계도 스펙: 12FPS)
# 설계도 8종(nidhog/jorm/fenrir/behemoth/surt/skoll/gram/nagr) + 신규 4종(guardian/abysslord/abudditos/vord)
# 산출: scripts/boss_raw3/boss_<key>_raw.png (1024x1024, 흰 배경)
set -u
RAW=/home/z/my-project/scripts/boss_raw3
mkdir -p "$RAW"

STYLE="retro pixel art game boss sprite sheet, chunky visible pixels, bold dark outline, rich saturated colors, dark fantasy RPG, side view facing right, consistent character across all frames, same size and proportions in every frame, evenly spaced uniform grid, pure white background, no text, no labels, no captions, no grid lines, no watermark"
GRID="exactly 7 rows and 6 columns of animation frames, 42 cells total. Row 1: idle breathing loop. Row 2: running cycle. Row 3: melee attack. Row 4: death collapse fading. Row 5: special skill A. Row 6: special skill B. Row 7: special skill C."

declare -A P
P[nidhog]="BOSS: fat gluttonous green dragon, huge round belly, small tattered wings, toxic green glow inside mouth, sharp fangs, long thick tail. Row5: green explosion blast around body. Row6: spitting glowing poison energy orb. Row7: rising up and slamming the ground with green shockwave."
P[jorm]="BOSS: menacing dark fire dragon, obsidian black and dark red scales with glowing blue crystal spikes on back, blazing orange fire. Row5: fiery fist punch explosion. Row6: mighty dragon roar with fire shockwave. Row7: volley of homing fire missiles."
P[fenrir]="BOSS: giant white frost wolf beast, thick snow-white fur, glowing ice-blue eyes, icicle fangs, blizzard snow aura. Row5: lunging freeze bite slash. Row6: ice spike eruption from ground. Row7: freezing roar raising ice pillars."
P[behemoth]="BOSS: haunted ghost pirate ship, wooden hull with torn dark sails, teal ghostly glow, skull figurehead, side cannons. Row5: cannon broadside fire. Row6: giant crashing wave. Row7: forward ram charge with ghost flames."
P[surt]="BOSS: colossal lava golem titan, cracked obsidian black rock skin with bright molten magma glowing through cracks, huge fiery fists. Row5: fire eruption columns from ground. Row6: fiery shockwave ground clap. Row7: hurling a giant magma orb."
P[skoll]="BOSS: majestic ice phoenix bird, white and pale blue feathers, frost flames trailing from wings and tail, fierce elegant raptor head, glowing cyan eyes. Row5: blizzard storm burst from wings. Row6: summoning ice spirit wisps. Row7: freezing domain ice dome."
P[gram]="BOSS: purple demon king, dark violet armor plates, large bat wings, curved horns, burning purple hellfire aura, glowing magenta eyes. Row5: hurling dark energy sphere. Row6: hell judgment fire pillar. Row7: summoning portal with minions."
P[nagr]="BOSS: golden angel knight, radiant gold armor, huge white feathered wings, glowing halo above head, holding golden holy spear-sword. Row5: throwing sky spear of light. Row6: holy light judgment beams from above. Row7: divine descent strike with sword."
P[guardian]="BOSS: colossal abyss guardian golem knight, dark indigo stone armor with glowing violet crystal cores in chest and shoulders, floating crystal shards, single huge glowing purple eye slit, giant stone fists. Row5: ground slam with purple quake. Row6: orbiting crystal shards barrage. Row7: violet beam sweep."
P[abysslord]="BOSS: elegant abyss demon lord, slim dark crimson and black armored demon, four curved horns, tattered crimson cape, sharp grin, red glowing eyes. Row5: red magic circle eruption. Row6: triple crimson orb volley. Row7: shadow blink slash."
P[abudditos]="BOSS: primordial void demon dragon, dark purple-black scales, crimson and magenta chaos flames rising from body, multiple glowing golden eyes, broken halo ring behind head, apocalyptic aura. Row5: chaos flame eruption. Row6: cross chaos beam. Row7: apocalyptic sigil explosion."
P[vord]="BOSS: ashen gate warden giant, heavy gray stone armor with smoldering ember cracks, huge tower shield on back, glowing orange furnace eyes, warhammer. Row5: hammer ground quake. Row6: ember shockwave stomp. Row7: molten key-spear thrust."

ORDER=(nidhog jorm fenrir behemoth surt skoll gram nagr guardian abysslord abudditos vord)

for k in "${ORDER[@]}"; do
  out="$RAW/${k}_raw.png"
  if [ -s "$out" ] && python3 -c "from PIL import Image; im=Image.open('$out'); assert im.size==(1024,1024)" 2>/dev/null; then
    echo "[skip] $k 이미 존재"
    continue
  fi
  ok=0
  for attempt in 1 2 3; do
    echo "[gen] $k (시도 $attempt)"
    z-ai image -p "${P[$k]} $GRID $STYLE" -o "$out" -s 1024x1024 && ok=1 && break
    sleep 3
  done
  if [ "$ok" = 1 ]; then echo "[ok] $k"; else echo "[FAIL] $k"; fi
done
echo "=== 생성 결과 ==="
ls -la "$RAW"
