#!/bin/bash
# SERTZ 효과음 통합 — soundeffect-lab.info (효과음연구소) + taira-komori.net (小森平の使いやすい効果音)
# 라이선스: 양 사이트 모두 상업 이용 무료 / 크레딧 불필요 / 재배포(원본 파일 배포)만 금지
#          → 게임 APK/웹 번들은 게임물에 내장하는 것이므로 허용 범위. CREDITS.md에 출처 기록.
set -e
cd /home/z/my-project/scripts/sfx-fetch
mkdir -p dl
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

# "로컬이름|URL" — 사이트 예절상 순차 + 0.6s 간격
LIST=(
  "sfx_swing|https://soundeffect-lab.info/sound/battle/mp3/sword-slash2.mp3"
  "sfx_hit|https://soundeffect-lab.info/sound/battle/mp3/blow2.mp3"
  "sfx_crit|https://soundeffect-lab.info/sound/battle/mp3/large-sword-slash1.mp3"
  "sfx_spin|https://soundeffect-lab.info/sound/battle/mp3/katana-continuity1.mp3"
  "sfx_dash|https://soundeffect-lab.info/sound/battle/mp3/highspeed-movement1.mp3"
  "sfx_portal|https://soundeffect-lab.info/sound/battle/mp3/magic-worp1.mp3"
  "sfx_potion|https://soundeffect-lab.info/sound/battle/mp3/magic-cure2.mp3"
  "sfx_equip|https://soundeffect-lab.info/sound/battle/mp3/armor-work-1.mp3"
  "sfx_bossdie|https://soundeffect-lab.info/sound/battle/mp3/wall-destruction1.mp3"
  "sfx_levelup|https://soundeffect-lab.info/sound/anime/mp3/levelup1.mp3"
  "sfx_upgradeOk|https://soundeffect-lab.info/sound/anime/mp3/jajean1.mp3"
  "sfx_hurt|https://taira-komori.net/sound_os2/attack01/damage2.mp3"
  "sfx_die|https://taira-komori.net/sound_os2/monster01/end_of_a_monster.mp3"
  "sfx_roar|https://taira-komori.net/sound_os2/monster01/dragon_roar.mp3"
  "sfx_pickup|https://taira-komori.net/sound_os2/game01/pickup02.mp3"
  "sfx_coin|https://taira-komori.net/sound_os2/game01/coin02.mp3"
  "sfx_quest|https://taira-komori.net/sound_os2/game01/correct_answer3.mp3"
  "sfx_upgradeFail|https://taira-komori.net/sound_os2/event01/buzzer1.mp3"
)

for item in "${LIST[@]}"; do
  name="${item%%|*}"
  url="${item#*|}"
  # soundeffect-lab은 핫링크 방지 — 카테고리 페이지를 Referer로 지정해야 함
  ref=""
  case "$url" in
    *soundeffect-lab*) ref="-e https://soundeffect-lab.info/sound/battle/" ;;
  esac
  if [[ "$url" == *"/anime/"* ]]; then ref="-e https://soundeffect-lab.info/sound/anime/"; fi
  echo "GET $name <- $url"
  curl -s --max-time 30 -A "$UA" $ref "$url" -o "dl/$name.mp3"
  sleep 0.6
done

echo "=== 결과 검증 ==="
for item in "${LIST[@]}"; do
  name="${item%%|*}"
  f="dl/$name.mp3"
  sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
  typ=$(file -b "$f" 2>/dev/null | cut -c1-40)
  echo "$name: ${sz}B $typ"
done
