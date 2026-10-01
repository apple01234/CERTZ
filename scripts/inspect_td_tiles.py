"""Tiny Dungeon 132 타일 컨택트시트 (타일 번호 라벨) — 아이콘 선정용"""
from PIL import Image, ImageDraw

SRC = "/tmp/td/Tilemap/tilemap_packed.png"
OUT = "/home/z/my-project/tool-results/td_contact.png"

im = Image.open(SRC).convert("RGBA")
tw, th = 16, 16
cols = im.width // tw  # 12
rows = im.height // th  # 11
S = 4  # 확대
PAD = 14

sheet = Image.new("RGBA", (cols * (tw * S + 4) + 8, rows * (th * S + PAD + 2) + 8), (24, 26, 32, 255))
dr = ImageDraw.Draw(sheet)
for r in range(rows):
    for c in range(cols):
        idx = r * cols + c
        tile = im.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th)).resize((tw * S, th * S), Image.NEAREST)
        x = 4 + c * (tw * S + 4)
        y = 4 + r * (th * S + PAD + 2)
        sheet.paste(tile, (x, y), tile)
        dr.text((x + 2, y + th * S + 1), str(idx), fill=(255, 220, 120, 255))

sheet.save(OUT)
print("saved", OUT, sheet.size)
