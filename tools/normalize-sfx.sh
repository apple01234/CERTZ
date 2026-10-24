#!/usr/bin/env bash
# SFX 정규화 v2 — 원본 mean 기준 게인 + 피크 리미팅
#
# v1(loudnorm I=-18 LUFS)은 실패했다. 이유:
#   loudnorm은 최소 3초 이상 구간의 통합 음량(LUFS)을 재는 필터다. SFX는 대부분
#   0.2~1.5초라 측정 구간이 부족해 게이트가 과하게 닫히고, 결과가 원본보다
#   20~34dB 더 조용해졌다(실측: skl_quake1 -17.3dB → -51.5dB).
#   사실상 무음이 된 20개 중 sfx_swing·sfx_coin·sfx_pickup·sfx_click이 포함됐다.
#
# v2 전략:
#   원본 mean_volume을 재고 목표 mean까지의 차이만큼 게인을 준 뒤,
#   limiter로 피크를 -1dBFS 아래로 누른다. 짧은 파일에도 정확히 동작한다.
#
# 사용법: bash tools/normalize-sfx.sh <디렉토리> [목표mean_dB]
set -u
DIR="${1:?디렉토리 필요}"
TARGET="${2:--18}"
mkdir -p "$DIR/.orig"

n=0
for f in "$DIR"/*.ogg; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  # v1.2.2 — BGM은 이 스크립트가 건드리지 않는다. BGM_GAIN_DB로 이미 -16.5dB 완벽
  # 정규화가 끝나 있어(실측 편차 0.01dB), 다시 정규화하면 게인 테이블과 어긋난다.
  case "$b" in bgm_*) continue ;; esac

  src="$DIR/.orig/$b"
  if [ ! -e "$src" ]; then cp "$f" "$DIR/.orig/$b"; fi

  out=$(ffmpeg -hide_banner -i "$src" -af volumedetect -f null - 2>&1)
  mean=$(echo "$out" | grep -oP 'mean_volume: \K[-0-9.]+' | head -1)
  peak=$(echo "$out" | grep -oP 'max_volume: \K[-0-9.]+' | head -1)
  if [ -z "$mean" ] || [ -z "$peak" ]; then echo "SKIP $b (측정 실패)"; continue; fi

  # 무음(-70dB 이하)은 건드리지 않는다 — 게인을 주면 노이즈만 커진다
  if awk "BEGIN{exit !($mean < -70)}"; then
    cp "$src" "$f"; echo "SILENT $b (원본 유지)"; continue
  fi

  gain=$(awk "BEGIN{printf \"%.2f\", $TARGET - $mean}")
  # 게인 적용 후 피크가 -1dBFS를 넘으면 그만큼 덜 올린다
  newpeak=$(awk "BEGIN{printf \"%.2f\", $peak + $gain}")
  if awk "BEGIN{exit !($newpeak > -1.0)}"; then
    gain=$(awk "BEGIN{printf \"%.2f\", -1.0 - $peak}")
  fi

  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -af "volume=${gain}dB,alimiter=limit=0.891:level=false" \
    -c:a libvorbis -q:a 5 "$f"
  n=$((n+1))
done
echo "정규화 $n개 (목표 mean ${TARGET}dB)"
