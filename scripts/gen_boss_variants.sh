#!/bin/bash
# v1.4.8 — 챕터별 보스 BGM 파생 트랙 생성 (유저 지시 "챕터마다 보스브금 다르게")
# 기존 bgm_boss1~4를 피치/템포 변형해 boss6~9를 만든다 (9챕터 전부 상이한 보스곡).
# asetrate로 피치 이동 + atempo로 템포 부분 보정 → 원곡과 구분되는 분위기.
set -e
DIR=/home/z/my-project/public/assets/audio
cd "$DIR"

gen() {
  src=$1; out=$2; rate=$3; tempo=$4
  if [ -f "$out" ]; then echo "skip $out (exists)"; return; fi
  ffmpeg -y -loglevel error -i "$src" -filter:a "asetrate=44100*${rate},aresample=44100,atempo=${tempo}" -c:a libvorbis -q:a 5 "$out"
  echo "generated $out"
}

# boss6 = boss1 −3음정 (0.8409) — 어둡고 묵직 (동굴 스바르트알프헤임)
gen bgm_boss1.ogg bgm_boss6.ogg 0.8409 1.06
# boss7 = boss2 +2음정 (1.1225) — 팽팽하고 날카롭 (니다벨리르)
gen bgm_boss2.ogg bgm_boss7.ogg 1.1225 0.97
# boss8 = boss3 −4음정 (0.7937) — 저릿한 압박감 (헬)
gen bgm_boss3.ogg bgm_boss8.ogg 0.7937 1.12
# boss9 = boss4 +3음정 (1.1892) — 광란의 고조 (세계수의 뿌리)
gen bgm_boss4.ogg bgm_boss9.ogg 1.1892 0.94

ls -la bgm_boss*.ogg
