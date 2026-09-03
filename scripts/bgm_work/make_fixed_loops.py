#!/usr/bin/env python3
"""v3.0.23 — BGM 40트랙 전체 풀버전 재인코딩 (맵별 고정 배치용).
변경 사유:
  - 유저 피드백: "곡 교체기능 없애" + "40곡을 다 쓰는데 맵마다 적절히 배치하라"
  - 구역별 고정 1곡 루프 재생이므로 130초 캡본(페이드아웃 후 곡 전환)은 부자연스러움
  - 전 트랙을 최대 205초로 늘리고 끝 2.5초 페이드아웃 + 시작 0.3초 페이드인 (루프 호흡)
  - q2→q1 (APK 용량 억제), loudnorm 유지
나머지 로직은 기존 캐시(raw/*.mp3) 재사용."""
import os
import subprocess
import sys

RAW = "/home/z/my-project/scripts/bgm_work/raw"
OUT = "/home/z/my-project/public/assets/audio"
CAP = "205"  # 초 — 대부분 원곡 길이(100~315s)에서 무감, 초과곡만 절단


def probe(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def main() -> int:
    keys = sorted(f[:-4] for f in os.listdir(RAW) if f.endswith(".mp3"))
    if len(keys) != 40:
        print(f"raw 캐시 40곡 필요 — 현재 {len(keys)}", file=sys.stderr)
        return 1
    total = 0.0
    fails = []
    done = 0
    for key in keys:
        src = os.path.join(RAW, key + ".mp3")
        dst = os.path.join(OUT, key + ".ogg")
        # 이미 풀버전(>131s)으로 재인코딩된 트랙은 스킵 — 130s 캡본만 처리
        if os.path.exists(dst) and probe(dst) > 131.0:
            total += os.path.getsize(dst)
            done += 1
            print(f"SKIP {key} (already full)")
            continue
        af = (
            f"loudnorm=I=-18:TP=-1.5:LRA=11,"
            f"adelay=200|200,apad=whole_dur={CAP},"
            f"afade=t=in:st=0:d=0.35,"
            f"atrim=0:{CAP},"
            f"afade=t=out:st={float(CAP)-2.5:.2f}:d=2.5"
        )
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", src, "-af", af, "-c:a", "libvorbis", "-q:a", "1", dst],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not os.path.exists(dst):
            fails.append(f"{key}: {r.stderr[-160:]}")
            continue
        dur = probe(dst)
        size = os.path.getsize(dst)
        total += size
        done += 1
        print(f"OK {key} {dur:6.1f}s {size/1e6:5.2f}MB")
    if fails:
        print("\n".join("FAIL " + f for f in fails), file=sys.stderr)
        return 1
    print(f"\n{done} TRACKS READY — total {total/1e6:.1f}MB (avg {total/max(1, done)/1e6:.2f}MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
