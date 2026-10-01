#!/bin/bash
# 스킬 SFX 후보군 길이/품질 검증
PACK="/tmp/sfxwork/rubberduck/The Essential Retro Video Game Sound Effects Collection [512 sounds] By Juhani Junkala"
probe() {
  local f="$PACK/$1"
  local d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null)
  echo "$1 -> ${d}s"
}
for f in \
  "Weapons/Single Shot Sounds/sfx_weapon_singleshot17.wav" \
  "Weapons/Single Shot Sounds/sfx_weapon_singleshot3.wav" \
  "Weapons/Single Shot Sounds/sfx_weapon_singleshot19.wav" \
  "Weapons/Lasers/sfx_wpn_laser4.wav" \
  "Weapons/Lasers/sfx_wpn_laser8.wav" \
  "Weapons/Lasers/sfx_wpn_laser12.wav" \
  "Weapons/Lasers/sfx_wpn_laser6.wav" \
  "Weapons/Melee/sfx_wpn_dagger.wav" \
  "Weapons/Melee/sfx_wpn_sword1.wav" \
  "Weapons/Melee/sfx_wpn_sword2.wav" \
  "Weapons/Melee/sfx_wpn_sword3.wav" \
  "Weapons/Melee/sfx_wpn_punch4.wav" \
  "Weapons/Shotgun/sfx_weapon_shotgun2.wav" \
  "Weapons/Cannon/sfx_wpn_cannon2.wav" \
  "Weapons/Grenade Whistles/sfx_wpn_grenadewhistle1.wav" \
  "General Sounds/Weird Sounds/sfx_sound_depressurizing.wav" \
  "General Sounds/Weird Sounds/sfx_sound_bling.wav" \
  "General Sounds/Weird Sounds/sfx_sound_mechanicalnoise2.wav" \
  "General Sounds/Weird Sounds/sfx_sound_mechanicalnoise5.wav" \
  "General Sounds/Positive Sounds/sfx_sounds_powerup6.wav" \
  "General Sounds/Positive Sounds/sfx_sounds_powerup14.wav" \
  "General Sounds/Fanfares/sfx_sounds_fanfare2.wav" \
  "General Sounds/Impacts/sfx_sounds_impact1.wav" \
  "General Sounds/Impacts/sfx_sounds_impact4.wav" \
  "General Sounds/Impacts/sfx_sounds_impact10.wav" \
  "Explosions/Short/sfx_exp_short_hard8.wav" \
  "Explosions/Short/sfx_exp_short_hard15.wav" \
  "Explosions/Medium Length/sfx_exp_medium5.wav" \
  "Explosions/Long/sfx_exp_long3.wav" \
  ; do probe "$f"; done
