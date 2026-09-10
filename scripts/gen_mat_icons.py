#!/usr/bin/env python3
# v1.0.8 무한 콘텐츠 — 재료 아이콘 3종 (32x32 픽셀아트, 기존 아이콘 스타일 정합)
# mat_mana(마나 결정·청색 수정) / mat_heart(몬스터 심장) / mat_mithril(미스릴 가루·은분)
from PIL import Image, ImageDraw

OUT = "/home/z/my-project/public/assets/"

def px(pixels, name):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (x, y, col) in pixels:
        d.point((x, y), col)
    im.save(OUT + name, "WEBP", lossless=True, quality=100, method=6)
    print("saved", name, len(pixels), "px")

# ---- 공용: 대각선 다이아몬드 결정 (추·하이라이트·외곽선) ----
def crystal(inner, light, dark, outline=(20, 16, 34, 255)):
    P = []
    cx = 16
    for dy in range(-9, 10):
        w = 9 - abs(dy)          # 반폭
        for dx in range(-w, w + 1):
            x, y = cx + dx, 15 + dy
            if dy < -6 and dx > 1: continue  # 위쪽 뾰족
            if dy > 6 and abs(dx) > 2: continue  # 아래쪽 뾰족
            P.append((x, y, inner))
    # 좌측 하이라이트 / 우측 음영
    for dy in range(-6, 6):
        P.append((cx - 4, 15 + dy, light))
        if dy < 4: P.append((cx - 5, 15 + dy, light))
        P.append((cx + 4, 15 + dy + 1, dark))
    return P

# 마나 결정 — 청보라 수정 + 내부 발광 코어
mana = crystal((92, 128, 255, 255), (198, 220, 255, 255), (56, 74, 190, 255))
mana += [(16, 12, (235, 242, 255, 255)), (16, 13, (235, 242, 255, 255)), (16, 14, (198, 220, 255, 255)),
         (15, 13, (235, 242, 255, 255)), (17, 13, (235, 242, 255, 255))]
# 반짝 스파클
for sx, sy in [(9, 8), (24, 10), (10, 23)]:
    mana += [(sx, sy, (255, 255, 255, 255)), (sx - 1, sy, (255, 255, 255, 180)), (sx + 1, sy, (255, 255, 255, 180)),
             (sx, sy - 1, (255, 255, 255, 180)), (sx, sy + 1, (255, 255, 255, 180))]
px(mana, "item_mat_mana.webp")

# ---- 몬스터 심장 — 붉은 하트 + 혈관 + 광택 ----
HEART = [
 "  ##  ##  ",
 " ######## ",
 "##########",
 "##########",
 "##########",
 " ######## ",
 "  ######  ",
 "   ####   ",
 "    ##    ",
]
heart = []
rows = len(HEART)
for ry, row in enumerate(HEART):
    for rx, ch in enumerate(row):
        if ch != "#":
            continue
        # 2x2 블록 (32x32 캔버스에서 알맞은 크기)
        x, y = 6 + rx * 2, 7 + ry * 2
        col = (196, 52, 66, 255)
        if rx <= 3 and ry <= 3: col = (238, 108, 118, 255)
        if rx >= 6 and ry >= 5: col = (140, 30, 44, 255)
        for dx in (0, 1):
            for dy in (0, 1):
                heart.append((x + dx, y + dy, col))
heart += [(10, 11, (255, 190, 196, 255)), (10, 12, (255, 190, 196, 255)), (11, 10, (255, 190, 196, 255)), (11, 11, (255, 190, 196, 255))]
# 위쪽 대동맥 두 줄 (2x2)
for x in (14, 16, 18):
    for dx in (0, 1):
        heart.append((x + dx, 5, (140, 30, 44, 255)))
        heart.append((x + dx, 4, (140, 30, 44, 255)))
px(heart, "item_mat_heart.webp")

# ---- 미스릴 가루 — 은은한 은빛 가루 더미 + 반짝임 ----
PILE = [
 "      ..      ",
 "   . .##. .   ",
 "  . ##### .   ",
 "   ########  ",
 "  ########## ",
 " ############",
 "#############",
]
sil = (206, 214, 228, 255)
sil_l = (240, 245, 252, 255)
sil_d = (150, 160, 180, 255)
mith = []
base_y = 26
for ry, row in enumerate(PILE):
    yy = base_y - (len(PILE) - 1 - ry) * 2
    for rx, ch in enumerate(row):
        if ch == " ":
            continue
        x = 3 + rx * 2
        if ch == ".": col = sil_l
        elif ry <= 1: col = sil_l
        elif ry >= len(PILE) - 2: col = sil_d
        else: col = sil
        for dx in (0, 1):
            for dy in (0, 1):
                mith.append((x + dx, yy + dy, col))
# 날리는 가루 입자
for gx, gy in [(7, 12), (22, 10), (24, 15), (6, 18), (20, 6)]:
    mith.append((gx, gy, sil_l))
for gx, gy in [(10, 8), (19, 13)]:
    mith.append((gx, gy, (255, 255, 255, 255)))
px(mith, "item_mat_mithril.webp")

# 사이즈 검증
from PIL import Image as I
for n in ("item_mat_mana", "item_mat_heart", "item_mat_mithril"):
    im = I.open(OUT + n + ".webp")
    print(n, im.size)
print("OK")
