#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.1.0 캐릭터 외형 시스템 자산 생성기 (유저 지시 #1/#19/#21/#22)
- 코스튬 = 스프라이트 "완전 교체" (SPUM NPC처럼 아예 다른 사람이 되는 방식)
  · 기존 outfit_* 는 옷만 재색상(겹치기) → 폐기, cost_* 는 머리+피부+옷 전부 새 팔레트로 재탄생
- 여캠(heroF) = 실루엣 변환(긴 머리 카테인 + 스커트 + 앞머리 확장)
- 피부 6종(백자~초콜릿) = S/s 픽셀만 정밀 재매핑 (multiply 틴트의 "다 어두워짐" 문제 근본 해결)
- 장식(왕관/리본/날개/후광) = 캐릭터에 "고정"되는 어태치 스프라이트 (실시간 동기화는 WorldScene)

원리: hero_* 프레임은 14색 고정 팔레트 → 색상별 역할 매핑이 정확히 성립
  H(87,58,35)=머리+조끼+신발+hem  h(64,39,23)=머리그림자  S(172,123,93)=피부
  s(193,172,143)=피부밝은(손/얼굴아래)  T/t/u=셔츠(회색)  P/p/d=바지(파랑)
  B(33,17,13)=눈  K(0,0,0)=외곽선  그림자=(12,14,25,128)
