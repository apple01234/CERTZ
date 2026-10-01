#!/bin/bash
# v1.4.3 (작업5) — 유니온 아티팩트/버프/레이드 전용 시각 에셋 생성
#  기능은 있지만 UI(텍스트/lucide 아이콘)만 있던 유니온 패널에 전용 에셋을 입힌다.
#  생성 후 sharp로 96px(아이콘)/160px(레이드 보스)로 리사이즈해 APK 부담 최소화.
set -e
OUT=/home/z/my-project/public/assets/ui/union
RAW=/home/z/my-project/scripts/union_raw
mkdir -p "$OUT" "$RAW"

gen() { # $1=file  $2=prompt
  if [ -s "$RAW/$1.png" ]; then echo "skip $1"; return; fi
  z-ai image -p "$2" -o "$RAW/$1.png" -s 1024x1024 && echo "ok $1" || echo "FAIL $1"
}

# ── 아티팩트 아이콘 6종 ──
gen art_atk "RPG game icon of a blazing crimson war emblem, fiery crossed sword crest with glowing red gem, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"
gen art_hp "RPG game icon of a glowing world tree branch wand, emerald green leaves with golden light sparkles, Yggdrasil twig, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"
gen art_crit "RPG game icon of a fierce hawk eye gemstone, amber golden eye with sharp slit pupil, purple amethyst frame, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"
gen art_gold "RPG game icon of a chubby dwarf coin pouch overflowing with gold coins, leather bag with rune engraving, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"
gen art_def "RPG game icon of a heavy earth shield with mountain motif, stone and bronze round shield with green crystal core, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"
gen art_speed "RPG game icon of a swirling wind feather, cyan gale wing feather with motion trails and wind spiral, medieval fantasy, pixel-art inspired painterly style, centered on dark navy background, subtle golden border glow, game UI item icon, high quality, detailed"

# ── 유니온 시간제 버프 아이콘 4종 ──
gen ub_atk "RPG buff icon of two crossed flaming swords pointing up, red-orange aura, medieval fantasy pixel-art style, centered on dark navy square background, circular golden frame glow, game UI buff icon, high quality, detailed"
gen ub_gold "RPG buff icon of a shower of golden coins with a small harvest sickle, yellow sparkle, medieval fantasy pixel-art style, centered on dark navy square background, circular golden frame glow, game UI buff icon, high quality, detailed"
gen ub_def "RPG buff icon of a glowing hexagonal blue magic barrier dome with small shield emblem, medieval fantasy pixel-art style, centered on dark navy square background, circular golden frame glow, game UI buff icon, high quality, detailed"
gen ub_exp "RPG buff icon of an open ancient tome with a rising golden star and sparkle trail, medieval fantasy pixel-art style, centered on dark navy square background, circular golden frame glow, game UI buff icon, high quality, detailed"

# ── 유니온 레이드 보스 초상 3종 ──
gen raid_behemoth "RPG boss portrait of a colossal stone gate guardian giant, armored behemoth with glowing green core in chest, imposing front view bust, dark fantasy painterly style, dark background with green rim light, game boss illustration, high quality, detailed"
gen raid_nidhogg "RPG boss portrait of a sinister abyss watcher dragon, skeletal nidhogg wyrm with icy blue glowing eyes and cold mist, imposing front view bust, dark fantasy painterly style, dark background with cyan rim light, game boss illustration, high quality, detailed"
gen raid_abysslord "RPG boss portrait of a dimensional overlord demon, abyss lord with violet flaming crown and purple void portal behind, imposing front view bust, dark fantasy painterly style, dark background with magenta rim light, game boss illustration, high quality, detailed"

echo "=== resize ==="
node -e "
const sharp = require('/home/z/my-project/node_modules/sharp');
const fs = require('fs');
const RAW='/home/z/my-project/scripts/union_raw', OUT='/home/z/my-project/public/assets/ui/union';
const icons=['art_atk','art_hp','art_crit','art_gold','art_def','art_speed','ub_atk','ub_gold','ub_def','ub_exp'];
const bosses=['raid_behemoth','raid_nidhogg','raid_abysslord'];
(async()=>{
  for(const n of icons){
    await sharp(RAW+'/'+n+'.png').resize(96,96).png({quality:90,compressionLevel:9}).toFile(OUT+'/'+n+'.png');
    console.log('icon',n);
  }
  for(const n of bosses){
    await sharp(RAW+'/'+n+'.png').resize(160,160).png({quality:90,compressionLevel:9}).toFile(OUT+'/'+n+'.png');
    console.log('boss',n);
  }
})();
"
ls -la "$OUT"
