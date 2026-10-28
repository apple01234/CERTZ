#!/usr/bin/env python3
"""BGM 트랙의 문제를 실측한다: 고BPM / 화이트노이즈 과다 / AI 생성 흔적.

배경
----
사용자 지시: "BPM이 엄청 빠르고 보스전 음악 같은 것들이 화이트 노이즈가 많이
들린다. 그런 곡들이랑 화이트 노이즈가 많은 AI 노래들은 고급 에셋 BGM으로 바꿔."

주관으로 고르면 안 되므로 지표를 잰다.

지표
----
1) BPM
   - 온셋(에너지 증가) 엔벨로프를 자기상관해 주기(비트 간격)를 찾는다.
   - 60~200 범위로 접어 실제 템포를 추정.
2) 화이트노이즈 비율 (noise_ratio)
   - 스펙트럼 평탄도(spectral flatness)의 평균. 1.0 에 가까우면 백색잡음.
   - 음악은 보통 0.05~0.35, 노이즈가 많으면 0.45 이상.
   - 추가로 6kHz 이상 대역 에너지 비율을 함께 본다(치찰음/히스).
3) 클리핑 (clip_ratio)
   - |sample| >= 0.999 비율. 마스터링이 과하면 지직거린다.
4) DC 오프셋 · 무음 비율

ffmpeg 로 8kHz 모노 PCM 을 뽑아 분석한다(고속).

사용
----
  python3 tools/analyze_bgm.py                 # 표 출력
  python3 tools/analyze_bgm.py --csv out.csv   # CSV 저장
"""
import argparse
import csv
import glob
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BGM_DIR = os.path.join(ROOT, "public", "assets", "audio")
# 22.05kHz — 6kHz 대역(치찰음·히스)까지 측정하려면 나이퀴스트가 11kHz 이상이어야 한다.
# 11kHz 로 뽑으면 최대 주파수가 5.5kHz 라 hi6k 지표가 항상 0이 된다.
SR = 22050


def decode(path: str) -> np.ndarray | None:
    """ffmpeg 로 모노 float32 PCM 디코드."""
    try:
        p = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", path, "-ac", "1", "-ar", str(SR),
             "-f", "f32le", "-"],
            capture_output=True, timeout=180,
        )
        if p.returncode != 0 or not p.stdout:
            return None
        return np.frombuffer(p.stdout, dtype=np.float32)
    except Exception:
        return None


def estimate_bpm(y: np.ndarray) -> float:
    """온셋 엔벨로프 자기상관으로 BPM 추정."""
    hop = 256
    n = len(y) // hop
    if n < 32:
        return 0.0
    frames = y[:n * hop].reshape(n, hop)
    energy = np.sqrt((frames ** 2).mean(axis=1))
    # 온셋 = 에너지의 양의 차분
    onset = np.maximum(np.diff(energy), 0)
    if onset.std() < 1e-9:
        return 0.0
    onset = onset - onset.mean()
    ac = np.correlate(onset, onset, mode="full")[len(onset) - 1:]
    if ac[0] <= 0:
        return 0.0
    ac = ac / ac[0]
    fps = SR / hop
    # 60~200 BPM → lag 범위
    lo = int(fps * 60 / 200)
    hi = min(int(fps * 60 / 60), len(ac) - 1)
    if hi <= lo + 2:
        return 0.0
    seg = ac[lo:hi]
    lag = lo + int(np.argmax(seg))
    if lag <= 0:
        return 0.0
    bpm = 60.0 * fps / lag
    # 2배/절반 접기
    while bpm < 70:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return float(bpm)