변환 순서: ①실루엣(스커트/긴머리) 변형 → ②팔레트 재매핑
"""
import os, json
from PIL import Image

SRC = "/home/z/my-project/public/assets"
OUT = "/home/z/my-project/public/assets"

# ---------- 원본 팔레트 ----------
H  = (87, 58, 35, 255)    # 머리 메인 (조끼/신발/hem 공유)
hS = (64, 39, 23, 255)    # 머리 그늘
SK = (172, 123, 93, 255)  # 피부
SK2= (193, 172, 143, 255) # 피부 밝은 (손/턱밑)
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

# ---------- 신규 팔레트 ----------
def pal(hair, hairS, skin, skin2, cloth, clothS, clothL, leg, legS, legD, eye=EY):
    return {"hair": hair, "hairS": hairS, "skin": skin, "skin2": skin2,
            "cloth": cloth, "clothS": clothS, "clothL": clothL,
            "leg": leg, "legS": legS, "legD": legD, "eye": eye}

# 피부 6종 (2번 = 기본 hero, 시트 미생성 → "" 프리픽스)
SKINS = [
    ("백자",   (248, 224, 198), (255, 240, 222)),
    ("밝은",   (232, 197, 159), (247, 217, 185)),
    ("기본",   None, None),  # 원본 그대로
    ("밀색",   (156, 110, 78),  (182, 142, 104)),
    ("구릿빛", (126, 86, 58),   (156, 114, 80)),
    ("초콜릿", (96, 62, 42),    (124, 88, 62)),
]

# 코스튬 10종 — "완전 교체" (머리/피부/옷 전부 다른 사람)
COSTUMES = {
    # 기존 4종도 완전 교체판으로 재탄생
    "royal":    dict(female=False, p=pal((232, 198, 120), (184, 150, 82), (238, 196, 160), (252, 220, 188),
                                          (245, 242, 232), (210, 205, 190), (255, 255, 255),
                                          (250, 246, 235), (215, 210, 195), (180, 175, 160))),
    "shadow":   dict(female=False, p=pal((74, 62, 112), (48, 40, 78), (212, 182, 172), (232, 206, 198),
                                          (62, 62, 84), (44, 44, 62), (86, 86, 110),
                                          (44, 44, 60), (32, 32, 46), (22, 22, 32), eye=(196, 52, 72))),
    "spring":   dict(female=True, p=pal((236, 152, 172), (198, 112, 136), (240, 202, 168), (253, 224, 194),
                                         (152, 202, 122), (116, 168, 92), (196, 232, 168),
                                         (246, 242, 230), (212, 206, 190), (178, 172, 156))),
    "navy":     dict(female=False, p=pal((58, 64, 92), (40, 45, 68), (176, 128, 96), (200, 158, 124),
                                          (46, 66, 130), (34, 50, 100), (70, 92, 160),
                                          (226, 226, 232), (192, 192, 202), (156, 156, 170))),
    # 신규 프리미엄 6종 (#19 고퀄 도트)
    "silver":   dict(female=True, p=pal((206, 216, 236), (152, 162, 192), (255, 226, 196), (255, 242, 222),
                                         (142, 182, 236), (102, 142, 210), (196, 222, 250),
                                         (242, 246, 252), (206, 214, 230), (168, 178, 198), eye=(90, 140, 220))),
    "crimson":  dict(female=True, p=pal((162, 46, 72), (112, 30, 50), (226, 186, 172), (244, 210, 194),
                                         (72, 56, 92), (52, 40, 70), (96, 78, 122),
                                         (58, 46, 76), (42, 32, 56), (30, 22, 40), eye=(220, 60, 80))),
    "seraph":   dict(female=True, p=pal((246, 216, 142), (206, 172, 96), (248, 220, 190), (255, 238, 214),
                                         (246, 242, 228), (214, 206, 186), (255, 255, 250),
                                         (238, 220, 150), (206, 186, 118), (170, 150, 92), eye=(210, 150, 60))),
    "abyss":    dict(female=False, p=pal((46, 112, 118), (30, 80, 86), (188, 140, 106), (212, 170, 134),
                                          (88, 62, 134), (64, 44, 102), (118, 88, 168),
                                          (40, 40, 58), (30, 30, 44), (20, 20, 30), eye=(90, 230, 210))),
    "nightmare":dict(female=False, p=pal((226, 226, 240), (170, 168, 196), (214, 196, 196), (234, 218, 218),
                                          (48, 44, 66), (34, 31, 48), (70, 64, 92),
                                          (40, 36, 56), (28, 25, 40), (18, 16, 26), eye=(190, 120, 255))),
    "gilded":   dict(female=False, p=pal((226, 182, 82), (176, 136, 52), (196, 148, 112), (220, 178, 140),
                                          (52, 48, 58), (38, 35, 44), (78, 72, 86),
                                          (48, 44, 52), (36, 33, 40), (24, 22, 28), eye=(240, 200, 90))),
}

# ---------- 유틸 ----------
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

# ---------- 실루엣: 스커트 ----------
def make_skirt(im, px):
    """바지 픽셀(P/p/d)을 A라인 스커트로 치환 + 스커트 아래(신발/다리) 소거"""
    legs = [pt for pt in px.get("leg", [])]
    if not legs:
        return im
    x0, y0, x1, y1 = bbox_of(legs)
    legcols = sorted({x for x, y in legs})
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
                continue  # 상단 살짝 겹침 구간은 몸 밖으로 돌출 금지
            # 원본 바지 팔레트(P/Pp)로 칠한다 → 코스튬 리맵이 코스튬색으로 자동 변환
            c = K if (x == xl or x == xr) else (Pp if hem else P)
            put((x, y), c)
    # 스커트 아래 잔여(신발/다리 틈) 소거
    for y in range(bot + 1, 64):
        for x in range(int(cx - halfB - 4), int(cx + halfB + 5)):
            if 0 <= x < 96:
                put((x, y), (0, 0, 0, 0))
    # 스커트 착용 시 목 아래 피부(손) 소거 — 스커트 실루엣 밖에 고아 픽셀로 남는 것 방지
    for y in range(top + 4, 64):
        for x in range(96):
            if im.getpixel((x, y)) in (SK, SK2):
                put((x, y), (0, 0, 0, 0))
    return im

# ---------- 실루엣: 긴 머리 + 앞머리 ----------
def make_longhair(im, px):
    if "hair" not in px:
        return im
    hair = px["hair"] + px.get("hairS", [])
    hx0, hy0, hx1, _ = bbox_of(hair)
    # 얼굴 상단(피부 최상단) 찾기
    face_pts = px.get("skin", []) + px.get("skin2", [])
    if face_pts:
        fy0 = min(y for _, y in face_pts)
    else:
        fy0 = hy0 + 8
    # 스커트 상단(=허리) 근처까지 머리카락이 흐른다
    legs = px.get("leg", [])
    if legs:
        _, ly0, _, _ = bbox_of(legs)
        stop = ly0 + 4
    else:
        stop = fy0 + 14
    put = im.putpixel
    # ① 앞머리 확장: 머리 최상단 ~ 얼굴 상단 사이 좌우 1px 확장
    for y in range(hy0, fy0 + 2):
        for x in range(0, 96):
            p = im.getpixel((x, y))
            if p in (H, hS):
                for dx in (-1, 1):
                    nx = x + dx
                    if 0 <= nx < 96 and im.getpixel((nx, y))[3] == 0:
                        put((nx, y), H)
    # ② 카테인: 얼굴 시작 ~ 허리까지 몸 실루엣 좌우 가장자리를 따라 2px 폭의 머리카락
    for y in range(fy0, stop):
        lx = rx = None
        for x in range(0, 96):
            if im.getpixel((x, y))[3] > 0:
                if lx is None: lx = x
                rx = x
        if lx is None:
            continue
        # 외곽에서 안쪽 2px를 머리색으로 (머리/피부/옷 가리지 않고 덮는다 → 머리카락이 몸을 따라 흐름)
        for x in (lx, lx + 1, rx - 1, rx):
            if 0 <= x < 96:
                cur = im.getpixel((x, y))
                if cur[3] > 0 and cur not in (K, SH):
                    put((x, y), H)
        # 바깥 1px 외곽선
        if lx - 1 >= 0 and im.getpixel((lx - 1, y))[3] == 0:
            put((lx - 1, y), K)
        if rx + 1 < 96 and im.getpixel((rx + 1, y))[3] == 0:
            put((rx + 1, y), K)
    return im

# ---------- 팔레트 재매핑 ----------
def remap(im, mapping):
    """mapping: {원본RGBA: 신규RGBA}"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p in mapping:
                px[x, y] = mapping[p]
    return im

