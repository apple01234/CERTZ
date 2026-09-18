#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.2.0 캐릭터 외형 대개편 생성기 (유저 지시 #6/#7/#9/#13/#16)
- (#9 예쁜 여캠) 기존 chf* 6종에 애니메이션풍 눈(하이라이트+아이리스+속눈썹)+블러셔 적용
- (#13 2차 8직업 외형 분화) jobf_/jobm_ 16시트 — 직업별 머리/의상/눈 색 완전 분리
  버서커(붉은 야성)/가디언(강철+금)/스나이퍼(올리브)/윈드러너(하늘빛)/
  아크메이지(제비꽃)/세이지(상아)/어세신(칠흑)/스와시버클러(남빛+금)
- (#7 GM 캐릭터) gm_ 시트 — 파란 몸 + 무지개 머리 (유저 제공 GM.jpg 모티프)
- (#16 씹덕) 머리 광택 밴드(직업/GM 시트) + 눈 하이라이트 = 씹덕 요소의 도트 구현

원리: gen_char_system.py와 동일 — hero_* 14색 고정 팔레트 매핑
"""
import os
import colorsys
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

# ---------- 직업 팔레트 (#13 — 8직업 완전 분화) ----------
def pal(hair, hairS, skin, skin2, cloth, clothS, clothL, leg, legS, legD, eye=EY):
    return {"hair": hair, "hairS": hairS, "skin": skin, "skin2": skin2,
            "cloth": cloth, "clothS": clothS, "clothL": clothL,
            "leg": leg, "legS": legS, "legD": legD, "eye": eye}

JOBS = {
    # 버서커 — 붉은 야성 (광전사의 전투 머리)
    "berserker": pal((196, 44, 44), (140, 28, 30), (240, 204, 172), (252, 224, 196),
                     (66, 50, 46), (48, 36, 34), (94, 74, 68),
                     (52, 44, 50), (38, 32, 38), (26, 22, 28), eye=(226, 74, 62)),
    # 가디언 — 강철+금 (수호자의 중장비)
    "guardian": pal((224, 230, 242), (176, 184, 204), (236, 200, 168), (250, 220, 192),
                    (112, 142, 192), (82, 108, 154), (172, 198, 234),
                    (72, 88, 122), (54, 68, 96), (38, 48, 70), eye=(240, 192, 72)),
    # 스나이퍼 — 올리브 (매의 눈 저격수)
    "sniper": pal((92, 116, 60), (66, 86, 42), (232, 196, 160), (248, 216, 184),
                  (98, 126, 74), (72, 96, 54), (142, 172, 112),
                  (96, 72, 50), (72, 54, 38), (50, 38, 26), eye=(232, 162, 62)),
    # 윈드러너 — 하늘빛 (질풍의 경장갑)
    "windrunner": pal((112, 202, 232), (76, 156, 190), (240, 206, 174), (252, 226, 198),
                      (240, 246, 250), (192, 216, 230), (255, 255, 255),
                      (62, 162, 192), (46, 124, 150), (32, 90, 110), eye=(84, 202, 232)),
    # 아크메이지 — 제비꽃 (대마법사의 로브)
    "archmage": pal((152, 112, 222), (112, 80, 170), (238, 204, 176), (252, 226, 200),
                    (88, 56, 152), (64, 40, 114), (130, 94, 198),
                    (54, 36, 94), (40, 26, 72), (28, 18, 50), eye=(172, 112, 255)),
    # 세이지 — 상아 (현자의 순백 로브)
    "sage": pal((206, 206, 212), (160, 160, 170), (234, 198, 168), (250, 218, 190),
                (242, 238, 224), (210, 204, 186), (255, 255, 250),
                (198, 182, 142), (170, 154, 116), (140, 126, 92), eye=(112, 192, 122)),
    # 어세신 — 칠흑 (암살자의 그림자)
    "assassin": pal((56, 46, 72), (40, 32, 54), (226, 190, 162), (242, 212, 186),
                    (40, 34, 48), (30, 25, 36), (62, 54, 76),
                    (32, 28, 40), (24, 20, 30), (16, 13, 20), eye=(236, 82, 82)),
    # 스와시버클러 — 남빛+금 (검객의 단정한 차림)
    "swashbuckler": pal((142, 94, 54), (104, 68, 38), (236, 200, 168), (250, 220, 192),
                        (48, 72, 132), (36, 54, 102), (82, 112, 182),
                        (62, 54, 46), (46, 40, 34), (32, 28, 24), eye=(202, 152, 92)),
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

def make_skirt(im, px):
    legs = [pt for pt in px.get("leg", [])]
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
            c = K if (x == xl or x == xr) else (Pp if hem else P)
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

def make_longhair(im, px):
    if "hair" not in px:
        return im
    hair = px["hair"] + px.get("hairS", [])
    hx0, hy0, hx1, _ = bbox_of(hair)
    face_pts = px.get("skin", []) + px.get("skin2", [])
    fy0 = min(y for _, y in face_pts) if face_pts else hy0 + 8
    legs = px.get("leg", [])
    stop = (bbox_of(legs)[1] + 4) if legs else fy0 + 14
    put = im.putpixel
    for y in range(hy0, fy0 + 2):
        for x in range(0, 96):
            p = im.getpixel((x, y))
            if p in (H, hS):
                for dx in (-1, 1):
                    nx = x + dx
                    if 0 <= nx < 96 and im.getpixel((nx, y))[3] == 0:
                        put((nx, y), H)
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
                    put((x, y), H)
        if lx - 1 >= 0 and im.getpixel((lx - 1, y))[3] == 0:
            put((lx - 1, y), K)
        if rx + 1 < 96 and im.getpixel((rx + 1, y))[3] == 0:
            put((rx + 1, y), K)
    return im

def remap(im, mapping):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p in mapping:
                px[x, y] = mapping[p]
    return im

def job_mapping(p):
    return {H: p["hair"], hS: p["hairS"], SK: p["skin"], SK2: p["skin2"],
            CT: p["cloth"], Ct: p["clothS"], Cu: p["clothL"],
            P: p["leg"], Pp: p["legS"], Pd: p["legD"], EY: p["eye"]}

# ---------- (#9/#16) 애니메이션풍 눈 + 블러셔 ----------
WHITE = (255, 244, 238, 255)

def lighten(c, f=1.45):
    return tuple(min(255, int(v * f)) for v in c[:3]) + (255,)

def pretty_eyes(im, eye_color, skin_colors, blush=(255, 148, 168, 205)):
    """EY 클러스터(2×4 ×2)를 애니메이션풍으로: 하이라이트+아이리스+속눈썹+블러셔"""
    if len(eye_color) == 3:
        eye_color = tuple(eye_color) + (255,)
    if len(skin_colors) and len(skin_colors[0]) == 3:
        skin_colors = [tuple(c) + (255,) for c in skin_colors]
    px = im.load()
    pts = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y] == eye_color]
    if not pts:
        return im
    # 클러스터 분할 (x 갭 > 3)
    xs = sorted({x for x, _ in pts})
    clusters = [[xs[0]]]
    for x in xs[1:]:
        if x - clusters[-1][-1] > 3:
            clusters.append([x])
        else:
            clusters[-1].append(x)
    if len(clusters) != 2:
        return im  # 예상 외 형태 — 안전하게 스킵
    ys = sorted({y for _, y in pts})
    side = (clusters[1][0] - clusters[0][-1]) <= 4  # 측면(두 눈이 가까움)
    for ci, cxs in enumerate(clusters):
        x0 = cxs[0]
        x1 = cxs[-1]
        cy0 = ys[0]
        is_right = ci == 1
        if side:
            inner = x1  # 측면(오른쪽 향함) — 코 쪽 = 오른쪽
            outer = x0
        else:
            inner = (x0 if is_right else x1)  # 정면 — 코 쪽
            outer = (x1 if is_right else x0)
        # 하이라이트 (위-안쪽 1px)
        if px[inner, cy0 + 1] == eye_color:
            px[inner, cy0 + 1] = WHITE
        # 아이리스 빛 (아래-바깥 1px 밝게)
        if px[outer, cy0 + 2] == eye_color:
            px[outer, cy0 + 2] = lighten(eye_color, 1.55)
        # 속눈썹 (위-바깥 1px 추가)
        if px[outer, cy0 - 1][3] == 0:
            px[outer, cy0 - 1] = (28, 20, 22, 255)
        # 블러셔 (바깥-아래 2px, 피부 위에만)
        for dx in ([outer, outer + (1 if is_right and not side else -1)] if not side else [outer]):
            by = cy0 + 4
            if 0 <= dx < im.width and by < im.height:
                under = px[dx, by]
                if under[3] > 0 and under in skin_colors:
                    px[dx, by] = blush
    return im

def hair_gloss(im, hair_color, hairS_color):
    """(#16 씹덕) 머리 윗부분에 광택 밴드 — 헤어 메인색 픽셀을 상단 2열에서 밝게"""
    if len(hair_color) == 3:
        hair_color = tuple(hair_color) + (255,)
    if len(hairS_color) == 3:
        hairS_color = tuple(hairS_color) + (255,)
    px = im.load()
    ys = [y for y in range(im.height) for x in range(im.width) if px[x, y] == hair_color]
    if not ys:
        return im
    top = min(ys)
    for y in range(top, top + 2):
        for x in range(im.width):
            if px[x, y] == hair_color:
                px[x, y] = lighten(hair_color, 1.32)
            elif px[x, y] == hairS_color:
                px[x, y] = hair_color
    return im

# ---------- (#7) GM 무지개 머리 ----------
def rainbow_hair(im, targets):
    """머리색 픽셀을 x 위치 기반 무지개 그라데이션으로 (GM.jpg 모티프)
    targets: {원본색: 대체휘도색} — 대체색의 색상(hue)만 x 위치로 회전"""
    targets = {(tuple(t) + (255,) if len(t) == 3 else t): (tuple(v) + (255,) if len(v) == 3 else v)
               for t, v in targets.items()}
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p in targets:
                base = targets[p]
                hh, ss, vv = colorsys.rgb_to_hsv(base[0]/255, base[1]/255, base[2]/255)
                hh = (x / 96.0 * 2.2) % 1.0  # 좌→우 2바퀴 무지개
                r, g, b = colorsys.hsv_to_rgb(hh, min(1.0, ss + 0.15), max(0.62, vv))
                px[x, y] = (int(r*255), int(g*255), int(b*255), 255)
    return im

# ---------- 생성 ----------
def main():
    made = 0
    # 1) (#9) 기존 chf* 6종 + chm* 5종 — 애니눈+블러셔 인플레이스 적용
    #    (피부 톤별 블러셔가 피부 위에만 얹히도록 각 시트의 피부색 전달)
    skin_of_sheet = {
        "chf0": [(248, 224, 198, 255), (255, 240, 222, 255)],
        "chf1": [(232, 197, 159, 255), (247, 217, 185, 255)],
        "chf2": [SK, SK2],
        "chf3": [(156, 110, 78, 255), (182, 142, 104, 255)],
        "chf4": [(126, 86, 58, 255), (156, 114, 80, 255)],
        "chf5": [(96, 62, 42, 255), (124, 88, 62, 255)],
        "chm0": [(248, 224, 198, 255), (255, 240, 222, 255)],
        "chm1": [(232, 197, 159, 255), (247, 217, 185, 255)],
        "chm3": [(156, 110, 78, 255), (182, 142, 104, 255)],
        "chm4": [(126, 86, 58, 255), (156, 114, 80, 255)],
        "chm5": [(96, 62, 42, 255), (124, 88, 62, 255)],
    }
    for prefix, skins in skin_of_sheet.items():
        for fr in FRAMES:
            path = f"{OUT}/{prefix}_{fr}.webp"
            if not os.path.exists(path):
                continue
            im = Image.open(path).convert("RGBA")
            im = pretty_eyes(im, EY, skins)
            im.save(path, lossless=True)
            made += 1

    # 2) (#13) 직업 시트 16종 — 여성은 실루엣 변형(긴머리+스커트) + 광택
    for key, p in JOBS.items():
        for g in ("f", "m"):
            prefix = f"job{g}_{key}"
            for fr in FRAMES:
                im = load_frame(fr)
                px = colors_of(im)
                if g == "f":
                    im = make_longhair(im, px)
                    px = colors_of(im)
                    im = make_skirt(im, px)
                im = remap(im, job_mapping(p))
                im = pretty_eyes(im, p["eye"], [p["skin"], p["skin2"]])
                im = hair_gloss(im, p["hair"], p["hairS"])
                im.save(f"{OUT}/{prefix}_{fr}.webp", lossless=True)
                made += 1

    # 3) (#7) GM 시트 — 파란 몸 + 무지개 머리
    gm = pal((240, 240, 240), (210, 210, 220), SK, SK2,
             (64, 148, 255), (44, 110, 214), (130, 196, 255),
             (52, 124, 236), (38, 96, 190), (26, 66, 140), eye=(36, 34, 54))
    for fr in FRAMES:
        im = load_frame(fr)
        im = remap(im, job_mapping(gm))
        im = rainbow_hair(im, {gm["hair"]: (255,120,140), gm["hairS"]: (200,90,120)})
        im = pretty_eyes(im, gm["eye"], [gm["skin"], gm["skin2"]])
        im.save(f"{OUT}/gm_{fr}.webp", lossless=True)
        made += 1

    print("generated:", made)
    # 검증: 시트별 대표 프레임 존재 + 눈 하이라이트 존재
    checks = ["jobf_berserker_idle0", "jobm_guardian_idle0", "gm_idle0", "chf0_idle0"]
    for c in checks:
        p = f"{OUT}/{c}.webp"
        ok = os.path.exists(p)
        hi = False
        if ok:
            im = Image.open(p).convert("RGBA")
            hi = any(im.getpixel((x, y)) == WHITE for y in range(im.height) for x in range(im.width))
        print(f"{c}: exists={ok} highlight={hi}")

if __name__ == "__main__":
    main()
