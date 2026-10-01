#!/usr/bin/env python3
# v3.0.2 에셋 생성 — CC0 팩(50 Monsters, Pixelart Spells, bricks, rotbow) 가공 → public/assets
import os, shutil
from PIL import Image

SRC_M = "/tmp/m50/50+ Monsters Pack 2D/Monsters/Normal Colors"
SRC_SP = "/tmp/spells/Pixelart Spells/PNG Files"
OUT = "/home/z/my-project/public/assets"
os.makedirs(OUT, exist_ok=True)

# ---------------- 1) 신규 몬스터 9종 (챕터별 다양화, CC0 isaiah658) ----------------
# (키, 팩 번호) — 프론트 스프라이트에서 idle2프레임/run4프레임/atk1프레임 생성
MONSTERS = [
    ("x2_frog",       25),  # 1장 숲 — 개구리
    ("x2_rat",        30),  # 2장 왕국 — 쥐
    ("x2_bat",        46),  # 3장 알프헤임 — 박쥐
    ("x2_firebird",   24),  # 4장 무스펠하임 — 불새
    ("x2_frostfly",   27),  # 5장 니플하임 — 서리 날벌레
    ("x2_snail",      55),  # 6장 동굴 — 달팽이
    ("x2_stonegolem", 49),  # 7장 니다벨리르 — 돌골렘
    ("x2_darkhound",  44),  # 8장 헬 — 어둠늑대
    ("x2_reeffish",   47),  # 9장 아뜰란티스 — 암초물고기
]

def frames(src: Image.Image):
    """idle0/1, run0..3, atk0 — 원본 64x64 기준 미세 변형 프레임"""
    base = src
    out = {}
    out["idle0"] = base
    b1 = base.transform(base.size, Image.AFFINE, (1, 0, 0, 0, 0.94, 3), resample=Image.NEAREST)  # 살짝 움츠림
    out["idle1"] = b1
    for i, dy in enumerate((0, -2, 0, -1)):  # run — 위아래 보브
        f = base.transform(base.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), resample=Image.NEAREST)
        out[f"run{i}"] = f
    out["atk0"] = base.resize((68, 68), Image.NEAREST).crop((2, 4, 66, 68))  # 살짝 전창
    return out

count = 0
for key, num in MONSTERS:
    src = Image.open(f"{SRC_M}/Monster #{num} Front Normal Color Palette.png").convert("RGBA")
    for name, im in frames(src).items():
        im.save(f"{OUT}/{key}_{name}.png")
        count += 1
print("monster frames:", count)

# ---------------- 2) 화살 투사체 (PIL 생성 — 궁수용, 16x5) ----------------
ar = Image.new("RGBA", (16, 5), (0, 0, 0, 0))
px = ar.load()
for x in range(2, 11):
    px[x, 2] = (196, 164, 110, 255)      # 깃대
px[1, 2] = (150, 150, 158, 255)
for dx, dy in ((0, 2), (1, 1), (1, 3), (0, 2)):  # 촉
    pass
px[0, 2] = (235, 235, 245, 255); px[1, 1] = (235, 235, 245, 255); px[1, 3] = (235, 235, 245, 255)
for x, y in ((11, 1), (12, 0), (11, 3), (12, 4), (13, 2)):  # 깃털
    px[x, y] = (230, 240, 255, 255)
px[14, 2] = (200, 215, 245, 255); px[15, 2] = (170, 190, 230, 255)
ar.save(f"{OUT}/x2_arrow.png")

# ---------------- 3) 던전 벽돌 타일 (bricks.db32 → 16x16 3종 이어붙임 48x16) ----------------
br = Image.open("/tmp/bricks.png").convert("RGBA")
tw, th = 16, 16
tiles = [br.crop((0, 0, tw, th)), br.crop((tw, 0, tw * 2, th)), br.crop((0, th, tw, th * 2))]
strip = Image.new("RGBA", (tw * 3, th), (0, 0, 0, 0))
for i, t in enumerate(tiles):
    strip.paste(t, (i * tw, 0))
strip.save(f"{OUT}/x2_bricks.png")

# ---------------- 4) 스펠 투사체 프레임 추출 (96x16 → 6프레임 16x16 개별 or 스프라이트시트 유지) ----------------
# Phaser spritesheet로 바로 로드 가능 — 원본 그대로 복사 + 이름 정규화
SPELLS = {
    "Arcane Bolt.png": "x2_sp_arcane.png",
    "Magic Orb.png": "x2_sp_magicorb.png",
    "Fireball.png": "x2_sp_fireball.png",
    "Ice Lance.png": "x2_sp_icelance.png",
    "Darkness Bolt.png": "x2_sp_darkbolt.png",
    "Magic Sparks.png": "x2_sp_sparks.png",
}
for src, dst in SPELLS.items():
    im = Image.open(f"{SRC_SP}/{src}").convert("RGBA")
    w, h = im.size
    n = w // (w // max(1, h)) if h else 0
    im.save(f"{OUT}/{dst}")  # 프레임폭 = 높이 기준으로 BootScene에서 spritesheet 등록
    print(dst, im.size, "frames:", im.size[0] // im.size[1])

# ---------------- 5) 활 (rotbow 20x20 16프레임 80x80) ----------------
bow = Image.open("/tmp/rotbow.png").convert("RGBA")
bow.save(f"{OUT}/x2_bow.png")
print("bow", bow.size)

print("DONE — total files:", sum(1 for f in os.listdir(OUT) if f.startswith("x2_")))