def skin_palette(idx):
    name, main, light = SKINS[idx][0], SKINS[idx][1], SKINS[idx][2]
    if main is None:
        return None
    return {SK: main + (255,), SK2: light + (255,)}

def costume_mapping(p):
    return {H: p["hair"], hS: p["hairS"], SK: p["skin"], SK2: p["skin2"],
            CT: p["cloth"], Ct: p["clothS"], Cu: p["clothL"],
            P: p["leg"], Pp: p["legS"], Pd: p["legD"], EY: p["eye"]}

# ---------- 생성 ----------
def gen():
    made = 0
    # 1) 여성 베이스 6피부 + 남성 비기본 피부 5종
    for gi, g in enumerate(["m", "f"]):
        for si in range(6):
            if g == "m" and si == 2:
                continue  # 기본 = hero_* 그대로
            sm = skin_palette(si)
            if sm is None and g == "f":
                sm = {}  # 여성 기본 피부: 실루엣만 변형
            prefix = f"ch{g}{si}"
            for fr in FRAMES:
                im = load_frame(fr)
                px = colors_of(im)
                if g == "f":
                    im = make_longhair(im, px)
                    px = colors_of(im)
                    im = make_skirt(im, px)
                if sm:
                    im = remap(im, sm)
                im.save(f"{OUT}/{prefix}_{fr}.webp", lossless=True)
                made += 1
    # 2) 코스튬 10종 (완전 교체)
    for key, cfg in COSTUMES.items():
        for fr in FRAMES:
            im = load_frame(fr)
            px = colors_of(im)
            if cfg["female"]:
                im = make_longhair(im, px)
                px = colors_of(im)
                im = make_skirt(im, px)
            im = remap(im, costume_mapping(cfg["p"]))
            im.save(f"{OUT}/cost_{key}_{fr}.webp", lossless=True)
            made += 1
    print("generated frames:", made)

