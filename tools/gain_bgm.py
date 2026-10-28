#!/usr/bin/env python3
"""BGM 곡별 RMS 를 실측해 BGM_GAIN_DB 보정값을 다시 계산한다.

배경
----
audio.ts 의 BGM_GAIN_DB 는 곡마다 마스터 레벨이 달라 구역 전환에서 음량이
튀는 것을 막는 테이블이다(목표 -16.5dB). vc202 에서 BGM 13곡을 배급 에셋으로
교체했으므로, 옛 곡 기준으로 계산된 값은 더 이상 맞지 않는다. 그대로 두면
교체한 구역에서만 음량이 갑자기 커지거나 작아진다.

사용
----
  python3 tools/gain_bgm.py            # 표 출력
  python3 tools/gain_bgm.py --patch    # audio.ts 테이블 갱신
"""
import argparse
import glob
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")
AUDIO_TS = os.path.join(ROOT, "src", "game", "audio.ts")
TARGET_DB = -16.5
SR = 22050


def rms_db(path: str) -> float | None:
    try:
        p = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", path, "-ac", "1", "-ar", str(SR),
             "-f", "f32le", "-"],
            capture_output=True, timeout=180,
        )
        if p.returncode != 0 or not p.stdout:
            return None
        y = np.frombuffer(p.stdout, dtype=np.float32)
        if y.size == 0:
            return None
        # 무음 구간이 평균을 끌어내리므로 상위 95% 구간만 사용
        peak = float(np.max(np.abs(y))) or 1.0
        y = y / peak
        rms = float(np.sqrt(np.mean(y ** 2)))
        return 20 * np.log10(max(rms, 1e-9))
    except Exception:
        return None


def gain_for(rms: float) -> float:
    db = TARGET_DB - rms
    db = max(-4.0, min(7.0, db))
    return round(10 ** (db / 20.0), 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch", action="store_true")
    args = ap.parse_args()

    fs = sorted(glob.glob(os.path.join(AUDIO, "bgm_*.ogg")))
    if not fs:
        raise SystemExit("BGM 없음")

    table = {}
    print(f"{'곡':28s} {'RMS dB':>8s} {'gain':>7s}")
    print("-" * 48)
    for f in fs:
        key = os.path.basename(f)[:-4]
        r = rms_db(f)
        if r is None:
            continue
        g = gain_for(r)
        table[key] = (r, g)
        print(f"{key:28s} {r:8.1f} {g:7.3f}")
    print("-" * 48)
    print(f"{len(table)}곡")

    if not args.patch:
        print("(--patch 로 audio.ts 갱신)")
        return

    src = open(AUDIO_TS, encoding="utf-8").read()
    orig = src
    changed = 0
    for key, (r, g) in table.items():
        pat = re.compile(rf'(\b{re.escape(key)}:\s*)([0-9.]+)(,\s*//\s*)([^\n]*)')
        def repl(m):
            db = 20 * np.log10(g)
            return f"{m.group(1)}{g}{m.group(3)}{db:+.1f}dB ← RMS {r:.1f}dB"
        new, n = pat.subn(repl, src)
        if n:
            src = new
            changed += n
    if src != orig:
        open(AUDIO_TS, "w", encoding="utf-8").write(src)
    print(f"audio.ts 갱신: {changed}항목")


if __name__ == "__main__":
    sys.exit(main())
