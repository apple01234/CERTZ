#!/bin/bash
# RPG Icons Pixel Art — 필요 카테고리 PNG만 선별 추출 (.meta 제외)
# 사용: bash extract_icons.sh <batch>
cd /home/z/my-project/upload
ZIP="RPG Icons Pixel Art.zip"
DST="extracted/icons"
mkdir -p "$DST"

B1="Potions Scrolls Runes Books Gems1 Gems2 Buffs Anti-buffs Food_icons Artefacts Sigils"
B2="Swords Bows Staffs Daggers Maces Axes Spears Shields Cuirass Helmets Rings_jewellery Belts Trousers Sabatons Brasers Chests_keys_treasure Arrow"
B3="Swordsman_skills Barbarian_skills Archer Thief Paladin Priest_Skill_Icons Pyromanser Cryomancer Lightning_mage_pack Druid Necromancer_Skill_Icons Summoner_skills_pack Demon_Skills Warlock Aeromancer Spearsman Pirate_Skill_Icons Crossbowman Elven_skills"

BATCH="${1:-all}"
pick() {
  case "$1" in
    1) echo "$B1";;
    2) echo "$B2";;
    3) echo "$B3";;
    *) echo "$B1 $B2 $B3";;
  esac
}
for cat in $(pick "$BATCH"); do
  if [ -d "$DST/$cat" ] && [ -n "$(ls -A "$DST/$cat" 2>/dev/null)" ]; then echo "skip $cat"; continue; fi
  mkdir -p "$DST/$cat"
  # 카테고리 전체 PNG (variant 폴더 포함, .meta 제외) — flat 추출 불가하므로 경로 보존
  timeout 240 unzip -qon "$ZIP" "RPG Icons Pixel Art/$cat/*" -d "$DST/_tmp_$cat" 2>/dev/null
  find "$DST/_tmp_$cat" -name "*.png" -exec mv {} "$DST/$cat/" \; 2>/dev/null
  rm -rf "$DST/_tmp_$cat"
  echo "$cat: $(ls "$DST/$cat" | wc -l) pngs"
done
