#!/usr/bin/env python3
"""PuzzleLevelMapPack 배경에서 심리스 지면 타일을 추출한다.

배경
----
유저 지적 #5·#8·#9:
  "타일맵 ㅈㄴ 이상함 (ex. 잔디 지형이면 타일셋에 있는 9개중에 가장 가운데 있는
   초록색만 있는부분 사용해)"
  "타일맵 에셋 갯수가 부족하니?? 에셋좀 너가 itch.io에서 무료에셋 ㅈㄴ 다운받아"
  "기차길 타일맵 진짜 어울리는 지역에서만 사용하고 나머지는 사용하지마 (ㅈㄴ 안어울림)"

해법
----
배급 팩(x1/PuzzleLevelMapPack)에는 테마별 **1920x1080 배경**이 8종 있다
(Greenforest / Jungle / Coniferous / Crystal / Desert / Swamp / Tundra / BambooForest).
이 배경에서 "장식이 없는 균일한 지면 블록"을 자동 탐색해 256x256 심리스 타일로
잘라낸다. hue 회전변형(_v1/_v2)도 함께 만들어 64px 주기 반복을 깬다.

사용
----
  python3 tools/extract_theme_tiles.py --dry-run
  python3 tools/extract_theme_tiles.py --apply
"""
import argparse
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
SRC = "/root/workspace/_assets_in/x1/PuzzleLevelMapPack/1_ForestLevelMapMaker/Sprites/Map/Backgrounds/Horizontal"

# 테마 → (출력 접두사, 색 조건)
#   color="green"  : 초록 잔디 (G 우세)
#   color="sand"   : 모래/황토 (R·G 우세, B 낮음)
#   color="snow"   : 눈/서리 (밝고 저채도)
#   color="dark"   : 어두운 지면 (숲 바닥·늪)
THEMES = {
    "Greenforest":   ("tile_grass_forest", "green"),
    "Jungle":        ("tile_grass_jungle", "green"),
    "Coniferous":    ("tile_grass_pine",   "green"),
    "Tundra":        ("tile_grass_tundra", "snow"),
    "Swamp":         ("tile_grass_swamp",  "dark"),
    "Desert":        ("tile_sand_desert",  "sand"),
    "Crystal":       ("tile_crystal",      "dark"),
    "Bambooforest":  ("tile_grass_bamboo", "green"),
}

TILE = 256   # 출력 타일 크기(현재 게임 타일 규격)
SCAN = 64    # 후보 블록 크기(균일도 탐색용)
VARIANTS = 3  # 본 + 변형 2


def find_flat_block(a: np.ndarray, size: int, color: str = "any") -> tuple[int, int] | None:
    """장식이 가장 적은(표준편차 최소) 블록 좌표를 찾는다.

    v1.4.38 — want_green=True 면 "초록 잔디다운" 블록만 후보로 삼는다.
    종전엔 표준편차만 봐서 **단색 회색 벽·하늘**을 골랐다(실측: Greenforest 가
    RGB(99,121,102) 회색, Coniferous 가 (80,54,5) 갈색). 지면 타일은 색이 곧 정체성이라
    색 조건을 먼저 걸고 그 안에서 균일도를 최소화해야 한다.
    """
    H, W, _ = a.shape
    best = None
    for y in range(0, H - size + 1, SCAN):
        for x in range(0, W - size + 1, SCAN):
            t = a[y:y + size, x:x + size]
            R, G, B = t[..., 0].mean(), t[..., 1].mean(), t[..., 2].mean()
            m = float(t.mean())
            # 너무 어둡거나(그림자) 너무 밝은(하늘·눈) 블록은 제외
            if m < 25 or m > 235:
                continue
            if color == "green":
                # 채도 있는 초록 잔디만
                if not (G > R + 20 and G > B + 45 and G >= 60):
                    continue
            elif color == "sand":
                # 모래·황토: R·G 우세, B 낮음
                if not (R >= 120 and G >= 100 and B < G - 30):
                    continue
            elif color == "snow":
                # 눈·서리: 밝고 저채도
                if not (m >= 175 and (max(R, G, B) - min(R, G, B)) < 45):
                    continue
            elif color == "dark":
                # 숲 바닥·늪: 어둡고 초록기 도는 지면
                if not (m < 130 and G >= R and G >= B - 10):
                    continue
            std = float(t.std())
            if best is None or std < best[0]:
                best = (std, x, y)
    return (best[1], best[2]) if best else None