def analyze(y: np.ndarray) -> dict:
    n = len(y)
    if n < SR:
        return {}
    y = y - float(np.mean(y))          # DC 제거
    peak = float(np.max(np.abs(y))) or 1.0
    y = y / max(peak, 1e-9)

    clip_ratio = float((np.abs(y) >= 0.999).mean())
    silence = float((np.abs(y) < 1e-4).mean())

    # 스펙트럼 평탄도 (프레임별 기하평균/산술평균)
    win = 1024
    hop = 512
    nf = max(1, (n - win) // hop)
    flats, his = [], []
    for i in range(0, nf, max(1, nf // 600)):   # 최대 ~600 프레임만
        seg = y[i * hop: i * hop + win]
        if len(seg) < win:
            break
        sp = np.abs(np.fft.rfft(seg * np.hanning(win))) + 1e-10
        gm = np.exp(np.mean(np.log(sp)))
        am = np.mean(sp)
        flats.append(float(gm / am))
        freqs = np.fft.rfftfreq(win, 1 / SR)
        hi = sp[freqs >= 6000]
        his.append(float(hi.sum() / sp.sum()) if sp.sum() > 0 else 0.0)

    return {
        "sec": round(n / SR, 1),
        "bpm": round(estimate_bpm(y), 1),
        "flatness": round(float(np.mean(flats)) if flats else 0, 4),
        "hi6k": round(float(np.mean(his)) if his else 0, 4),
        "clip": round(clip_ratio, 5),
        "silence": round(silence, 4),
    }


def score(r: dict) -> tuple[float, list[str]]:
    """교체 우선순위 점수 (높을수록 나쁨) + 사유.

    사용자 지시(vc202): "BPM이 빨라도 화이트 노이즈가 없으면 AI 노래여도 된다."
    → BPM 은 판정에서 제외한다. 교체 기준은 화이트노이즈(스펙트럼 평탄도)와
      고역 치찰음뿐이다. 클리핑·무음은 보조 지표로만 남긴다.
    """
    s, why = 0.0, []
    f = r.get("flatness", 0)
    if f >= 0.45:
        s += 3.0
        why.append(f"화이트노이즈 {f:.2f}")
    elif f >= 0.32:
        s += 1.5
        why.append(f"노이즈 {f:.2f}")
    if r.get("hi6k", 0) >= 0.30:
        s += 2.0
        why.append(f"고역과다 {r['hi6k']:.2f}")
    elif r.get("hi6k", 0) >= 0.18:
        s += 1.0
        why.append(f"고역 {r['hi6k']:.2f}")
    if r.get("clip", 0) >= 0.001:
        s += 1.5
        why.append(f"클리핑 {r['clip']*100:.2f}%")
    return s, why


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv")
    ap.add_argument("--dir", default=BGM_DIR)
    args = ap.parse_args()

    fs = []
    for ext in ("*.ogg", "*.mp3", "*.wav", "*.flac"):
        fs += sorted(glob.glob(os.path.join(args.dir, ext)))
    if not fs:
        raise SystemExit(f"오디오 없음: {args.dir}")

    rows = []
    for f in fs:
        y = decode(f)
        if y is None:
            print(f"  ✕ 디코드 실패 {os.path.basename(f)}")
            continue
        r = analyze(y)
        if not r:
            continue
        r["file"] = os.path.basename(f)
        s, why = score(r)
        r["score"] = round(s, 1)
        r["why"] = "; ".join(why)
        rows.append(r)

    rows.sort(key=lambda x: -x["score"])
    print(f"{'파일':26s} {'BPM':>5s} {'flat':>6s} {'hi6k':>6s} {'점수':>5s}  사유")
    print("-" * 100)
    for r in rows:
        print(f"{r['file'][:26]:26s} {r['bpm']:5.0f} {r['flatness']:6.3f} "
              f"{r['hi6k']:6.3f} {r['score']:5.1f}  {r['why']}")

    bad = [r for r in rows if r["score"] > 0]
    print("-" * 100)
    print(f"총 {len(rows)}곡 / 교체 대상 {len(bad)}곡")

    if args.csv:
        with open(args.csv, "w", newline="") as fp:
            w = csv.DictWriter(fp, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"CSV 저장: {args.csv}")


if __name__ == "__main__":
    sys.exit(main())
