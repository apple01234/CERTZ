#!/usr/bin/env python3
"""
SERTZ 에셋 파이프라인 v2 (좌표 확정본)
- ArMM1998 Zelda-like (CC0): 주인공/타일/장식/이펙트 소스
- Kenney Tiny Dungeon (CC0): 고스트 하수인
- LPC Wolf Animation — williamthompsonj (CC-BY 3.0/4.0): 늑대
- Sotrak Rewop — gilgaphoenixignis (CC-BY 3.0/4.0): 보스

character.png 레이아웃 (확정):
  walk 16x32: y=0 DOWN, y=32 RIGHT, y=64 UP, y=96 LEFT (각 x=0,16,32,48 4프레임)
  atk 32x32 : y=128 DOWN, y=160 UP, y=192 RIGHT, y=224 LEFT (각 x=0,32,64,96 4프레임)
"""
import os
from PIL import Image, ImageDraw, ImageEnhance

SRC = "/home/z/my-project/scripts/asset-sources/assets-src"
OUT = "/home/z/my-project/public/assets"
PROOF = "/tmp/proof2.png"

OW = Image.open(f"{SRC}/zelda_gfx/gfx/Overworld.png").convert("RGBA")
CAVE = Image.open(f"{SRC}/zelda_gfx/gfx/cave.png").convert("RGBA")
OBJ = Image.open(f"{SRC}/zelda_gfx/gfx/objects.png").convert("RGBA")
CHAR = Image.open(f"{SRC}/zelda_gfx/gfx/character.png").convert("RGBA")
WOLF = Image.open(f"{SRC}/wolf_walk.png").convert("RGBA")
SOTRAK = Image.open(f"{SRC}/boss_sotrak.png").convert("RGBA")
TD = Image.open(f"{SRC}/tinydungeon/Tilemap/tilemap_packed.png").convert("RGBA")
KN = Image.open(f"{SRC}/kenney/Spritesheet/roguelikeSheet_transparent.png").convert("RGBA")

os.makedirs(OUT, exist_ok=True)
os.makedirs(f"{OUT}/ui", exist_ok=True)

proof_items = []

def save(name, im, scale=1.0, darken=1.0, tint=None):
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST)
    if darken != 1.0:
        im = ImageEnhance.Brightness(im).enhance(darken)
    if tint:
        px = im.load()
        r, g, b = tint
        for y in range(im.height):
            for x in range(im.width):
                pr, pg, pb, pa = px[x, y]
                px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    im.save(f"{OUT}/{name}.png")
    proof_items.append((name, im))
    return im

def recolor_whites(im: Image.Image, rgb: tuple):
    """흰색(꽃잎) 픽셀만 주어진 색으로 치환 — 잎은 녹색 유지"""
    px = im.load()
    r, g, b = rgb
    for y in range(im.height):
        for x in range(im.width):
            pr, pg, pb, pa = px[x, y]
            if pa > 128 and pr > 195 and pg > 195 and pb > 195:
                px[x, y] = (r, g, b, pa)
    return im

def body_center_x(cell: Image.Image):
    """붉은 튜닉 픽셀 무게중심 → 캐릭터 몸 중심 x"""
    px = cell.load()
    sx, n = 0, 0
    for y in range(cell.height):
        for x in range(cell.width):
            r, g, b, a = px[x, y]
            if a > 128 and r > 110 and g < 90 and b < 90:
                sx += x
                n += 1
    return sx / n if n else cell.width / 2

# ---------------- 타일 (64x64, x4) ----------------
save("tile_grass", OW.crop((80, 144, 96, 160)), 4)
save("tile_path", OW.crop((192, 224, 208, 240)), 4)  # 갈색 균열 흙길 (물 없는 내부 타일)
save("tile_dark", CAVE.crop((16, 16, 32, 32)), 4, darken=0.8)

# ---------------- 장식 ----------------
def kn_tile(c, r):
    return KN.crop((c * 17, r * 17, c * 17 + 16, r * 17 + 16))

def kn_stack(c, r0, r1):
    """Kenney 1px 마진 제거하고 세로로 이어 붙임"""
    a, b = kn_tile(c, r0), kn_tile(c, r1)
    out = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    out.paste(a, (0, 0), a)
    out.paste(b, (0, 16), b)
    return out

save("tree", kn_tile(13, 9), 4)                           # 64x64 둥근 잔나무
save("pine", kn_tile(18, 9), 4)                           # 64x64 소나무
save("torch", kn_tile(18, 8), 2)                          # 32x32 횃불
save("rock", OW.crop((240, 192, 272, 224)), 2)             # 64x64 깨끗한 바위
fw2 = OW.crop((32, 192, 48, 208))                          # 흰 꽃 클러스터 (투명 배경)
save("flower_r", recolor_whites(fw2, (240, 100, 100)), 2)  # 32x32
save("flower_y", recolor_whites(fw2, (255, 210, 100)), 2)
save("flower_w", fw2, 2)

# ---------------- 이펙트 소스 ----------------
for i, x in enumerate([64, 80, 96, 112]):
    save(f"flame{i}", OBJ.crop((x, 48, x + 16, 64)), 2)     # 불꽃 4프레임 32x32
