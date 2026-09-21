#!/usr/bin/env python3
"""v1.4.2 진단 — 코드가 참조하는 map_ground/map_props crop 영역을 실제 픽셀로 추출.
요새 유적 타일맵이 '왜 이상해 보이는지' 눈으로 확인하는 프리뷰."""
from PIL import Image

GROUND = "public/assets/map/map_ground.png"
PROPS = "public/assets/map/map_props.png"

g = Image.open(GROUND).convert("RGBA")
p = Image.open(PROPS).convert("RGBA")

# 코드 참조 영역 (WorldScene.buildLayeredKeep 기준)
regions = [
    ("grass_48_0", g, (48, 0, 64, 16)),       # 잔니 (48,0,16,16)
    ("dirt_48_32", g, (48, 32, 64, 48)),      # 흙 (48,32,16,16)
    ("old_grass_0_0", g, (0, 0, 16, 16)),     # 이전 잔니 crop (참고)
    ("old_dirt_0_48", g, (0, 48, 16, 64)),    # 이전 흙 crop (참고)
    ("fence_254_86", p, (254, 86, 322, 139)), # 목책 (254,86,68,53)
    ("stair_158_680", p, (158, 680, 262, 737)),# 계단 (158,680,104,57)
]

SCALE = 6  # 16px 타일을 96px로 확대
tiles = []
for name, img, box in regions:
    crop = img.crop(box)
    big = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.NEAREST)
    tiles.append((name, big))

# 가로로 나열한 프리뷰 시트
pad = 14
w = sum(t.width for _, t in tiles) + pad * (len(tiles) + 1)
h = max(t.height for _, t in tiles) + 40
sheet = Image.new("RGBA", (w, h), (30, 30, 40, 255))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
x = pad
for name, t in tiles:
    sheet.alpha_composite(t, (x, 30))
    d.text((x, 8), name, fill=(255, 255, 180, 255))
    x += t.width + pad
sheet.convert("RGB").save("scripts/diag/keep_crops_v142.png")
print("saved scripts/diag/keep_crops_v142.png", sheet.size)

# 아틀라스 통체 뷰 (그리드 오버레이) — map_ground 16px 그리드
gv = g.resize((512 * 2, 512 * 2), Image.NEAREST).convert("RGB")
d2 = ImageDraw.Draw(gv)
for i in range(0, 512, 16):
    d2.line([(i * 2, 0), (i * 2, 1024)], fill=(255, 0, 0, 60))
    d2.line([(0, i * 2), (1024, i * 2)], fill=(255, 0, 0, 60))
gv.save("scripts/diag/keep_ground_grid_v142.png")
print("saved scripts/diag/keep_ground_grid_v142.png")
