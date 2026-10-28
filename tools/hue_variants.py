#!/usr/bin/env python3
"""타일셋에서 뽑은 원본 타일을 색조 변환해 SERTZ 27색 지형을 만든다.

배경
----
배급된 에셋에는 '반복 가능한 지면 타일'이 팩당 몇 종뿐이다(실측: FAP2 는
사실상 회청색 돌 1종, Cainos Grass 는 잔디 1종). 그런데 SERTZ 는 9왕국 +
DLC 10행성으로 27종 지형이 필요하다.

해법
----
원본 타일의 **명도 구조(질감)는 유지하고 색상(hue)만 회전**시켜 테마별
변형을 만든다. 이렇게 하면 질감·이음새 품질은 원본 그대로면서 팔레트만
테마에 맞출 수 있다.

주의
----
- 채도가 낮은 회색 계열은 hue 회전이 거의 먹지 않는다 → 채도를 먼저 올린다.
- 잔디처럼 채도가 높은 원본은 hue 회전만으로 충분하다.
- 생성 후 반드시 3x3 타일링으로 이음새를 재검증한다.

사용
----
  python3 tools/hue_variants.py --dry-run
  python3 tools/hue_variants.py --apply
"""
import argparse
import colorsys
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")

# ── 테마 정의: 타일 이름 → (기준 hue 0~1, 채도 배율, 명도 배율, 원본 종류)
#    기준 hue: 0=적, 0.08=주황, 0.14=황, 0.28=연두, 0.38=녹, 0.5=청,
#              0.6=남, 0.72=보라, 0.82=자홍
THEMES = {
    # 9왕국
    "tile_grass":        (0.24, 1.00, 1.00, "grass"),
    "tile_grass2":       (0.30, 0.92, 1.05, "grass"),
    "tile_grass_flower": (0.20, 1.05, 1.08, "grass"),
    "tile_forest":       (0.32, 1.00, 0.86, "grass"),
    "tile_moss":         (0.28, 1.10, 0.92, "grass"),
    "tile_snow":         (0.55, 0.14, 1.55, "grass"),
    "tile_snow_deep":    (0.58, 0.10, 1.68, "grass"),
    "tile_ice":          (0.52, 0.55, 1.35, "grass"),
    "tile_frost":        (0.50, 0.35, 1.25, "grass"),
    "tile_sand":         (0.11, 0.75, 1.28, "grass"),
    "tile_desert":       (0.09, 0.85, 1.20, "grass"),
    "tile_dirt":         (0.07, 0.60, 0.92, "grass"),
    "tile_path":         (0.09, 0.22, 1.02, "grass"),
    "tile_path_dark":    (0.08, 0.18, 0.78, "grass"),
    "tile_magma":        (0.03, 1.15, 1.00, "grass"),
    "tile_lava":         (0.02, 1.30, 1.12, "grass"),
    "tile_magma_path":   (0.04, 1.05, 0.90, "grass"),
    "tile_ash":          (0.00, 0.10, 0.72, "grass"),
    "tile_hel":          (0.76, 0.55, 0.72, "grass"),
    "tile_void":         (0.72, 0.65, 0.55, "grass"),
    "tile_abyss":        (0.66, 0.70, 0.60, "grass"),
    "tile_deep":         (0.60, 0.60, 0.50, "grass"),
    "tile_nebula":       (0.80, 0.85, 0.88, "grass"),
    "tile_starfield":    (0.62, 0.75, 0.48, "grass"),
    "tile_divine":       (0.13, 0.50, 1.45, "grass"),
    "tile_water":        (0.52, 0.90, 1.05, "grass"),
    # DLC / 실내
    "tile_cave":         (0.06, 0.20, 0.68, "grass"),
    "tile_cave_wet":     (0.50, 0.45, 0.72, "grass"),
    "tile_basalt":       (0.68, 0.22, 0.58, "grass"),
    "tile_ruin":         (0.10, 0.18, 0.86, "grass"),
    "tile_morgue":       (0.75, 0.12, 0.66, "grass"),
    "tile_vault":        (0.11, 0.40, 0.95, "grass"),
    "tile_bone":         (0.12, 0.16, 1.30, "grass"),
    "tile_blood":        (0.99, 0.95, 0.66, "grass"),
    "tile_gold":         (0.12, 0.95, 1.28, "grass"),
    "tile_amber":        (0.08, 1.00, 1.16, "grass"),
    "tile_marble":       (0.58, 0.10, 1.50, "grass"),
    "tile_brick":        (0.04, 0.42, 0.84, "grass"),
    "tile_stone":        (0.09, 0.10, 1.06, "grass"),
    "tile_cobble":       (0.10, 0.12, 0.92, "grass"),
    "tile_concrete":     (0.10, 0.05, 1.12, "grass"),
    "tile_metal":        (0.60, 0.14, 1.02, "grass"),
    "tile_rust":         (0.05, 0.70, 0.80, "grass"),
    "tile_tech":         (0.55, 0.65, 0.92, "grass"),
    "tile_mushroom":     (0.88, 0.70, 0.90, "grass"),
    "tile_garden":       (0.22, 1.10, 1.06, "grass"),
}

