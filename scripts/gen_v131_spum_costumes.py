#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.3.1 (#1) — SPUM 에셋 신규 플레이어 코스튬 8세트 생성기
(유저 지시: "spum 에셋 npc 처럼 플레이어 캐릭터 코스튬을 새로 만들어 (기존 플레이어 캐릭터 꾸미지 말고)")

기존 cost_* 세트는 hero 베이스 리컬러(팔레트 치환)라 "기존 캐릭터 변형"으로 보였다.
이번엔 유저 제공 SPUM 팩(Unity Addon Ver300/Legacy 파트)의 실제 도트 아트를 조합해
완전히 새로운 외형을 만든다:

  · 머리  — SPUM 헤어 파트(20종) 리컬러 탑재 (베이스 헤어 위)
  · 투구  — SPUM 헬멧 파트(10종) 탑재 (viking/그레이트헬름/후드/캡)
  · 가슴  — SPUM 의상 파트(클로드/아머) 코어 탑재 — 팔 애니는 베이스 유지(소매 리컬러)
  · 망토  — SPUM 캡 파트 뒤쪽 탑재 (요정날개와 동일 뒤 렌더)
  · 하체  — 파트 팔레트로 의상 재염색 (다리 애니 유지)

프레임 구조: idle0-3 / walk0-3 / walkup0-3 / walkside0-3 / atk0-3 / atkdown0-3 / atkup0-3 (28프레임)
출력: cost_{key}_*.webp (여형) / costm_{key}_*.webp (남형) — 96x64 캔버스, 기존 시트와 동일 규격
"""
import os
from PIL import Image

SRC = "/home/z/my-project/public/assets"
SPUM = "/home/z/my-project/upload/extracted/SPUM/SPUM/Resources/Addons"
OUT = "/home/z/my-project/public/assets"

V300 = f"{SPUM}/Ver300/0_Unit/0_Sprite"
LEGACY = f"{SPUM}/Legacy/0_Unit/0_Sprite"

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

# ---------- 베이스 바디 팔레트 (gen_v120_looks 계승 — 실측값) ----------
HAIR = [(87, 58, 35), (64, 39, 23), (53, 35, 21), (51, 26, 20)]
SKIN = [(172, 123, 93), (193, 172, 143), (240, 204, 172), (248, 224, 198),
        (255, 240, 222), (255, 244, 238), (96, 62, 42), (124, 88, 62)]
CLOTH = [(164, 168, 181), (120, 126, 151), (219, 210, 199)]
LEG = [(44, 101, 181), (29, 67, 138), (13, 32, 94)]
BODY_ALL = CLOTH + LEG  # 의상 재염색 대상 (셔츠+바지/스커트)
EYE = (33, 17, 13)
TOL = 8  # v2 — 16에서 축소: chf5 피부톤(96,62,42)/(124,88,62)이 헤어(87,58,35)와 근접해 얼굴이 헤어 재염색에 삼켜지는 버그 수정

def close(c, pal, tol=TOL):
    return any(abs(c[0]-p[0]) <= tol and abs(c[1]-p[1]) <= tol and abs(c[2]-p[2]) <= tol for p in pal)

def content_bbox(im):
    """파트 이미지의 불투명 컨텐츠 bbox"""
    return im.getbbox()

def load_part(path):
    im = Image.open(path).convert("RGBA")
    bb = content_bbox(im)
    return im.crop(bb) if bb else im

def tint_white_part(part, main, shade=None, hi=None):
    """SPUM 흰색 파트(헤어 등)를 세트 색으로 재염색 — 명암 보존 (L 기반)"""
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
    """마스크에 걸린 픽셀을 명도 3단 팔레트로 재염색 (애니 유지 의상 재염)"""
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0 or not mask_test((r, g, b)):
                continue
            L = (r + g + b) / 3
            if L > 150:
                t = c_main
            elif L > 95:
                t = c_shade
            else:
                t = c_dark
            px[x, y] = (t[0], t[1], t[2], a)
    return out

def region_bbox(im, mask_test, ymin=0, ymax=None):
    """마스크 픽셀 bbox (y 범위 제한 가능)"""
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
    """파트를 box 폭에 맞춰 NEAREST 스케일 후 탑재. anchor: center/top, bottom_at 지정 시 파트 하단을 그 y로"""
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

# ---------- 8세트 정의 (SPUM 실제 파일) ----------
# gender: f → cost_, m → costm_  |  base: 여=chf5, 남=chm0
SETS = [
    {
        "key": "valkyrie", "gender": "f", "face_over": True,
        "hair": (f"{V300}/2_Hair/New_Hair_05.png", (238, 240, 250), (188, 196, 224), (255, 255, 255)),
        "helmet": (f"{V300}/4_Helmet/New_Helmet_02.png", None),  # 은빛 나이트 투구
        "chest": (f"{V300}/4_Cloth/New_Cloth_06.png", None),     # 밝은 회색 상의
        "armor": (f"{V300}/7_Armor/New_Armor_02.png", None),
        "cape": None,
        "outfit": ((196, 208, 232), (148, 160, 196), (104, 116, 156)),  # 의상 재염색 (은청)
        "pant": ((92, 104, 148), (64, 74, 112), (44, 52, 84)),
    },
    {
        "key": "witch", "gender": "f", "face_over": True,
        "hair": (f"{LEGACY}/0_Hair/Hair_4.png", (206, 170, 255), (156, 116, 214), (240, 224, 255)),
        "helmet": (f"{LEGACY}/4_Helmet/Helmet_3.png", None),      # 보라 마법사 후드
        "chest": (f"{V300}/4_Cloth/New_Cloth_12.png", None),      # 보라 마법 로브
        "armor": None,
        "cape": (f"{LEGACY}/7_Back/Back_2.png", None),            # 보라 망토
        "outfit": ((146, 96, 190), (108, 66, 152), (76, 44, 112)),
        "pant": ((90, 58, 128), (64, 40, 96), (44, 26, 66)),
    },
    {
        "key": "sylvan", "gender": "f", "face_over": True,
        "hair": (f"{V300}/2_Hair/New_Hair_09.png", (150, 224, 138), (104, 172, 96), (206, 255, 190)),
        "helmet": (f"{V300}/4_Helmet/New_Helmet_09.png", None),   # 갈색 후드
        "chest": (f"{V300}/4_Cloth/New_Cloth_08.png", None),      # 녹색 튜닉
        "armor": None,
        "cape": None,
        "outfit": ((122, 186, 104), (88, 140, 76), (60, 98, 52)),
        "pant": ((124, 92, 58), (92, 66, 40), (62, 44, 26)),
    },
    {
        "key": "lily", "gender": "f", "face_over": True,
        "hair": (f"{V300}/2_Hair/New_Hair_13.png", (42, 38, 46), (26, 24, 30), (74, 70, 82)),
        "helmet": None,
        "chest": (f"{LEGACY}/2_Cloth/Cloth_8.png", None),         # 핑크/적 상의
        "armor": None,
        "cape": (f"{LEGACY}/7_Back/Back_1.png", None),            # 붉은 망토
        "outfit": ((226, 128, 148), (176, 88, 110), (126, 56, 78)),
        "pant": ((226, 214, 224), (178, 166, 182), (126, 116, 130)),
    },
    {
        "key": "warlord", "gender": "m",
        "hair": (f"{V300}/2_Hair/New_Hair_01.png", (48, 40, 44), (30, 25, 28), (78, 68, 74)),
        "helmet": (f"{V300}/4_Helmet/New_Helmet_05.png", None),   # 암흑 바이킹 뿔투구
        "chest": (f"{LEGACY}/2_Cloth/Cloth_5.png", None),         # 암적 조끼
        "armor": (f"{V300}/7_Armor/New_Armor_03.png", None),
        "cape": (f"{LEGACY}/7_Back/Back_1.png", None),
        "outfit": ((96, 90, 108), (68, 62, 80), (46, 42, 56)),
        "pant": ((72, 64, 80), (50, 44, 58), (34, 30, 40)),
    },
    {
        "key": "paladin", "gender": "m",
        "hair": (f"{V300}/2_Hair/New_Hair_04.png", (238, 226, 168), (192, 178, 120), (255, 248, 200)),
        "helmet": (f"{LEGACY}/4_Helmet/Helmet_9.png", None),      # 그레이트 헬름
        "chest": (f"{V300}/4_Cloth/New_Cloth_03.png", None),      # 청색 자켓
        "armor": (f"{V300}/7_Armor/New_Armor_01.png", None),
        "cape": None,
        "outfit": ((126, 158, 222), (94, 120, 176), (64, 84, 128)),
        "pant": ((212, 216, 228), (164, 170, 186), (116, 122, 140)),
    },
    {
        "key": "nightblade", "gender": "m",
        "hair": (f"{V300}/2_Hair/New_Hair_11.png", (46, 44, 58), (30, 28, 38), (76, 74, 92)),
        "helmet": (f"{V300}/4_Helmet/New_Helmet_06.png", None),   # 암흑 그레이트 헬름
        "chest": (f"{V300}/4_Cloth/New_Cloth_01.png", None),      # 회흑 상의
        "armor": None,
        "cape": None,
        "outfit": ((74, 74, 92), (52, 52, 66), (36, 36, 46)),
        "pant": ((58, 56, 72), (42, 40, 52), (28, 27, 36)),
    },
    {
        "key": "mariner", "gender": "m",
        "hair": (f"{V300}/2_Hair/New_Hair_07.png", (128, 86, 52), (92, 60, 34), (176, 128, 84)),
        "helmet": (f"{LEGACY}/4_Helmet/Helmet_7.png", None),      # 청색 캡
        "chest": (f"{LEGACY}/2_Cloth/Cloth_2.png", None),         # 청록 상의
        "armor": None,
        "cape": None,
        "outfit": ((84, 126, 190), (60, 94, 148), (40, 64, 104)),
        "pant": ((226, 220, 204), (180, 172, 154), (128, 122, 108)),
    },
]


# v2 — 교차 성별 변형: 모든 키가 cost_/costm_ 양쪽 시트를 갖도록 (applyBodyLook 성별 분기 대응)
CROSS = []
for _s in SETS:
    _t = dict(_s)
    _t["gender"] = "m" if _s["gender"] == "f" else "f"
    CROSS.append(_t)
SETS.extend(CROSS)

def compose(base_path, s, frame):
    base = Image.open(f"{SRC}/{base_path}_{frame}.webp").convert("RGBA")
    img = base.copy()

    # 1) 의상 재염색 (셔츠+바지/스커트 → 세트 팔레트) — 애니메이션 유지
    img = recolor_pixels(img, lambda c: close(c, BODY_ALL), *s["outfit"])

    # 마스크/bbox 계산 (재염색 전 원본에서)
    hair_bb = region_bbox(base, lambda c: close(c, HAIR) and not close(c, [EYE], 10))
    body_bb = region_bbox(base, lambda c: close(c, BODY_ALL) or close(c, HAIR))
    if body_bb is None:
        body_bb = (35, 15, 61, 57)
    # v2 — 머리(두부) 영역만 한정한 헤어 bbox: 여캠(chf5)은 장발 실루엣이 몸통 절반을 덮어
    #  전체 헤어 bbox를 쓰면 파트가 과대 스케일된다. 상단 ~40%만 잘라 "머리 코어"로 스케일 기준을 잡는다.
    head_lim = body_bb[1] + max(12, int((body_bb[3] - body_bb[1]) * 0.42))
    head_bb = region_bbox(base, lambda c: close(c, HAIR) and not close(c, [EYE], 10), 0, head_lim)
    if head_bb is None:
        head_bb = hair_bb
    # 가슴 코어: 몸통 상부 (어깨~허리) — 팔 스윙의 영향 적은 영역
    chest = (body_bb[0] + 3, body_bb[1] + 8, body_bb[2] - 3, body_bb[1] + 20)

    # 2) 망토 — 몸 뒤 (어깨 뒤 중앙, 아래로 드리움)
    cape = None
    if s["cape"]:
        cape = load_part(s["cape"][0])
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    if cape:
        cb = (body_bb[0] + 2, body_bb[1] + 6, body_bb[2] - 2, min(base.height, body_bb[3] + 14))
        paste_fit(out, cape, cb, scale_w=max(10, (cb[2] - cb[0]) + 6), anchor="top", dy=-2)
        out.alpha_composite(img, (0, 0))
    else:
        out.alpha_composite(img, (0, 0))
    img = out

    # 3) 가슴 의상 파트 탑재 (코어만 — 팔 애니 보존)
    if s["chest"]:
        chest_part = load_part(s["chest"][0])
        paste_fit(img, chest_part, chest, scale_w=max(10, min(24, chest[2] - chest[0]) + 6), anchor="center", dy=0)

    # 4) 어깨 아머
    if s["armor"]:
        armor = load_part(s["armor"][0])
        aw = armor.width
        # 어깨 양옆 2장 (아머 파트를 좌우로 절반 스케일)
        half = armor.resize((max(1, aw // 2), max(1, armor.height // 2)), Image.NEAREST)
        sy = body_bb[1] + 7
        img.alpha_composite(half, (body_bb[0] - 2, sy))
        img.alpha_composite(half.transpose(Image.FLIP_LEFT_RIGHT), (body_bb[2] - half.width + 2, sy))

    # 5) 헤어/투구 — 베이스 헤어를 세트 색으로 재염색 후 파트 탑재.
    #  v4 — face_over 세트(여캠 헤어/후드): SPUM 헤어는 원래 "얼굴 뒤" 합성 파트라
    #  파트를 얹은 뒤 원본 얼굴 패치를 다시 얹어 얼굴을 살린다 (투구-바이저 세트는 제외 — 바이저가 캐릭터). 
    if head_bb:
        if s["hair"]:
            _, h_main, h_shade, _hi = s["hair"]
            img = recolor_pixels(img, lambda c: close(c, HAIR), h_main, h_shade, h_shade)
        # 얼굴(피부) 폭/위치 — 머리 영역 내 피부 bbox
        skin_bb = region_bbox(base, lambda c: close(c, SKIN), 0, head_lim + 6)
        if skin_bb:
            face_top = skin_bb[1]
            face_w = skin_bb[2] - skin_bb[0]
            scale_w = max(13, min(21, face_w + 8))
        else:
            # 후면(walkup) — 얼굴 없음: 머리 코어 하단에 앵커
            face_top = head_bb[3]
            face_w = head_bb[2] - head_bb[0]
            scale_w = max(13, min(21, face_w + 4))
        # 얼굴 패치 (파트 위에 재합성용)
        face_patch = None
        if s.get("face_over") and skin_bb:
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
    for s in SETS:
        base = "chf5" if s["gender"] == "f" else "chm0"
        prefix = ("cost_" if s["gender"] == "f" else "costm_") + s["key"]
        for frame in FRAMES:
            out = compose(base, s, frame)
            out.save(f"{OUT}/{prefix}_{frame}.webp", "WEBP", lossless=True)
            made += 1
        print(f"[OK] {prefix} — {len(FRAMES)}프레임")
    print(f"총 {made}프레임 생성 완료")

if __name__ == "__main__":
    main()
