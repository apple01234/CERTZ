#!/bin/bash
# v3.0.27 — 스킬 효과음 전면 교체 (soundeffect-lab.info → Juhani Junkala 512 CC0 + Kenney RPG Audio CC0)
# 같은 파일명(skl_*.ogg) 유지 → 코드 매핑/프리로드 무변경
set -e
PACK="/tmp/sfxwork/rubberduck/The Essential Retro Video Game Sound Effects Collection [512 sounds] By Juhani Junkala"
KEN="/tmp/sfxwork/kenney_rpg/Audio"
OUT="/home/z/my-project/public/assets/audio"
mkdir -p /tmp/sfxwork/out

conv() { # $1=src $2=out.ogg $3=extra ffmpeg args(옵션) $4=추가 필터(옵션)
  local src="$1" out="$OUT/$2" extra="${3:-}" extraf="${4:-}"
  local af="loudnorm=I=-15:TP=-1.5:LRA=11"
  [ -n "$extraf" ] && af="$af,$extraf"
  ffmpeg -y -v error -i "$src" $extra -af "$af" -ar 44100 -ac 1 -c:a libvorbis -q:a 4 "$out"
  echo "OK $2 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")s)"
}

# [자주 울리는 기본공격 계열 — 짧고 가벼운 것]
conv "$PACK/Weapons/Single Shot Sounds/sfx_weapon_singleshot17.wav" skl_arrow1.ogg
conv "$PACK/Weapons/Lasers/sfx_wpn_laser4.wav"                      skl_cast1.ogg
conv "$KEN/knifeSlice2.ogg"                                          skl_knife1.ogg
# [마법 투사체]
conv "$PACK/Weapons/Lasers/sfx_wpn_laser8.wav"                       skl_flame1.ogg
conv "$PACK/Weapons/Lasers/sfx_wpn_laser12.wav"                      skl_electron1.ogg
conv "$PACK/Weapons/Single Shot Sounds/sfx_weapon_singleshot3.wav"   skl_arrowpierce1.ogg
# [바람 — depressurizing을 구간 트림으로 2종 변주]
conv "$PACK/General Sounds/Weird Sounds/sfx_sound_depressurizing.wav" skl_wind1.ogg "-t 1.3"
conv "$PACK/General Sounds/Weird Sounds/sfx_sound_depressurizing.wav" skl_wind2.ogg "-ss 2.2 -t 1.2" "afade=t=out:st=0.9:d=0.3"
# [회복·신성]
conv "$PACK/General Sounds/Positive Sounds/sfx_sounds_powerup6.wav"  skl_cure2.ogg
conv "$PACK/General Sounds/Weird Sounds/sfx_sound_bling.wav"         skl_holy1.ogg
# [근접 계열]
conv "$PACK/Weapons/Melee/sfx_wpn_sword3.wav"                        skl_iainuki1.ogg
conv "$PACK/Weapons/Melee/sfx_wpn_sword1.wav"                        skl_sword3.ogg
conv "$PACK/Weapons/Melee/sfx_wpn_sword2.wav"                        skl_ambush1.ogg
conv "$PACK/Weapons/Melee/sfx_wpn_punch4.wav"                        skl_rage1.ogg
# [중타·충격]
conv "$PACK/General Sounds/Impacts/sfx_sounds_impact13.wav"          skl_quake1.ogg
conv "$PACK/General Sounds/Negative Sounds/sfx_sounds_error1.wav"    skl_dark1.ogg
conv "$PACK/Weapons/Cannon/sfx_wpn_cannon2.wav"                      skl_heavydash1.ogg
conv "$PACK/General Sounds/Impacts/sfx_sounds_impact9.wav"           skl_gravity1.ogg
conv "$PACK/Explosions/Short/sfx_exp_short_hard8.wav"                skl_bigsword1.ogg
conv "$PACK/Explosions/Medium Length/sfx_exp_medium5.wav"            skl_superhit1.ogg
# [뇌전·마나]
conv "$PACK/Weapons/Lasers/sfx_wpn_laser6.wav"                       skl_chain4.ogg
conv "$PACK/Explosions/Short/sfx_exp_short_hard15.wav"               skl_manaburst1.ogg
# [시간 계열 — 기계음 트림 변주]
conv "$PACK/General Sounds/Weird Sounds/sfx_sound_mechanicalnoise2.wav" skl_slowmo1.ogg "-t 1.6"
conv "$PACK/General Sounds/Weird Sounds/sfx_sound_mechanicalnoise5.wav" skl_timestop1.ogg "-t 1.8"
# [전장·천공]
conv "$PACK/General Sounds/Fanfares/sfx_sounds_fanfare2.wav"         skl_warcry1.ogg
conv "$PACK/Weapons/Grenade Whistles/sfx_wpn_grenadewhistle1.wav"    skl_skyflight1.ogg
# [낙뢰]
conv "$PACK/Explosions/Long/sfx_exp_long3.wav"                       skl_thunder2.ogg

echo "=== 완료: $(ls $OUT/skl_*.ogg | wc -l) / 27 파일 ==="
