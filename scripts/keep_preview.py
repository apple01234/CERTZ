#!/usr/bin/env python3
# 유적 발코니 조립 프리뷰 — 현재 crop vs 수정 crop 비교
from PIL import Image

g = Image.open("/home/z/my-project/public/assets/map/map_ground.png").convert("RGBA")
p = Image.open("/home/z/my-project/public/assets/map/map_props.png").convert("RGBA")
T = 32  # 월드 타일 크기

def cell(src, cx, cy, w=16, h=16):
    c = src.crop((cx, cy, cx + w, cy + h))
    return c.resize((T, T), Image.NEAREST)

def compose(dirt_xy, grass_xy, fence_crop, stair_style, out):
    cols = 8
    canvas = Image.new("RGBA", (cols * T + 120, 300), (24, 26, 34, 255))
    rx, ry = 40, 60
    for c in range(cols):
        canvas.paste(cell(g, *grass_xy), (rx + c * T, ry))
        canvas.paste(cell(g, *dirt_xy), (rx + c * T, ry + T))
    # 기둥 2개 (3장씩)
    for px_off in (T * 0.5, cols * T - T * 1.5):
        for r in range(3):
            canvas.paste(cell(g, *dirt_xy), (int(rx + px_off), ry + T * 2 + r * T))
    # 계단 — 징검다리 4장 (현재) 또는 수직 기둥 (수정)
    sx = rx + cols * T - T
    for i in range(4):
        y = ry + T * 2.2 + i * T * 1.1 if stair_style == "diag" else ry + T * 2 + i * T
        canvas.paste(cell(g, *dirt_xy), (sx, int(y)))
    # 난간
    fx, fy, fw, fh = fence_crop
    f = p.crop((fx, fy, fx + fw, fy + fh))
    f = f.resize((int(fw * 0.85 * 2), int(fh * 0.85 * 2)), Image.NEAREST)  # ×2 월드스케일 근사
    canvas.alpha_composite(f, (rx + 4, ry - 6 - f.height + 16))
    canvas.save(out)

# 현재: 흙(0,48) 가장자리 rock 포함 / 잔디(0,0) 코너 rock 포함 / 욜타리=창·도끼(368,96,48,32) / 사선 계단
compose((0, 48), (0, 0), (368, 96, 48, 32), "diag", "/home/z/my-project/scripts/diag/keep_before.png")
# 수정: 흙(48,32) 균일 / 잔디(48,0) 중앙 / 울타리(254,86,68,53) / 수직 기둥 계단
compose((48, 32), (48, 0), (254, 86, 68, 53), "vert", "/home/z/my-project/scripts/diag/keep_after.png")
print("saved before/after")