# ---------- 장식(어태치) 스프라이트 ----------
def draw_grid(grid, colormap, path, scale=1):
    """문자 그리드 → 스프라이트. . = 투명"""
    h = len(grid); w = max(len(r) for r in grid)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == "." or ch == " ":
                continue
            im.putpixel((x, y), colormap[ch])
    if scale > 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    im.save(path, lossless=True)

ACC = {
    # 황금 왕관 (머리 위 고정)
    "acc_crown": (".GGGGGGGGG.\n"
                  "GGYGGGGGGYG\n"
                  "GYRYGGGYRYG\n"
                  "GGGGGRGGGGG\n"
                  ".GGGGGGGGG.\n"
                  ".DDDDDDDDD.",
                  {"G": (232, 190, 80, 255), "Y": (255, 232, 140, 255), "R": (220, 60, 60, 255), "D": (150, 112, 40, 255)}),
    # 진홍 리본 (머리 옆 고정)
    "acc_ribbon": ("RR..RR\n"
                   "RRR.RRR\n"
                   ".RRRRR.\n"
                   "..RRR..\n"
                   ".RRRRR.\n"
                   "RR...RR",
                   {"R": (225, 60, 80, 255)}),
    # 성스러운 후광 (머리 위 공중 부양)
    "acc_halo": ("..GGGGGG..\n"
                  ".G......G.\n"
                  "G........G\n"
                  ".G......G.\n"
                  "..GGGGGG..",
                  {"G": (255, 224, 120, 230)}),
}

def gen_acc():
    for name, (grid, cmap) in ACC.items():
        draw_grid(grid.split("\n"), cmap, f"{OUT}/{name}.webp")
    # 날개 2종 — 대칭 픽셀 드로잉
    def wings(mem, edge, alpha=235):
        im = Image.new("RGBA", (26, 14), (0, 0, 0, 0))
        rows = [
            (0,  "...XXXXXXXXXX............"),
            (1,  "..XXXXXXXXXXXX..........."),
            (2,  ".XXXXXXXXXXXXXX.........."),
            (3,  ".XXXXXXXXXXXXXXX........."),
            (4,  "..XXXXXXXXXXXXXXX........"),
            (5,  "..XXXXXXXXXXXXXXXX......."),
            (6,  "...XXXXXXXXXXXXXXX......."),
            (7,  "....XXXXXXXXXXXXX........"),
            (8,  ".....XXXXXXXXXXX........."),
            (9,  "......XXXXXXXXX.........."),
            (10, ".......XXXXXXX..........."),
            (11, "........XXXXX............"),
            (12, ".........XXX............."),
            (13, "..........X.............."),
        ]
        for y, row in rows:
            for x, ch in enumerate(row):
                if ch == "X":
                    im.putpixel((x, y), mem)
        # 오른쪽 날개 (미러)
        for y in range(im.height):
            for x in range(im.width):
                p = im.getpixel((x, y))
                if p[3] > 0:
                    im.putpixel((im.width - 1 - x, y), p)
        return im
    wings((120, 40, 60, 235), None).save(f"{OUT}/acc_wings_devil.webp", lossless=True)
    wings((150, 235, 250, 200), None).save(f"{OUT}/acc_wings_fairy.webp", lossless=True)
    print("accessories done")

if __name__ == "__main__":
    gen()
    gen_acc()
    # 검증: 프레임 수
    import glob
    n = len(glob.glob(f"{OUT}/cost_*_idle0.webp")) + len(glob.glob(f"{OUT}/ch?*_idle0.webp"))
    print("variants (excl hero):", n)