save("spark", OBJ.crop((208, 48, 224, 64)))                 # 파티클 16x16
save("sparkle0", OBJ.crop((176, 48, 192, 64)), 2)           # 반짝임 별 32x32
save("sparkle1", OBJ.crop((192, 48, 208, 64)), 2)           # 반짝임 다이아
save("impact_star", OBJ.crop((144, 270, 192, 290)), 2)      # 타격 스타 96x40
save("fragment", OBJ.crop((192, 192, 224, 224)))            # 청록 수정 덩어리 32x32

# ---------------- UI 하트 ----------------
save("ui/heart_full", OBJ.crop((64, 0, 80, 16)))
save("ui/heart_half", OBJ.crop((96, 0, 112, 16)))
save("ui/heart_empty", OBJ.crop((128, 0, 144, 16)))

# ---------------- 주인공 (96x64 캔버스, 몸 중심 x=48, 발 y=64) ----------------
CW, CH = 96, 64

def hero_cell(box, cw, chh, dy=0):
    """셀을 붉은 튜닉 무게중심 기준으로 96x64 캔버스 중앙 정렬"""
    cell = CHAR.crop(box)
    cx = body_center_x(cell)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    c2 = cell.resize((cw * 2, chh * 2), Image.NEAREST)
    px = round(48 - cx * 2)
    px = max(0, min(CW - c2.width, px))
    canvas.paste(c2, (px, CH - chh * 2 + dy), c2)
    return canvas

# idle: DOWN 서있기 프레임(x=16) + 숨쉬기
for i, dy in enumerate([0, 1, 0, 1]):
    save(f"hero_idle{i}", hero_cell((16, 0, 32, 32), 16, 32, dy))
# walk: down(y0) / side=RIGHT(y32) / up(y64)
for i in range(4):
    save(f"hero_walk{i}", hero_cell((i * 16, 0, i * 16 + 16, 32), 16, 32))
    save(f"hero_walkside{i}", hero_cell((i * 16, 32, i * 16 + 16, 64), 16, 32))
    save(f"hero_walkup{i}", hero_cell((i * 16, 64, i * 16 + 16, 96), 16, 32))
# attack: down(y128) / up(y160) / side=RIGHT(y192)
for i in range(4):
    save(f"hero_atkdown{i}", hero_cell((i * 32, 128, i * 32 + 32, 160), 32, 32))
    save(f"hero_atkup{i}", hero_cell((i * 32, 160, i * 32 + 32, 192), 32, 32))
    save(f"hero_atk{i}", hero_cell((i * 32, 192, i * 32 + 32, 224), 32, 32))

# ---------------- 늑대 (LPC 64x32 네이티브, 우측 향함) ----------------
save("wolf_idle0", WOLF.crop((320, 64, 384, 96)))
save("wolf_idle1", WOLF.crop((320, 64, 384, 96)))
# 달리기 4프레임 — 행 y64..96의 실제 64px 그리드 (기존 352/416/480/544는 32px 어긋나
# 앞뒤 반쪽이 섞이는 "스프라이트 갈림" 버그 — 사용자 리포트 반영 수정)
# 행 구성: 320(선 시프)=서기 → 384/448/512(보폭) — 576은 빈 칸이라 제외
for i, cx in enumerate([320, 384, 448, 512]):
    save(f"wolf_run{i}", WOLF.crop((cx, 64, cx + 64, 96)))
save("wolf_atk0", WOLF.crop((384, 96, 448, 128)))

# ---------------- 하수인 = 고스트 (TD 16x16 x2 = 32x32) ----------------
GHOST = TD.crop((96, 160, 112, 176)).resize((32, 32), Image.NEAREST)
def ghost(dy=0, flip=False):
    g = GHOST.transpose(Image.FLIP_LEFT_RIGHT) if flip else GHOST
    c = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    c.paste(g, (0, dy), g)
    return c
save("minion_idle0", ghost(0))
save("minion_idle1", ghost(-1))
for i, dy in enumerate([0, -2, -1, -2]):
    save(f"minion_run{i}", ghost(dy, flip=i % 2 == 1))

# ---------------- 보스 (sotrak trim x0.45, 호흡 2프레임) ----------------
bbox = SOTRAK.getbbox()
trimmed = SOTRAK.crop(bbox)
bw, bh = round(trimmed.width * 0.45), round(trimmed.height * 0.45)
boss_base = trimmed.resize((bw, bh), Image.NEAREST)
for i, dy in enumerate([0, 2]):
    c = Image.new("RGBA", (bw, bh + 4), (0, 0, 0, 0))
    c.paste(boss_base, (0, dy), boss_base)
    save(f"boss_idle{i}", c)
print(f"boss canvas: {bw}x{bh+4}")

# ---------------- 검증 시트 ----------------
cols = 10
cell = 120
rows = (len(proof_items) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 12)), (34, 34, 44))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(proof_items):
    t = im.copy()
    if max(t.size) < 40:
        t = t.resize((t.width * 2, t.height * 2), Image.NEAREST)
    t.thumbnail((cell - 8, cell - 8), Image.NEAREST)
    x, y = (i % cols) * cell, (i // cols) * (cell + 12)
    sheet.paste(t, (x + 4, y + 4), t)
    d.text((x + 3, y + cell + 1), name[:20], fill=(255, 255, 120))
sheet.save(PROOF)
print(f"proof2: {PROOF} items={len(proof_items)}")
