#!/usr/bin/env python3
# v1.4.1 최종 조합 프리뷰 — WorldScene.buildLayeredKeep 실좌표 재현
from PIL import Image

g = Image.open("/home/z/my-project/public/assets/map/map_ground.png").convert("RGBA")
p = Image.open("/home/z/my-project/public/assets/map/map_props.png").convert("RGBA")
T = 32
cols, rows = 8, 2
platW, platH = cols * T, rows * T
kx, ky = 340, 190  # 구조물 중심 (프리뷰 캔버스 기준)
rx = kx - platW / 2
ry = ky - platH / 2 - 26

def cell(cx, cy):
    return g.crop((cx, cy, cx + 16, cy + 16)).resize((T, T), Image.NEAREST)

W, H = 700, 360
canvas = Image.new("RGBA", (W, H), (24, 26, 34, 255))

# 지상 잔디 바닥 (마을 느낌 — 연한 그리드)
for gy in range(int(ry) + 64, H, T):
    for gx in range(0, W, T):
        if (gx // T + gy // T) % 2 == 0:
            canvas.paste(Image.new("RGBA", (T, T), (32, 40, 30, 255)), (gx, gy))

# 1) 계단 소품 (depth 발코니+0.15 — 항상 플레이어 뒤)
st = p.crop((158, 680, 158 + 104, 680 + 57))
st = st.resize((int(104 * 1.6), int(57 * 1.6)), Image.NEAREST)
sx = int(rx + platW - T - 6)
canvas.alpha_composite(st, (sx, int(ry)))

# 2) 발코니 타일 (잔디 48,0 / 흙 48,32)
for c in range(cols):
    canvas.alpha_composite(cell(48, 0), (int(rx + c * T), int(ry)))
    d = g.crop((48, 32, 64, 48)).resize((T, T), Image.NEAREST)
    if c % 2 == 1: d = d.transpose(Image.FLIP_LEFT_RIGHT)
    canvas.alpha_composite(d, (int(rx + c * T), int(ry + T)))
# 받침 기둥
for px in (rx + T * 0.5, rx + platW - T * 1.5):
    for r in range(3):
        d = g.crop((48, 32, 64, 48)).resize((T, T), Image.NEAREST)
        if r % 2 == 0: d = d.transpose(Image.FLIP_LEFT_RIGHT)
        canvas.alpha_composite(d, (int(px), int(ry + T + r * T)))

# 3) 난간 (depth 지상+0.2 — 플레이어 앞/머리 가림)
f = p.crop((254, 86, 254 + 68, 86 + 53))
f = f.resize((int(68 * 0.85), int(53 * 0.85)), Image.NEAREST)
for c in range(0, cols, 2):
    canvas.alpha_composite(f, (int(rx + c * T + 4), int(ry + 2) - f.height))

# 4) 플레이어 더미 (지상 y=ry+120 / 발코니 y=ry+20)
from PIL import ImageDraw
dr = ImageDraw.Draw(canvas)
for px, py in ((int(rx + platW * 0.4), int(ry + 20)), (int(rx - 30), int(ry + 120)), (sx + 120, int(ry + 118))):
    dr.ellipse((px - 8, py - 26, px + 8, py - 10), fill=(230, 200, 120, 255))
    dr.rectangle((px - 7, py - 12, px + 7, py + 8), fill=(90, 120, 200, 255))

canvas.save("/home/z/my-project/scripts/diag/keep_final_preview.png")
print("saved", rx, ry, sx)
