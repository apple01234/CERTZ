#!/usr/bin/env python3
"""16px 원본 타일에서 256px 지면 텍스처를 합성한다 (격자무늬 없이).

문제
----
게임은 256x256 타일을 setScale(0.125) 로 32px 로 줄여 바둑판처럼 깐다.
16px 원본을 256 안에 16번 타일링하면(=방식 A) 축소 후에도 격자가 그대로
드러나 '바둑판'처럼 보인다. 반대로 단순 확대(=방식 B)는 픽셀 블록이 크게
보인다.

해법
----
원본을 서로 다른 배율로 여러 번 타일링한 레이어를 만들고, 레이어마다
**위상을 어긋나게** 배치한 뒤 평균한다. 같은 패턴이 정확히 겹치지 않으므로
주기(격자)가 상쇄되고, 원본의 질감은 유지된다. 마지막에 미세 노이즈를
더해 단조로움을 없앤다.

사용
----
  python3 tools/tile_synth.py --dry-run
  python3 tools/tile_synth.py --apply
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
SOURCE_TILE = "/tmp/tiles_out/FAP1/r19_c30.png"

# 타일 이름 → (hue, 채도배율, 명도배율)
THEMES = {
    "tile_grass": (0.24, 1.00, 1.00), "tile_grass2": (0.30, 0.92, 1.05),
    "tile_grass_flower": (0.20, 1.05, 1.08), "tile_forest": (0.32, 1.00, 0.86),
    "tile_moss": (0.28, 1.10, 0.92), "tile_snow": (0.55, 0.14, 1.55),
    "tile_snow_deep": (0.58, 0.10, 1.68), "tile_ice": (0.52, 0.55, 1.35),
    "tile_frost": (0.50, 0.35, 1.25), "tile_sand": (0.11, 0.75, 1.28),
    "tile_desert": (0.09, 0.85, 1.20), "tile_dirt": (0.07, 0.60, 0.92),
    "tile_path": (0.09, 0.22, 1.02), "tile_path_dark": (0.08, 0.18, 0.78),
    "tile_magma": (0.03, 1.15, 1.00), "tile_lava": (0.02, 1.30, 1.12),
    "tile_magma_path": (0.04, 1.05, 0.90), "tile_ash": (0.00, 0.10, 0.72),
    "tile_hel": (0.76, 0.55, 0.72), "tile_void": (0.72, 0.65, 0.55),
    "tile_abyss": (0.66, 0.70, 0.60), "tile_deep": (0.60, 0.60, 0.50),
    "tile_nebula": (0.80, 0.85, 0.88), "tile_starfield": (0.62, 0.75, 0.48),
    "tile_divine": (0.13, 0.50, 1.45), "tile_water": (0.52, 0.90, 1.05),
    "tile_cave": (0.06, 0.20, 0.68), "tile_cave_wet": (0.50, 0.45, 0.72),
    "tile_basalt": (0.68, 0.22, 0.58), "tile_ruin": (0.10, 0.18, 0.86),
    "tile_morgue": (0.75, 0.12, 0.66), "tile_vault": (0.11, 0.40, 0.95),
    "tile_bone": (0.12, 0.16, 1.30), "tile_blood": (0.99, 0.95, 0.66),
    "tile_gold": (0.12, 0.95, 1.28), "tile_amber": (0.08, 1.00, 1.16),
    "tile_marble": (0.58, 0.10, 1.50), "tile_brick": (0.04, 0.42, 0.84),
    "tile_stone": (0.09, 0.10, 1.06), "tile_cobble": (0.10, 0.12, 0.92),
    "tile_concrete": (0.10, 0.05, 1.12), "tile_metal": (0.60, 0.14, 1.02),
    "tile_rust": (0.05, 0.70, 0.80), "tile_tech": (0.55, 0.65, 0.92),
    "tile_mushroom": (0.88, 0.70, 0.90), "tile_garden": (0.22, 1.10, 1.06),
}


def hsv_shift(src: np.ndarray, hue: float, sat_mult: float, val_mult: float) -> np.ndarray:
    """RGB(float 0~1) → HSV 변환 후 색상 회전."""
    a = src.astype(np.float32) / 255.0
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mx = np.max(a, axis=2)
    mn = np.min(a, axis=2)
    v = mx
    s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    m = mx == r
    h[m] = ((g - b)[m] / d[m]) % 6
    m = (mx == g) & ~(mx == r)
    h[m] = ((b - r)[m] / d[m]) + 2
    m = (mx == b) & ~(mx == r) & ~(mx == g)
    h[m] = ((r - g)[m] / d[m]) + 4
    h = h / 6.0

    h2 = np.full_like(h, hue)
    s2 = np.clip(s * sat_mult, 0, 1)
    v2 = np.clip(v * val_mult, 0, 1)
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p = v2 * (1 - s2)
    q = v2 * (1 - f * s2)
    t = v2 * (1 - (1 - f) * s2)
    out = np.zeros_like(a)
    for idx, (rr, gg, bb) in enumerate([(v2, t, p), (q, v2, p), (p, v2, t),
                                       (p, q, v2), (t, p, v2), (v2, p, q)]):
        m = i == idx
        out[:, :, 0][m] = rr[m]
        out[:, :, 1][m] = gg[m]
        out[:, :, 2][m] = bb[m]
    return (out * 255).clip(0, 255).astype(np.uint8)


def wrap_shift(arr: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """주기 경계를 유지한 채 위상을 이동한다 (roll)."""
    return np.roll(np.roll(arr, dy, axis=0), dx, axis=1)


def synth(src16: np.ndarray, size: int = 256, seed: int = 0) -> Image.Image:
    """여러 배율·위상의 타일링 레이어를 평균해 격자를 상쇄한다."""
    rng = np.random.default_rng(seed)
    h, w = src16.shape[:2]
    acc = np.zeros((size, size, 3), np.float32)
    wsum = 0.0

    # 배율별 레이어: 원본을 n배 확대한 뒤 타일링, 위상은 매번 랜덤
    for scale, weight in [(2, 0.5), (4, 0.3), (8, 0.2)]:
        th, tw = h * scale, w * scale
        base = np.array(Image.fromarray(src16).resize((tw, th), Image.LANCZOS))
        layer = np.zeros((size, size, 3), np.float32)
        n_y = int(np.ceil(size / th)) + 1
        n_x = int(np.ceil(size / tw)) + 1
        dy = int(rng.integers(0, th))
        dx = int(rng.integers(0, tw))
        for y in range(n_y):
            for x in range(n_x):
                oy, ox = y * th - dy, x * tw - dx
                y0, y1 = max(oy, 0), min(oy + th, size)
                x0, x1 = max(ox, 0), min(ox + tw, size)
                if y0 >= y1 or x0 >= x1:
                    continue
                layer[y0:y1, x0:x1] = base[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        # 경계 이음새를 없애기 위해 레이어 자체를 주기적으로 감싼다
        layer = wrap_shift(layer, size // 2, size // 2)
        acc += layer * weight
        wsum += weight

    out = acc / max(wsum, 1e-6)

    # 미세 노이즈 — 단조로움 제거 목적. 과하면 '직물'처럼 보이므로 약하게.
    noise = rng.normal(0, 1.6, (size, size, 3))
    out = np.clip(out + noise, 0, 255)

    return Image.fromarray(out.astype(np.uint8), "RGB")


def grid_score(im: Image.Image, period: int = 16) -> float:
    """주기(격자) 성분의 강도를 측정. 낮을수록 격자가 안 보인다."""
    a = np.asarray(im.convert("L")).astype(np.float32)
    # period 간격으로 떨어진 픽셀의 상관 = 격자 주기성
    corr = np.corrcoef(a[:, :-period].ravel(), a[:, period:].ravel())[0, 1]
    return float(corr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--size", type=int, default=256)
    args = ap.parse_args()

    if not os.path.exists(SOURCE_TILE):
        raise SystemExit(f"원본 없음: {SOURCE_TILE}\n먼저 tools/extract_seamless_tiles.py --save 로 추출하세요")
    base = np.array(Image.open(SOURCE_TILE).convert("RGB"))
    print(f"원본 {SOURCE_TILE} {base.shape[1]}x{base.shape[0]}")

    print(f"{'이름':20s} {'격자':>7s} {'std':>7s}")
    print("-" * 40)
    ok = 0
    for i, (name, (hue, sat, val)) in enumerate(THEMES.items()):
        colored = hsv_shift(base, hue, sat, val)
        im = synth(colored, args.size, seed=i + 1)
        g = grid_score(im)
        std = float(np.asarray(im).std())
        flag = "OK" if g < 0.55 else "★"
        print(f"{name:20s} {g:7.3f} {std:7.1f} {flag}")
        if args.apply:
            im.save(os.path.join(ASSETS, name + ".webp"), "WEBP", quality=95, method=4)
            ok += 1
    print("-" * 40)
    print(f"{'생성' if args.apply else '(--apply 로 기록)'} {ok if args.apply else len(THEMES)}종")


if __name__ == "__main__":
    sys.exit(main())
