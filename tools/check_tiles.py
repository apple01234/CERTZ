#!/usr/bin/env python3
"""
tile_audit.py — 지면 타일 전수 감사

각 타일의 "오브젝트 컷" 여부를 자동 지표로 걸러내고 표를 만든다.
지시서 §6·8 의 TILE_AUDIT.md 기반 데이터.

지표:
  - size / unique colors / alpha 비율
  - edge_seam: 2x2 반복 시 이음매 불연속(낮을수록 자연스러움)
  - tileability: 가장자리 vs 내부 분포 차이(작을수록 타일로 적합)
  - entropy: 색 분포 엔트로피
  - flat_ratio: 최빈색 비율(높으면 빈 타일)
판정은 지표 + 시각 시트로 최종 확인한다(자동 판정 단독 사용 금지).
"""
import os, sys, json, math, glob
from collections import Counter
from PIL import Image

ASSETS = "/root/workspace/CERTZ/public/assets"

def analyze(path):
    im = Image.open(path)
    mode = im.mode
    im = im.convert("RGBA")
    w, h = im.size
    px = list(im.getdata())
    total = w * h
    cols = Counter(px)
    nonzero_alpha = sum(1 for p in px if p[3] > 8)
    alpha_ratio = nonzero_alpha / total

    # 고유색(알파 무시하고 RGB 기준)
    rgb = Counter((p[0], p[1], p[2]) for p in px if p[3] > 8)
    unique = len(rgb)
    flat_ratio = (rgb.most_common(1)[0][1] / nonzero_alpha) if nonzero_alpha else 1.0

    # 엔트로피
    ent = 0.0
    if nonzero_alpha:
        for c, n in rgb.items():
            p = n / nonzero_alpha
            ent -= p * math.log2(p)

    # 이음매 점수: 좌우/상하 경계 픽셀 차이
    def pix(x, y):
        return im.getpixel((x, y))

    seam = 0.0
    cnt = 0
    for y in range(h):
        a, b = pix(w - 1, y), pix(0, y)
        seam += sum(abs(a[i] - b[i]) for i in range(3)) / 3
        cnt += 1
    for x in range(w):
        a, b = pix(x, h - 1), pix(x, 0)
        seam += sum(abs(a[i] - b[i]) for i in range(3)) / 3
        cnt += 1
    seam = seam / cnt if cnt else 0

    # 내부 인접 차이(타일 내 자연스러운 변화량) → 이음매와 비교
    inner = 0.0
    icnt = 0
    step = max(1, w // 48)
    for y in range(0, h - step, step):
        for x in range(0, w - step, step):
            a, b = pix(x, y), pix(x + step, y)
            inner += sum(abs(a[i] - b[i]) for i in range(3)) / 3
            a, b = pix(x, y), pix(x, y + step)
            inner += sum(abs(a[i] - b[i]) for i in range(3)) / 3
            icnt += 2
    inner = inner / icnt if icnt else 0

    ratio = (seam / inner) if inner > 0.01 else 0.0

    # 판정 힌트(자동, 참고용)
    flags = []
    if nono := (flat_ratio > 0.75):
        flags.append("FLAT")          # 거의 단색 = 빈 타일
    if unique <= 8:
        flags.append("LOWCOLOR")      # 색 너무 적음
    if alpha_ratio < 0.55:
        flags.append("MOSTLY_TRANSPARENT")  # 오브젝트 컷 의심
    if w != h:
        flags.append("NONSQUARE")
    if w < 32:
        flags.append("TOO_SMALL")

    return dict(file=os.path.basename(path), size=f"{w}x{h}", w=w, h=h,
                unique=unique, alpha=round(alpha_ratio, 3),
                flat=round(flat_ratio, 3), entropy=round(ent, 2),
                seam=round(seam, 2), inner=round(inner, 2), ratio=round(ratio, 2),
                flag=",".join(flags), bytes=os.path.getsize(path))

def main():
    paths = sorted(glob.glob(os.path.join(ASSETS, "tile_*.webp")))
    rows = []
    for p in paths:
        try:
            rows.append(analyze(p))
        except Exception as e:
            rows.append(dict(file=os.path.basename(p), error=str(e)))
    rows.sort(key=lambda r: r.get("bytes", 0))
    hdr = f"{'file':26s} {'size':>9s} {'uniq':>5s} {'alpha':>6s} {'flat':>6s} {'ent':>6s} {'seam':>6s} {'inner':>6s} {'r':>5s} {'bytes':>7s}  flags"
    print(hdr)
    print("-" * len(hdr))
    for r in rows:
        if "error" in r:
            print(f"{r['file']:26s} ERROR {r['error']}")
            continue
        print(f"{r['file']:26s} {r['size']:>9s} {r['unique']:>5d} {r['alpha']:>6.3f} {r['flat']:>6.3f} "
              f"{r['entropy']:>6.2f} {r['seam']:>6.2f} {r['inner']:>6.2f} {r['ratio']:>5.2f} {r['bytes']:>7d}  {r['flag']}")
    with open("/root/.hermes/cache/scratch/deploy/tile_audit.json", "w") as f:
        json.dump(rows, f, indent=1, ensure_ascii=False)
    print(f"\ntotal {len(rows)} tiles -> tile_audit.json")

if __name__ == "__main__":
    main()
