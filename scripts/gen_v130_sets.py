#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.3.0 (지시 #4) — NPC급 옷 세트 4종 생성기
  유저 지시: "NPC 캐릭터처럼 멋진 치장템 옷 세트 제작"
  gen_char_system.py 파이프라인 계승 — hero_* 28프레임 팔레트 리맵 + 실루엣 변형:
    dragon(용기사 드라고네트·여) — 스케일 비늘 갑옷 에메랄드+금 · 금발 롱 · 홍금 눈 · 용비늘 스커트
    frost(서리의 백작·남)   — 백은-청백 갑옷 · 백발 · 서리 눈 · 은빛 금장 (헤어 광택 강조)
    sakura(벚꽃 검부이·여)  — 흑발 카테인 롱 + 벚꽃 핀 · 흑본 갑옷 + 벚꽃색 스커트
    void(공허의 순례자·남)  — 보랏빛 로브 · 은발 · 심홍 눈 (후드 느낌 머리 확장)
출력: public/assets/cost[f|m]_{dragon|frost|sakura|void}_<frame>.webp (28프레임 × 4세트 × 2성별)
      scripts/outfit_v130_preview.png (검수 컨택트시트)
"""
import colorsys
import os
from PIL import Image

SRC = "/home/z/my-project/public/assets"
OUT = "/home/z/my-project/public/assets"

H  = (87, 58, 35, 255)    # 머리 메인
hS = (64, 39, 23, 255)    # 머리 그늘
SK = (172, 123, 93, 255)  # 피부
SK2= (193, 172, 143, 255) # 피부 밝은
CT = (164, 168, 181, 255) # 셔츠
Ct = (120, 126, 151, 255) # 셔츠 그늘
Cu = (219, 210, 199, 255) # 셔츠 하이라이트
P  = (44, 101, 181, 255)  # 바지
Pp = (29, 67, 138, 255)   # 바지 그늘
Pd = (13, 32, 94, 255)    # 바지 짙은
EY = (33, 17, 13, 255)    # 눈
K  = (0, 0, 0, 255)       # 외곽선
SH = (12, 14, 25, 128)    # 발그림자

SRC_MAP = {H: "hair", hS: "hairS", SK: "skin", SK2: "skin2", CT: "cloth",
           Ct: "clothS", Cu: "clothL", P: "leg", Pp: "legS", Pd: "legD", EY: "eye"}

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

def pal(hair, hairS, skin, skin2, cloth, clothS, clothL, leg, legS, legD, eye=EY):
    return {"hair": hair, "hairS": hairS, "skin": skin, "skin2": skin2,
            "cloth": cloth, "clothS": clothS, "clothL": clothL,
            "leg": leg, "legS": legS, "legD": legD, "eye": eye}

# v1.3.0 신규 4세트 — NPC급 팔레트 (성별 시트 분기)
SETS = {
    "dragon": dict(
        female=True,
        p=pal((246, 208, 116), (206, 168, 74), (250, 220, 192), (255, 240, 220),
              (58, 148, 116), (38, 110, 88), (120, 200, 164),
              (196, 62, 74), (150, 42, 56), (110, 30, 42), eye=(228, 64, 88)),
    ),
    "frost": dict(
        female=False,
        p=pal((238, 244, 252), (196, 206, 226), (206, 162, 128), (228, 188, 156),
              (154, 190, 226), (112, 150, 194), (214, 232, 250),
              (96, 118, 148), (70, 88, 116), (48, 60, 84), eye=(120, 190, 250)),
    ),
    "sakura": dict(
        female=True,
        p=pal((52, 44, 62), (34, 28, 44), (248, 216, 190), (255, 234, 212),
              (58, 50, 70), (42, 36, 52), (86, 74, 100),
              (244, 176, 200), (214, 140, 170), (178, 108, 140), eye=(248, 150, 190)),
    ),
    "void": dict(
        female=False,
        p=pal((222, 222, 238), (172, 170, 198), (196, 150, 114), (220, 178, 142),
              (72, 54, 116), (52, 38, 88), (108, 84, 160),
              (44, 36, 70), (32, 26, 54), (22, 18, 38), eye=(240, 70, 90)),
    ),
}

def load_frame(fr):
    return Image.open(f"{SRC}/hero_{fr}.webp").convert("RGBA")

def colors_of(im):
    m = {}
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3] > 0 and p in SRC_MAP:
                m.setdefault(SRC_MAP[p], []).append((x, y))
    return m

def bbox_of(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def make_skirt(im, px, legC, legS2):
    """바지 픽셀을 A라인 스커트로 치환 (세트 팔레트 색 사용)"""
    legs = px.get("leg", [])
    if not legs:
        return im
    x0, y0, x1, y1 = bbox_of(legs)
    cx = (x0 + x1) / 2
    top = max(0, y0 - 2)
    bot = min(63, y1 + 3)
    halfB = (x1 - x0) / 2 + 1.0
    height = bot - top
    put = im.putpixel
    for y in range(top, bot + 1):
        t = (y - top) / max(1, height)
        half = halfB + t * 3.4
        xl = int(round(cx - half)); xr = int(round(cx + half))
        hem = y >= bot - 1
        for x in range(xl, xr + 1):
            cur = im.getpixel((x, y))
            if cur[3] == 0 and t < 0.25:
                continue
            c = K if (x == xl or x == xr) else (legS2 if hem else legC)
            put((x, y), c)
    for y in range(bot + 1, 64):
        for x in range(int(cx - halfB - 4), int(cx + halfB + 5)):
            if 0 <= x < 96:
                put((x, y), (0, 0, 0, 0))
    for y in range(top + 4, 64):
        for x in range(96):
            if im.getpixel((x, y)) in (SK, SK2):
                put((x, y), (0, 0, 0, 0))
    return im

def make_longhair(im, px, hairC, hairEdgeC):
    """카테인 롱헤어 — 몸 실루엣 좌우 가장자리를 따라 머리카락 흐름"""
    if "hair" not in px:
        return im
    hair = px["hair"] + px.get("hairS", [])
    hx0, hy0, hx1, _ = bbox_of(hair)
    face_pts = px.get("skin", []) + px.get("skin2", [])
    fy0 = min(y for _, y in face_pts) if face_pts else hy0 + 8
    legs = px.get("leg", [])
    stop = (bbox_of(legs)[1] + 4) if legs else fy0 + 14
    put = im.putpixel
    for y in range(fy0, stop):
        lx = rx = None
        for x in range(0, 96):
            if im.getpixel((x, y))[3] > 0:
                if lx is None: lx = x
                rx = x
        if lx is None:
            continue
        for x in (lx, lx + 1, rx - 1, rx):
            if 0 <= x < 96:
                cur = im.getpixel((x, y))
                if cur[3] > 0 and cur not in (K, SH):
                    put((x, y), hairC)
        if lx - 1 >= 0 and im.getpixel((lx - 1, y))[3] == 0:
            put((lx - 1, y), hairEdgeC)
        if rx + 1 < 96 and im.getpixel((rx + 1, y))[3] == 0:
            put((rx + 1, y), hairEdgeC)
    return im

def add_hair_sheen(im, px, sheenC):
    """머리 광택 밴드 — 씨덕 요소 (v1.2.0 gen_v120_looks 계승)"""
    if "hair" not in px:
        return im
    hx0, hy0, hx1, hy1 = bbox_of(px["hair"])
    put = im.putpixel
    band_y = hy0 + max(2, (hy1 - hy0) // 5)
    for x in range(hx0, hx1 + 1):
        for dy in (0, 1):
            y = band_y + dy
            if 0 <= y < 64:
                cur = im.getpixel((x, y))
                if cur in (px.get("_hairMain", H),) or cur == H:
                    put((x, y), sheenC)
    return im

def remap(im, mapping):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p in mapping:
                px[x, y] = mapping[p]
    return im

def costume_mapping(p):
    return {H: p["hair"], hS: p["hairS"], SK: p["skin"], SK2: p["skin2"],
            CT: p["cloth"], Ct: p["clothS"], Cu: p["clothL"],
            P: p["leg"], Pp: p["legS"], Pd: p["legD"], EY: p["eye"]}

def gen():
    made = 0
    preview = Image.new("RGBA", (8 * 100, 4 * 100), (30, 32, 40, 255))
    for si, (name, cfg) in enumerate(SETS.items()):
        p = cfg["p"]
        for g in ("f", "m"):
            prefix = f"cost_{name}" if g == "f" else f"costm_{name}"
            for fr in FRAMES:
                im = load_frame(fr)
                if cfg["female"] and g == "f":
                    px = colors_of(im)
                    im = make_skirt(im, px, p["leg"], p["legS"])
                    px = colors_of(im)
                    im = make_longhair(im, px, H, hS)
                im = remap(im, costume_mapping(p))
                if g == "f":
                    # 롱헤어 리맵 후 카테인도 세트색으로 재도장
                    px2 = colors_of(im)
                    im = make_longhair(im, px2, p["hair"], p["hairS"])
                # 세트별 포인트
                px3 = colors_of(im)
                im = add_hair_sheen(im, px3, p["clothL"])
                im.save(f"{OUT}/{prefix}_{fr}.webp")
                made += 1
                if fr in ("idle0", "walkside0") :
                    tx = (si * 2 + (g == "m")) * 100
                    ty = (0 if fr == "idle0" else 100) * 1
                    big = im.resize((96, 96), Image.NEAREST)
                    preview.paste(big, (tx + 2, (0 if fr == "idle0" else 100) + 2), big)
        print(f"[{name}] f/m 28프레임 완료")
    preview.save("/home/z/my-project/scripts/outfit_v130_preview.png")
    print(f"total {made} frames")

if __name__ == "__main__":
    gen()