def make_seamless(tile: np.ndarray) -> np.ndarray:
    """오프셋 블렌딩으로 이음새를 부드럽게 만든다.

    정확히 절반씩 밀어 겹친 뒤 크로스페이드하면 타일 경계가 이어진다
    (텍스처 합성에서 흔히 쓰는 mirror-wrap 방식).
    """
    h, w, c = tile.shape
    out = tile.astype(np.float32).copy()
    # 좌우/상하 wrap 블렌딩 (가장자리 1/8 구간만 부드럽게)
    band = max(4, w // 8)
    for i in range(band):
        t = i / band
        # 좌 ↔ 우
        left = tile[:, i].astype(np.float32)
        right = tile[:, w - band + i].astype(np.float32)
        out[:, w - band + i] = right * (1 - t) + left * t
        # 상 ↔ 하
        top = tile[i, :].astype(np.float32)
        bot = tile[h - band + i, :].astype(np.float32)
        out[h - band + i, :] = bot * (1 - t) + top * t
    return np.clip(out, 0, 255).astype(np.uint8)


def hue_shift(a: np.ndarray, dh: float, sat: float = 1.0, val: float = 1.0) -> np.ndarray:
    """RGB 배열의 hue 회전 (알파 없음 — 지면 타일은 불투명). numpy 벡터화."""
    h, w, _ = a.shape
    flat = a.reshape(-1, 3).astype(np.float32) / 255.0
    r, g, b = flat[:, 0], flat[:, 1], flat[:, 2]
    mx = flat.max(axis=1)
    mn = flat.min(axis=1)
    l = (mx + mn) / 2.0
    d = mx - mn
    s = np.where(d < 1e-6, 0.0, d / np.maximum(1e-6, 1.0 - np.abs(2 * l - 1)))
    # hue 계산
    hh = np.zeros_like(mx)
    nz = d > 1e-6
    # max 가 r/g/b 인 경우를 나눠 계산
    im_r = nz & (mx == r)
    im_g = nz & (mx == g)
    im_b = nz & (mx == b)
    hh[im_r] = ((g[im_r] - b[im_r]) / d[im_r]) % 6
    hh[im_g] = (b[im_g] - r[im_g]) / d[im_g] + 2
    hh[im_b] = (r[im_b] - g[im_b]) / d[im_b] + 4
    hh = hh / 6.0
    hh = (hh + dh) % 1.0
    s = np.clip(s * sat, 0, 1)
    l = np.clip(l * val, 0, 1)
    # hls → rgb
    c = (1 - np.abs(2 * l - 1)) * s
    hp = (hh * 6.0) % 6.0
    x = c * (1 - np.abs(hp % 2 - 1))
    z = np.zeros_like(c)
    cond = hp.astype(int) % 6
    rr = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4], [c, x, z, z, x], default=c)
    gg = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4], [x, c, c, x, z], default=z)
    bb = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4], [z, z, x, c, c], default=x)
    m = l - c / 2
    out = np.stack([rr + m, gg + m, bb + m], axis=1)
    return np.clip(out.reshape(h, w, 3) * 255, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        ap.print_help()
        return 1

    made = 0
    # 원본 배급 팩의 파일명은 테마명과 정확히 일치하지 않는다(오타·대소문자).
    #   "Map Horizontall Crystal.png" (L 두 개), "Map Horizontal BambooForest.png" (F 대문자)
    FILENAME_FIX = {
        "Crystal": ["Map Horizontall Crystal.png", "Map Horizontal Crystal.png"],
        "Bambooforest": ["Map Horizontal BambooForest.png", "Map Horizontal Bambooforest.png"],
    }
    for theme, (out_name, color) in THEMES.items():
        cands = FILENAME_FIX.get(theme, []) + [f"Map Horizontal {theme}.png"]
        p = next((os.path.join(SRC, c) for c in cands if os.path.exists(os.path.join(SRC, c))), None)
        if p is None:
            print(f"  SKIP {theme} — 원본 없음")
            continue
        im = Image.open(p).convert("RGB")
        a = np.array(im)
        pos = find_flat_block(a, TILE, color)
        if pos is None:
            print(f"  SKIP {theme} — 균일 블록 미발견")
            continue
        x, y = pos
        tile = a[y:y + TILE, x:x + TILE]
        seam = make_seamless(tile)
        rgb = seam.reshape(-1, 3).mean(axis=0).round(0)
        names = [f"{out_name}.webp", f"{out_name}_v1.webp", f"{out_name}_v2.webp"]
        shifts = [(0.0, 1.0, 1.0), (0.02, 1.05, 0.94), (-0.02, 0.95, 1.06)]

        if args.apply:
            for nm, (dh, s, v) in zip(names, shifts):
                out = seam if dh == 0.0 else hue_shift(seam, dh, s, v)
                Image.fromarray(out, "RGB").save(os.path.join(ASSETS, nm), "WEBP", quality=92, method=6)
        made += 1
        print(f"  {out_name:24s} ← {theme:14s} ({x},{y}) RGB=({rgb[0]:.0f},{rgb[1]:.0f},{rgb[2]:.0f})  {len(names)}종")

    print(f"\n{'생성' if args.apply else '생성 예정'} {made}테마 x {VARIANTS} = {made*VARIANTS}장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