SOURCE_TILE = "/tmp/tiles_out/FAP1/r19_c30.png"


def load_source():
    if os.path.exists(SOURCE_TILE):
        return Image.open(SOURCE_TILE).convert("RGB")
    # 폴백: 배포 중인 타일 하나
    for name in ("tile_grass", "tile_stone"):
        p = os.path.join(ASSETS, name + ".webp")
        if os.path.exists(p):
            return Image.open(p).convert("RGB").resize((16, 16), Image.LANCZOS)
    raise SystemExit("원본 타일을 찾지 못했습니다")


def recolor(src: Image.Image, hue: float, sat_mult: float, val_mult: float) -> Image.Image:
    a = np.asarray(src).astype(np.float32) / 255.0
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mx = np.max(a, axis=2)
    mn = np.min(a, axis=2)
    v = mx
    s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    # hue 계산
    d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    m = (mx == r)
    h[m] = ((g - b)[m] / d[m]) % 6
    m = (mx == g) & ~(mx == r)
    h[m] = ((b - r)[m] / d[m]) + 2
    m = (mx == b) & ~(mx == r) & ~(mx == g)
    h[m] = ((r - g)[m] / d[m]) + 4
    h = h / 6.0

    # 변환: 목표 hue 로 이동, 채도/명도 배율 적용
    h2 = np.full_like(h, hue)
    s2 = np.clip(s * sat_mult, 0, 1)
    v2 = np.clip(v * val_mult, 0, 1)

    # HSV → RGB
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p = v2 * (1 - s2)
    q = v2 * (1 - f * s2)
    t = v2 * (1 - (1 - f) * s2)
    out = np.zeros_like(a)
    for idx, (rr, gg, bb) in enumerate([
        (v2, t, p), (q, v2, p), (p, v2, t),
        (p, q, v2), (t, p, v2), (v2, p, q)]):
        m = (i == idx)
        out[:, :, 0][m] = rr[m]
        out[:, :, 1][m] = gg[m]
        out[:, :, 2][m] = bb[m]
    return Image.fromarray((out * 255).clip(0, 255).astype(np.uint8), "RGB")


def seam_check(t: Image.Image) -> float:
    a = np.asarray(t).astype(np.float32)
    inner = np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()
    edge = np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0, :] - a[-1, :]).mean()
    return float(edge / (inner / 2 + 1e-6))


def tile_to(t: Image.Image, size: int) -> Image.Image:
    """작은 타일을 반복해 size x size 를 채운다 (픽셀 격자 유지)."""
    w, h = t.size
    n = max(1, size // w)
    out = Image.new("RGB", (w * n, h * n))
    for y in range(n):
        for x in range(n):
            out.paste(t, (x * w, y * h))
    if out.size != (size, size):
        out = out.resize((size, size), Image.NEAREST)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--size", type=int, default=128)
    args = ap.parse_args()

    src = load_source()
    print(f"원본 타일: {SOURCE_TILE} {src.size}")
    print(f"{'이름':20s} {'hue':>5s} {'sat':>5s} {'val':>5s} {'seam':>6s}")
    print("-" * 52)
    made = 0
    for name, (hue, sat, val, _kind) in THEMES.items():
        t = recolor(src, hue, sat, val)
        # 기존 타일은 전부 256x256 이고 WorldScene 이 setScale(0.125) 로 32px 타일링한다.
        # 16px 을 NEAREST 로 늘리면 뭉개지므로 타일 반복으로 256 을 채운 뒤
        # 픽셀 격자를 살리기 위해 NEAREST 로 확대한다.
        t = tile_to(t, args.size)
        seam = seam_check(t)
        # seam_check 는 '경계 차이 / 내부 차이' 비율이다. 16px 원본을 16번 반복하면
        # 경계가 원본 타일 경계와 같아져 내부보다 클 수 있다(정상). 실제 이음새
        # 유무는 원본 타일 자체가 seamless 인지로 판정해야 하므로 원본에서 잰다.
        src_seam = seam_check(recolor(src, hue, sat, val))
        ok = src_seam < 3.0
        print(f"{name:20s} {hue:5.2f} {sat:5.2f} {val:5.2f} {src_seam:6.2f} {'OK' if ok else '★'}")
        if args.apply and ok:
            t.save(os.path.join(ASSETS, name + ".webp"), "WEBP", quality=95, method=4)
            made += 1
    print("-" * 52)
    print(f"{'생성' if args.apply else '(--apply 로 기록)'} {made if args.apply else len(THEMES)}종")


if __name__ == "__main__":
    sys.exit(main())
