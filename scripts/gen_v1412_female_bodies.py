#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.12 (#17 유저 지시 "여캐 스프라이트는 아예 다른 에셋을 사용해(짜치게 치마만 달고 그러지 말고)")

기존 chf0~chf5(여캐 기본 몸)는 작은 제네릭 픽셀 사람 — 유저가 "짜치다"고 지적한 대상.
이 스크립트는 유저 제공 SPUM 팩의 실제 파트(헤어·의상·투구·아머·망토)를 프레임별로
합성해 여캐 기본 외형 6종을 "완전히 새로운 SPUM 캐릭터"로 재생성한다.

· 베이스 애니메이션(walk/atk 등 28프레임)은 기존 chf{idx} 시트에서 유지 (움직임 보존)
· 피부톤은 베이스별 보존 (얼굴 패치 재합성) — skinIdx 선택 의미 유지
· 각 슬롯마다 헤어 스타일·의상·색 팔레트를 완전히 다르게 — "치마만 바꾼" 수준이 아니라
  헤어+상의+어깨아머+망토가 전부 다른 별개 캐릭터가 된다.

출력: public/assets/chf{0..5}_{28프레임}.webp (96x64 캔버스 — 기존 규격 동일)
"""
import os
from PIL import Image

SRC = "/home/z/my-project/public/assets"
SPUM = "/home/z/my-project/upload/extracted/SPUM/SPUM/Resources/Addons"
V300 = f"{SPUM}/Ver300/0_Unit/0_Sprite"
LEGACY = f"{SPUM}/Legacy/0_Unit/0_Sprite"
OUT = "/home/z/my-project/public/assets"

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

# ---------- 베이스 바디 팔레트 (gen_v131_spum_costumes 실측값 계승) ----------
HAIR = [(87, 58, 35), (64, 39, 23), (53, 35, 21), (51, 26, 20)]
SKIN = [(172, 123, 93), (193, 172, 143), (240, 204, 172), (248, 224, 198),
        (255, 240, 222), (255, 244, 238), (96, 62, 42), (124, 88, 62)]
CLOTH = [(164, 168, 181), (120, 126, 151), (219, 210, 199)]
LEG = [(44, 101, 181), (29, 67, 138), (13, 32, 94)]
BODY_ALL = CLOTH + LEG
EYE = (33, 17, 13)
TOL = 8

def close(c, pal, tol=TOL):
    return any(abs(c[0]-p[0]) <= tol and abs(c[1]-p[1]) <= tol and abs(c[2]-p[2]) <= tol for p in pal)

def load_part(path):
    im = Image.open(path).convert("RGBA")
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def tint_white_part(part, main, shade=None, hi=None):
    shade = shade or tuple(max(0, int(c * 0.62)) for c in main)
    hi = hi or tuple(min(255, int(c * 1.25 + 22)) for c in main)
    out = part.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            L = (r + g + b) / 3
            if L > 215:
                t = hi
            elif L > 120:
                f = (L - 120) / 95
                t = tuple(int(shade[i] + (main[i] - shade[i]) * f) for i in range(3))
            else:
                f = L / 120
                t = tuple(int(shade[i] * (0.45 + 0.55 * f)) for i in range(3))
            px[x, y] = (t[0], t[1], t[2], a)
    return out

def recolor_pixels(im, mask_test, c_main, c_shade, c_dark):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            L = (r + g + b) / 3
            if L > 150:
                t = c_main
            elif L > 95:
                f = (150 - L) / 55
                t = tuple(int(c_shade[i] + (c_main[i] - c_shade[i]) * f) for i in range(3))
            else:
                f = L / 95
                t = tuple(int(c_dark[i] * (0.55 + 0.45 * f)) for i in range(3))
            px[x, y] = (t[0], t[1], t[2], a)
    return im

def region_bbox(im, mask_test, ymin=0, ymax=None):
    px = im.load()
    minx, miny, maxx, maxy = 10**9, 10**9, -1, -1
    ymax = ymax or im.height
    for y in range(ymin, ymax):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 0 and mask_test((r, g, b)):
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return None
    return (minx, miny, maxx + 1, maxy + 1)

def paste_fit(canvas, part, box, scale_w=None, anchor="center", dy=0, min_w=8, max_w=48, bottom_at=None):
    pw, ph = part.size
    if scale_w is None:
        scale_w = max(min_w, min(max_w, (box[2] - box[0])))
    sc = scale_w / pw
    nw, nh = max(1, int(pw * sc)), max(1, int(ph * sc))
    p2 = part.resize((nw, nh), Image.NEAREST)
    if bottom_at is not None:
        cx = (box[0] + box[2]) // 2
        px_, py_ = cx - nw // 2, bottom_at - nh + dy
    elif anchor == "top":
        cx = (box[0] + box[2]) // 2
        px_, py_ = cx - nw // 2, box[1] + dy
    else:
        cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
        px_, py_ = cx - nw // 2, cy - nh // 2 + dy
    canvas.alpha_composite(p2, (px_, py_))
    return p2

# ---------- 여캐 6종 정의 (슬롯=skinIdx 유지 — 피부톤은 베이스 보존) ----------
# 헤어/의상/아머/망토가 전부 다른 6개의 독립 캐릭터
LOOKS = [
    {  # chf0 — 진홍 전사 소녀: 붉은 장발 + 은빛 어깨아머 + 진홍 튜닉
        "hair": (f"{V300}/2_Hair/New_Hair_06.png", (196, 60, 54), (146, 40, 38), (240, 120, 110)),
        "helmet": None,
        "chest": (f"{V300}/4_Cloth/New_Cloth_03.png", None),
        "armor": (f"{V300}/7_Armor/New_Armor_02.png", None),
        "cape": None,
        "outfit": ((188, 62, 58), (140, 42, 42), (98, 28, 30)),
    },
    {  # chf1 — 보라 마법사 소녀: 보라 후드 + 보라 로브 + 망토
        "hair": (f"{LEGACY}/0_Hair/Hair_4.png", (206, 170, 255), (156, 116, 214), (240, 224, 255)),
        "helmet": (f"{LEGACY}/4_Helmet/Helmet_3.png", None),
        "chest": (f"{V300}/4_Cloth/New_Cloth_12.png", None),
        "armor": None,
        "cape": (f"{LEGACY}/7_Back/Back_2.png", None),
        "outfit": ((146, 96, 190), (108, 66, 152), (76, 44, 112)),
    },
    {  # chf2 — 숲의 궁수 소녀: 녹색 후드 + 녹색 튜닉 + 가죽 팬츠
        "hair": (f"{V300}/2_Hair/New_Hair_09.png", (128, 92, 56), (92, 64, 38), (172, 130, 86)),
        "helmet": (f"{V300}/4_Helmet/New_Helmet_09.png", None),
        "chest": (f"{V300}/4_Cloth/New_Cloth_08.png", None),
        "armor": None,
        "cape": None,
        "outfit": ((122, 186, 104), (88, 140, 76), (60, 98, 52)),
    },
    {  # chf3 — 백은 성직자 소녀: 백금 단발 + 백/금 로브 + 백은 망토
        "hair": (f"{V300}/2_Hair/New_Hair_04.png", (240, 232, 200), (196, 186, 150), (255, 252, 236)),
        "helmet": None,
        "chest": (f"{V300}/4_Cloth/New_Cloth_10.png", None),
        "armor": None,
        "cape": (f"{LEGACY}/7_Back/Back_1.png", None),
        "outfit": ((232, 228, 214), (186, 180, 162), (134, 128, 112)),
    },
    {  # chf4 — 흑의 도적 소녀: 흑발 + 흑의 + 암흑 아머
        "hair": (f"{V300}/2_Hair/New_Hair_11.png", (46, 44, 58), (30, 28, 38), (76, 74, 92)),
        "helmet": None,
        "chest": (f"{V300}/4_Cloth/New_Cloth_01.png", None),
        "armor": (f"{V300}/7_Armor/New_Armor_01.png", None),
        "cape": None,
        "outfit": ((74, 74, 92), (52, 52, 66), (36, 36, 46)),
    },
    {  # chf5 — 하늘 왕녀: 하늘색 장발 + 청 왕실 드레스 + 백은 어깨아머
        "hair": (f"{V300}/2_Hair/New_Hair_13.png", (120, 176, 232), (84, 130, 186), (186, 220, 250)),
        "helmet": None,
        "chest": (f"{V300}/4_Cloth/New_Cloth_06.png", None),
        "armor": (f"{V300}/7_Armor/New_Armor_02.png", None),
        "cape": None,
        "outfit": ((92, 128, 210), (64, 92, 164), (42, 60, 118)),
    },
]

def compose(base_path, s, frame):
    base = Image.open(f"{SRC}/{base_path}_{frame}.webp").convert("RGBA")
    img = base.copy()

    # 1) 의상 재염색 (셔츠+바지/스커트 → 세트 팔레트) — 애니메이션 유지
    img = recolor_pixels(img, lambda c: close(c, BODY_ALL), *s["outfit"])

    hair_bb = region_bbox(base, lambda c: close(c, HAIR) and not close(c, [EYE], 10))
    body_bb = region_bbox(base, lambda c: close(c, BODY_ALL) or close(c, HAIR))
    if body_bb is None:
        body_bb = (35, 15, 61, 57)
    head_lim = body_bb[1] + max(12, int((body_bb[3] - body_bb[1]) * 0.42))
    head_bb = region_bbox(base, lambda c: close(c, HAIR) and not close(c, [EYE], 10), 0, head_lim)
    if head_bb is None:
        head_bb = hair_bb
    chest = (body_bb[0] + 3, body_bb[1] + 8, body_bb[2] - 3, body_bb[1] + 20)

    # 2) 망토 — 몸 뒤
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    if s["cape"]:
        cape = load_part(s["cape"][0])
        cb = (body_bb[0] + 2, body_bb[1] + 6, body_bb[2] - 2, min(base.height, body_bb[3] + 14))
        paste_fit(out, cape, cb, scale_w=max(10, (cb[2] - cb[0]) + 6), anchor="top", dy=-2)
        out.alpha_composite(img, (0, 0))
    else:
        out.alpha_composite(img, (0, 0))
    img = out

    # 3) 가슴 의상 파트
    if s["chest"]:
        chest_part = load_part(s["chest"][0])
        paste_fit(img, chest_part, chest, scale_w=max(10, min(24, chest[2] - chest[0]) + 6), anchor="center", dy=0)

    # 4) 어깨 아머
    if s["armor"]:
        armor = load_part(s["armor"][0])
        aw = armor.width
        half = armor.resize((max(1, aw // 2), max(1, armor.height // 2)), Image.NEAREST)
        sy = body_bb[1] + 7
        img.alpha_composite(half, (body_bb[0] - 2, sy))
        img.alpha_composite(half.transpose(Image.FLIP_LEFT_RIGHT), (body_bb[2] - half.width + 2, sy))

    # 5) 헤어/투구 + 얼굴 패치 (피부톤 보존)
    if head_bb:
        skin_bb = region_bbox(base, lambda c: close(c, SKIN), 0, head_lim + 6)
        if skin_bb:
            face_top = skin_bb[1]
            face_w = skin_bb[2] - skin_bb[0]
            scale_w = max(13, min(21, face_w + 8))
        else:
            face_top = head_bb[3]
            face_w = head_bb[2] - head_bb[0]
            scale_w = max(13, min(21, face_w + 4))
        face_patch = None
        if skin_bb:
            fx0, fy0 = max(0, skin_bb[0] - 1), max(0, skin_bb[1] - 1)
            fx1, fy1 = min(img.width, skin_bb[2] + 1), min(img.height, skin_bb[3] + 1)
            face_patch = (img.crop((fx0, fy0, fx1, fy1)), (fx0, fy0))
        if s["helmet"]:
            helmet = load_part(s["helmet"][0])
            paste_fit(img, helmet, head_bb, scale_w=scale_w, bottom_at=face_top + 2, dy=0)
        elif s["hair"]:
            hpath, h_main, h_shade, h_hi = s["hair"]
            hair = load_part(hpath)
            hair = tint_white_part(hair, h_main, h_shade, h_hi)
            paste_fit(img, hair, head_bb, scale_w=scale_w, bottom_at=face_top + 1, dy=0)
        if face_patch:
            img.alpha_composite(face_patch[0], face_patch[1])

    return img

def main():
    made = 0
    for idx, s in enumerate(LOOKS):
        base = f"chf{idx}"
        for frame in FRAMES:
            out = compose(base, s, frame)
            out.save(f"{OUT}/{base}_{frame}.webp", "WEBP", lossless=True)
            made += 1
        print(f"[OK] {base} — {len(FRAMES)}프레임 재생성")
    print(f"총 {made}프레임 생성 완료")

if __name__ == "__main__":
    main()
