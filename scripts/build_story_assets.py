#!/usr/bin/env python3
"""스토리 확장 스테이지 에셋 베이크 — 전부 기존 CC0/CC-BY 소스에서 추출.

- 제3지역 스바르트알프헤임(동굴): 동굴 거미(TD 0110) / 수정 골렘(TD 0109)
- 제4지역 니플헤임(설원): 서리 늑대(LPC wolf 청백 틴트) / 얼음 골렘(TD 0109 청백 틴트)
- 제5지역 심연의 왕좌: 심연 유령(TD 0121 보라 틴트)
- 보스: 눈보라의 거수(behemoth, CC-BY gilgaphoenixignis) / 심연의 군주(alvaric, CC-BY gilgaphoenixignis)
- 타일/데코: 기존 tile_grass/tile_path/cave 타일/kenney 소나무·바위 색 변조
- 아이템: TD 0105(대검) / TD 0102(방패 틴트)
"""
from PIL import Image, ImageEnhance
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts/asset-sources/assets-src")
TD_TILES = os.path.join(SRC, "td_tmp/Tiles")
OUT = os.path.join(ROOT, "public/assets")
os.makedirs(OUT, exist_ok=True)

WOLF = Image.open(f"{SRC}/wolf_walk.png").convert("RGBA")
BEHEMOTH = Image.open(f"{SRC}/boss_2xdemon-behemot.png").convert("RGBA")
ALVARIC = Image.open(f"{SRC}/boss_2xboss-alvaric.png").convert("RGBA")
OW = Image.open(f"{SRC}/zelda_gfx/gfx/Overworld.png").convert("RGBA")
CAVE = Image.open(f"{SRC}/zelda_gfx/gfx/cave.png").convert("RGBA")
KN = Image.open(f"{SRC}/kenney/Spritesheet/roguelikeSheet_transparent.png").convert("RGBA")


def tint(im: Image.Image, rgb: tuple, keep_lum: bool = False) -> Image.Image:
    """전 픽셀에 색 곱하기. keep_lum=True면 명도 대비를 살려 틴트."""
    px = im.load()
    r0, g0, b0 = rgb
    for y in range(im.height):
        for x in range(im.width):
            pr, pg, pb, pa = px[x, y]
            if pa == 0:
                continue
            if keep_lum:
                lum = (pr + pg + pb) / 3 / 255
                nr = int(min(255, r0 * (0.45 + 0.75 * lum)))
                ng = int(min(255, g0 * (0.45 + 0.75 * lum)))
                nb = int(min(255, b0 * (0.45 + 0.75 * lum)))
            else:
                nr, ng, nb = pr * r0 // 255, pg * g0 // 255, pb * b0 // 255
            px[x, y] = (nr, ng, nb, pa)
    return im


def save(name: str, im: Image.Image, scale: float = 1.0):
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST)
    im.save(f"{OUT}/{name}.png")
    print(f"{name}.png {im.size}")


def td(tid: str) -> Image.Image:
    return Image.open(os.path.join(TD_TILES, f"tile_{tid}.png")).convert("RGBA")


def ghost_frames(base: Image.Image, prefix: str, tint_rgb=None, keep_lum=False):
    """TD 16x16 몬스터 → 32x32 2프레임 idle + 4프레임 run(좌우플립+바운스)"""
    src = base.resize((32, 32), Image.NEAREST)
    if tint_rgb:
        src = tint(src, tint_rgb, keep_lum)
    def fr(dy=0, flip=False):
        g = src.transpose(Image.FLIP_LEFT_RIGHT) if flip else src
        c = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        c.paste(g, (0, dy), g)
        return c
    save(f"{prefix}_idle0", fr(0))
    save(f"{prefix}_idle1", fr(-1))
    for i, dy in enumerate([0, -2, -1, -2]):
        save(f"{prefix}_run{i}", fr(dy, flip=i % 2 == 1))


