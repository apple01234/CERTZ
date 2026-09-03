#!/bin/bash
# v3.0.24 — BGM 40트랙 풀버전 고품질 재인코딩 (병렬 6작업 — loudnorm이 CPU 무거워 직렬 시 40분+)
#  유저 지시: "용량 많은건 상관없음 (렉만 안걸리면 됨) + 퀄리티가 우선"
#  변경:
#   - 130s 캡 제거 → 원곡 전체 길이 (지연 로딩으로 메모리 안전 — 현재 구역 1곡만 디코드)
#   - q2(97kbps) → q4(~160kbps)
#   - 192kHz(loudnorm 업샘플 부작용) → 48kHz 정규화 (파일 크기/디코드 부하 감소)
#   - 루프 호흡: 시작 0.35s 페이드인 + 끝 2.5s 페이드아웃 (v3.0.23 방식 유지)
RAW=/home/z/my-project/scripts/bgm_work/raw
OUT=/home/z/my-project/public/assets/audio

one() {
  src="$1"
  key=$(basename "$src" .mp3)
  dst="$OUT/$key.ogg"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
  # skip — 이미 48kHz 풀버전으로 인코딩된 트랙 (재실행 대응)
  sr=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$dst" 2>/dev/null || echo 0)
  if [ "$sr" = "48000" ]; then
    echo "SKIP $key (${dur}s, already 48k)"
    return 0
  fi
  fade_st=$(python3 -c "print(max(0, float('$dur') - 2.5))")
  ffmpeg -y -v error -i "$src" \
    -af "loudnorm=I=-18:TP=-1.5:LRA=11,adelay=200|200,afade=t=in:st=0:d=0.35,afade=t=out:st=${fade_st}:d=2.5" \
    -ar 48000 -c:a libvorbis -q:a 4 "$dst" || { echo "FAIL $key"; return 1; }
  sz=$(stat -c%s "$dst")
  echo "OK $key: ${dur}s ${sz}B"
}
export -f one
export OUT

ls "$RAW"/*.mp3 | xargs -P 6 -I{} bash -c 'one "$@"' _ {}
echo "=== 전체 크기: $(du -sh "$OUT" | cut -f1) ==="
# 최종 검증 — 40트랙 모두 48kHz인지
bad=0
for f in "$OUT"/bgm_*.ogg; do
  sr=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$f")
  [ "$sr" != "48000" ] && { echo "NOT-48k: $(basename "$f") ($sr)"; bad=1; }
done
[ "$bad" = "0" ] && echo "ALL 48kHz OK"
exit $bad
