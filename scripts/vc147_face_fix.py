#!/usr/bin/env python3
"""vc147 (#27) — 투구/후드 코스튬 얼굴 복원 (7 슈트: lily nightblade paladin sylvan valkyrie warlord witch).
정면 프레임(idle*/walk*)의 얼굴 영역(FX)에서 어두운 부분을 피부톤으로 되채우고
기준 눈 좌표(크림슨 기준: (43-44,52-53) × (29-30))에 눈을 그린다.
· 기존 붉은 계열 픽셀(기존 눈/입)은 보존 — 중복 드로잉 방지
· 밝은 금속(헬름 림)은 합계 230 이상이라 자동 보존
"""
from PIL import Image
import os, sys

SUITS = ["lily", "nightblade", "paladin", "sylvan", "valkyrie", "warlord", "witch"]
FX = (41, 24, 56, 34)          # x0,y0,x1,y1 (포함)
EYE_Y = (29, 30)
EYE_XS = [(43, 44), (52, 53)]
SKIN = (242, 216, 196, 255)
SKIN_DK = (224, 194, 176, 255)
EYE = (32, 26, 36, 255)
DARK_SUM = 230

def reveal(path, dry=False):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    x0, y0, x1, y1 = FX
    filled = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if r + g + b >= DARK_SUM:
                continue
            if r - b > 30 and r > 110:
                continue  # 기존 붉은 눈/입 보존
            px[x, y] = SKIN if (x + y) % 2 == 0 else SKIN_DK
            filled += 1
    if filled == 0:
        return 0
    for ey in EYE_Y:
        for ex0, ex1 in EYE_XS:
            for ex in range(ex0, ex1 + 1):
                if px[ex, ey][3] > 0:
                    px[ex, ey] = EYE
    if not dry:
        im.save(path)
    return filled

def main():
    dry = "--dry" in sys.argv
    for s in SUITS:
        total = 0
        n = 0
        for pose in ("idle", "walk"):
            for i in range(4):
                p = f"public/assets/cost_{s}_{pose}{i}.webp"
                if not os.path.exists(p):
                    continue
                total += reveal(p, dry)
                n += 1
        print(f"{'DRY' if dry else 'FIX'} cost_{s}: {n} frames, {total}px filled")
if __name__ == "__main__":
    main()
