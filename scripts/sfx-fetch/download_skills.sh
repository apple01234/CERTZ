#!/bin/bash
# v3.0.24 — 직업별 스킬 전용 효과음 확보 (soundeffect-lab.info 효과음연구소)
# 라이선스: 상업 이용 무료 / 크레딧 불필요 / 원본 파일 재배포만 금지
#          (게임 APK 내장 = 허용 범위, CREDITS.md에 출처 기록)
# 설계: 4계열 기본공격 3종 + 스킬1 8종 + 스킬2 4종 + 스킬3 8종 + 스킬4 4종 = 28종 신규 확보
#       (전사 회전베기=기존 sfx_spin, 점멸=기존 sfx_portal(magic-worp1) 재사용)
set -e
cd /home/z/my-project/scripts/sfx-fetch
mkdir -p dl
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
B="https://soundeffect-lab.info/sound/battle/mp3"

# "로컬이름|URL" — 사이트 예절상 순차 + 0.6s 간격
LIST=(
  # ---- 기본공격 (계열 정체성) ----
  "skl_arrow1|$B/arrow-release1.mp3"          # 궁수 활발사
  "skl_cast1|$B/magic-stick1.mp3"             # 마법사 지팡이 시전
  "skl_knife1|$B/knife-slash-1.mp3"           # 도적 단검
  # ---- 스킬1 (주력기) ----
  "skl_flame1|$B/magic-flame1.mp3"            # 마법사 대관통 볼트
  "skl_electron1|$B/magic-electron1.mp3"      # 아크메이지 아크 볼트
  "skl_arrowpierce1|$B/arrow-pierce1.mp3"     # 스나이퍼 관통 저격
  "skl_wind1|$B/magic-wind1.mp3"              # 윈드러너 회오리 화살
  "skl_cure2|$B/magic-cure3.mp3"              # 세이지 정화의 파동
  "skl_iainuki1|$B/iainuki1.mp3"              # 어세신 그림자 참수(발도)
  "skl_sword3|$B/sword-slash3.mp3"            # 스워시버클러 연타 난무
  "skl_quake1|$B/magic-quake1.mp3"            # 가디언 성벽 강타(지진)
  # ---- 스킬2 (기동기) ----
  "skl_dark1|$B/magic-attack-darkness1.mp3"   # 도적 그림자 숨기/칼날/지뢰/군주
  "skl_heavydash1|$B/armor-dash-2.mp3"        # 버서커/가디언 중장 돌진
  "skl_wind2|$B/magic-wind2.mp3"              # 레인저/윈드러너 질풍
  "skl_ambush1|$B/step-into1.mp3"             # 어세신 암습 돌진
  # ---- 스킬3 (3차기) ----
  "skl_holy1|$B/magic-attack-holy1.mp3"       # 팔라딘 성역/크루세이더 성흔/심판
  "skl_thunder2|$B/magic-electron2.mp3"       # 스톰브링어 낙뢰
  "skl_slowmo1|$B/slow-motion1.mp3"           # 크로니클 시간 왜곡
  "skl_rage1|$B/transform-monster1.mp3"       # 워브링어 피의 격노
  "skl_chain4|$B/magic-electron4.mp3"         # 아크로드 연쇄 번개
  "skl_gravity1|$B/magic-gravity1.mp3"        # 이터널 중력 붕괴
  "skl_bigsword1|$B/large-sword-slash1.mp3"   # 블레이드마스터 파동 검기
  "skl_warcry1|$B/dragon-cry1.mp3"            # 워로드 전장의 함성
  # ---- 스킬4 (4차기) ----
  "skl_superhit1|$B/super-arts-hit1.mp3"      # 워브링어 종언의 일격
  "skl_timestop1|$B/dimension-stop.mp3"       # 이터널 영원의 고리(시간 정지)
  "skl_manaburst1|$B/magic-gravity2.mp3"      # 아크로드 마나 붕괴
  "skl_skyflight1|$B/wizard-flight1.mp3"      # 스카이로드 천공의 폭풍
)

for item in "${LIST[@]}"; do
  name="${item%%|*}"
  url="${item#*|}"
  # soundeffect-lab 핫링크 방지 — 카테고리 페이지 Referer 필수
  if [ ! -s "dl/$name.mp3" ]; then
    echo "GET $name <- $url"
    curl -s --max-time 30 -A "$UA" -e "https://soundeffect-lab.info/sound/battle/" "$url" -o "dl/$name.mp3"
    sleep 0.6
  else
    echo "SKIP $name (cached)"
  fi
done

echo "=== 결과 검증 ==="
fail=0
for item in "${LIST[@]}"; do
  name="${item%%|*}"
  f="dl/$name.mp3"
  sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
  typ=$(file -b "$f" 2>/dev/null | cut -c1-30)
  echo "$name: ${sz}B $typ"
  if [ "$sz" -lt 1000 ]; then fail=1; fi
done
exit $fail