# ---------------- 몬스터 5종 ----------------
ghost_frames(td("0110"), "spider")                                   # 동굴 거미 (적색)
ghost_frames(td("0109"), "golem")                                    # 수정 골렘 (청동)
ghost_frames(td("0109"), "icegolem", tint_rgb=(150, 205, 245), keep_lum=True)  # 얼음 골렘
ghost_frames(td("0121"), "wraith", tint_rgb=(190, 150, 235))         # 심연 유령 (보라)

# 서리 늑대 — LPC 늑대 프레임 청백 틴트 (64x32 네이티브)
WOLF_TINT = (168, 216, 250)
save("frostwolf_idle0", tint(WOLF.crop((320, 64, 384, 96)), WOLF_TINT, keep_lum=True))
save("frostwolf_idle1", tint(WOLF.crop((320, 64, 384, 96)), WOLF_TINT, keep_lum=True))
for i, cx in enumerate([320, 384, 448, 512]):
    save(f"frostwolf_run{i}", tint(WOLF.crop((cx, 64, cx + 64, 96)), WOLF_TINT, keep_lum=True))

# ---------------- 보스 2종 (기존 sotrak 파이프라인 동일: trim + 0.45 + 호흡 2프레임) ----------------
def boss_frames(src: Image.Image, prefix: str, scale=0.45):
    bbox = src.getbbox()
    trimmed = src.crop(bbox)
    bw, bh = round(trimmed.width * scale), round(trimmed.height * scale)
    base = trimmed.resize((bw, bh), Image.NEAREST)
    for i, dy in enumerate([0, 2]):
        c = Image.new("RGBA", (bw, bh + 4), (0, 0, 0, 0))
        c.paste(base, (0, dy), base)
        save(f"{prefix}_idle{i}", c)
    print(f"  {prefix} canvas: {bw}x{bh+4}")

boss_frames(BEHEMOTH, "boss2")
boss_frames(ALVARIC, "boss3", scale=0.5)

# ---------------- 타일 5종 ----------------
grass = OW.crop((80, 144, 96, 160)).resize((64, 64), Image.NEAREST)
save("tile_snow", tint(grass, (214, 232, 248), keep_lum=True))       # 설원 흰 땅
path = OW.crop((192, 224, 208, 240)).resize((64, 64), Image.NEAREST)
save("tile_ice", tint(path, (176, 216, 244), keep_lum=True))         # 얼어붙은 길
cave_t = CAVE.crop((16, 16, 32, 32)).resize((64, 64), Image.NEAREST)
save("tile_cave", tint(ImageEnhance.Brightness(cave_t).enhance(1.15), (196, 158, 122), keep_lum=True))  # 갈색 동굴
save("tile_abyss", tint(cave_t, (128, 110, 172), keep_lum=True))     # 보라 심연
pdark = OW.crop((192, 224, 208, 240)).resize((64, 64), Image.NEAREST)
save("tile_path_dark", tint(pdark, (120, 118, 138), keep_lum=True))  # 동굴/심연 길

# ---------------- 데코 4종 (기존 kenney 소나무/바위 색 변조) ----------------
def kn_tile(c, r):
    return KN.crop((c * 17, r * 17, c * 17 + 16, r * 17 + 16))

pine = kn_tile(18, 9)  # 16x16
save("pine_snow", tint(pine.resize((64, 64), Image.NEAREST), (222, 238, 250), keep_lum=True))
save("pine_dark", tint(pine.resize((64, 64), Image.NEAREST), (108, 96, 148), keep_lum=True))
rock = OW.crop((240, 192, 272, 224))  # 32x32 바위
save("rock_snow", tint(rock.resize((64, 64), Image.NEAREST), (216, 230, 244), keep_lum=True))
save("rock_dark", tint(rock.resize((64, 64), Image.NEAREST), (118, 104, 148), keep_lum=True))

# ---------------- 아이템 2종 ----------------
save("item_weapon_4", td("0105").resize((24, 24), Image.NEAREST))    # 심연 대검
armor4 = td("0102").resize((24, 24), Image.NEAREST)
save("item_armor_4", tint(armor4, (206, 160, 240)))                  # 수호의 갑옷 (보라금)

print("story assets done")
