#!/usr/bin/env python3
"""3·4차 전직 스킬 아이콘 32종 생성 — /assets/skillicon/<cls>_{s3,s4}.png
기존 s1/s2 아이콘(RPG Icons Pixel Art, 32x32 다크 배경)과 톤을 맞춘 픽셀아트.
스킬 테마별 고유 글리프 (토네이도/낙뢰/빛기둥/그림자 등)."""
from PIL import Image, ImageDraw
import math, os

OUT = "/home/z/my-project/CERTZ/public/assets/skillicon"
os.makedirs(OUT, exist_ok=True)
S = 32
BG = (13, 18, 28, 255)          # 다크 네이비 배경
BORDER = (42, 56, 78, 255)

def canvas():
    im = Image.new("RGBA", (S, S), BG)
    dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, S - 1, S - 1], outline=BORDER)
    return im, dr

def save(im, name):
    im.save(f"{OUT}/{name}.png")

def bolt(dr, pts, color, w=2):
    dr.line(pts, fill=color, width=w)

def swirl(dr, cx, cy, r0, color, turns=2.2, steps=26, w=2, squash=0.45):
    for i in range(steps):
        t = i / (steps - 1)
        a = t * math.tau * turns
        r = r0 * (0.25 + 0.75 * t)
        x = cx + math.cos(a) * r
        y = cy + math.sin(a) * r * squash
        dr.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=color)

def arrow(dr, x, y, ang, ln, color, head=3):
    dx, dy = math.cos(ang), math.sin(ang)
    ex, ey = x + dx * ln, y + dy * ln
    dr.line([(x, y), (ex, ey)], fill=color, width=1)
    pa = ang + math.pi * 0.85
    pb = ang - math.pi * 0.85
    dr.line([(ex, ey), (ex + math.cos(pa) * head, ey + math.sin(pa) * head)], fill=color, width=1)
    dr.line([(ex, ey), (ex + math.cos(pb) * head, ey + math.sin(pb) * head)], fill=color, width=1)

def ring(dr, cx, cy, r, color, w=2, squash=1.0):
    dr.ellipse([cx - r, cy - r * squash, cx + r, cy + r * squash], outline=color, width=w)

def dot(dr, cx, cy, r, color):
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

def sword(dr, cx, cy, ln, color, ang=-math.pi / 4, w=3):
    dx, dy = math.cos(ang), math.sin(ang)
    bx, by = cx - dx * ln * 0.45, cy - dy * ln * 0.45
    tx, ty = cx + dx * ln * 0.55, cy + dy * ln * 0.55
    dr.line([(bx, by), (tx, ty)], fill=color, width=w)
    # 가드
    gx, gy = -dy, dx
    dr.line([(cx - gx * 4 - dx * 3, cy - gy * 4 - dy * 3), (cx + gx * 4 - dx * 3, cy + gy * 4 - dy * 3)], fill=(230, 200, 120, 255), width=2)

def glowstar(dr, cx, cy, r, color):
    for ang in [0, math.pi / 4, math.pi / 2, 3 * math.pi / 4, math.pi, 5 * math.pi / 4, 3 * math.pi / 2, 7 * math.pi / 4]:
        dr.line([(cx, cy), (cx + math.cos(ang) * r, cy + math.sin(ang) * r)], fill=color, width=1)
    dot(dr, cx, cy, 2, (255, 255, 255, 255))

C = lambda hexv: tuple(int(hexv[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

# ─────────────── 3차 (s3) ───────────────

def i_warlord_s3():  # 전장의 함성 — 뿔피리 + 파장
    im, dr = canvas()
    gold = C("ffb04a")
    dr.polygon([(9, 20), (20, 12), (20, 26)], fill=C("c9803a"))
    dr.line([(20, 12), (26, 8)], fill=gold, width=2)
    dr.line([(20, 26), (26, 23)], fill=gold, width=2)
    dr.line([(20, 19), (27, 16)], fill=gold, width=2)
    ring(dr, 13, 19, 7, gold, 1)
    ring(dr, 13, 19, 11, C("ff7a3c"), 1)
    return im

def i_paladin_s3():  # 성역 — 빛의 결계 돔
    im, dr = canvas()
    gold = C("ffe9a0")
    dr.pieslice([5, 8, 27, 40], 180, 360, fill=(255, 233, 160, 60), outline=gold, width=2)
    dr.line([(5, 24), (27, 24)], fill=gold, width=2)
    glowstar(dr, 16, 17, 5, (255, 255, 255, 255))
    return im

def i_eagleeye_s3():  # 절사명중 — 눈 + 조준십자
    im, dr = canvas()
    grn = C("3cff7a")
    dr.pieslice([6, 10, 26, 26], 20, 160, fill=(20, 40, 28, 255), outline=grn, width=2)
    dot(dr, 16, 18, 3, grn)
    dot(dr, 16, 18, 1, (255, 255, 255, 255))
    dr.line([(16, 8), (16, 13)], fill=grn, width=1); dr.line([(16, 23), (16, 28)], fill=grn, width=1)
    dr.line([(6, 18), (11, 18)], fill=grn, width=1); dr.line([(21, 18), (26, 18)], fill=grn, width=1)
    return im

def i_tempest_s3():  # 폭풍의 눈 — 회오리
    im, dr = canvas()
    mint = C("b9ffe0")
    swirl(dr, 16, 17, 11, mint, turns=2.4, w=2)
    dr.line([(16, 6), (16, 27)], fill=(255, 255, 255, 200), width=2)
    return im

def i_stormbringer_s3():  # 낙뢰 소환
    im, dr = canvas()
    blu = C("9dd8ff")
    bolt(dr, [(17, 4), (12, 13), (17, 14), (11, 27)], C("6f8cff"), 2)
    bolt(dr, [(22, 8), (19, 15), (23, 16), (20, 24)], blu, 1)
    dot(dr, 17, 4, 2, (255, 255, 255, 255))
    return im

def i_chronicle_s3():  # 시간 왜곡 — 시계 + 소용돌이
    im, dr = canvas()
    pale = C("e2e8ff")
    ring(dr, 16, 17, 10, pale, 2)
    dr.line([(16, 17), (16, 10)], fill=pale, width=2)
    dr.line([(16, 17), (21, 19)], fill=C("b0a0ff"), width=2)
    swirl(dr, 16, 17, 5, C("b0a0ff"), turns=1.6, w=1, squash=1.0)
    return im

def i_nightblade_s3():  # 그림자 칼날 — 단검+잔상
    im, dr = canvas()
    pur = C("c08aff")
    sword(dr, 19, 15, 16, pur, -math.pi / 5, 3)
    sword(dr, 13, 20, 12, (90, 50, 130, 255), -math.pi / 5, 2)
    return im

def i_duelist_s3():  # 연격 무도 — 십자 단검
    im, dr = canvas()
    pink = C("ffd8ff")
    sword(dr, 16, 16, 18, pink, -math.pi / 4, 2)
    sword(dr, 16, 16, 18, C("f0c8ff"), math.pi / 4, 2)
    dot(dr, 16, 16, 2, (255, 255, 255, 255))
    return im

def i_warbringer_s3():  # 피의 격노 — 핏방울+분노
    im, dr = canvas()
    red = C("ff3c4c")
    for (x, y, r) in [(11, 12, 3), (20, 10, 4), (16, 20, 3), (23, 19, 2)]:
        dot(dr, x, y, r, red)
        dr.line([(x, y - r - 3), (x, y - r)], fill=red, width=1)
    dr.line([(8, 25), (24, 25)], fill=C("ff7a3c"), width=2)
    return im

def i_crusader_s3():  # 성흔 폭발 — 십자 빛폭발
    im, dr = canvas()
    gold = C("ffe9a0")
    dr.line([(16, 6), (16, 26)], fill=gold, width=3)
    dr.line([(8, 14), (24, 14)], fill=gold, width=3)
    glowstar(dr, 16, 14, 7, (255, 255, 220, 255))
    return im

def i_deadeye_s3():  # 화살 폭우 — 쏟아지는 화살
    im, dr = canvas()
    grn = C("1cff5c")
    for x, y, l in [(9, 5, 8), (16, 3, 10), (23, 6, 8), (12, 14, 7), (20, 15, 8)]:
        arrow(dr, x, y, math.pi / 2, l, grn)
    dr.line([(6, 27), (26, 27)], fill=C("0a5c24"), width=2)
    return im

def i_skylord_s3():  # 하늘의 희망 — 대형 토네이도
    im, dr = canvas()
    cy_ = C("ccffe8")
    for i, (cy, r) in enumerate([(24, 11), (18, 8), (12, 5.5), (7, 3.5)]):
        ring(dr, 16, cy, r, cy_, 2, squash=0.45)
        dot(dr, 16 + r, cy, 1, (255, 255, 255, 230))
    return im

def i_arclord_s3():  # 연쇄 번개 — Z자 도약 번개
    im, dr = canvas()
    blu = C("5c7cff")
    bolt(dr, [(6, 8), (12, 12), (9, 15), (16, 20)], C("9daaff"), 2)
    bolt(dr, [(16, 20), (22, 17), (20, 23), (26, 26)], blu, 2)
    dot(dr, 6, 8, 2, (255, 255, 255, 255)); dot(dr, 26, 26, 2, (255, 255, 255, 255))
    return im

def i_eternal_s3():  # 중력 붕괴 — 중심으로 빨려드는 점들
    im, dr = canvas()
    vio = C("b0a0ff")
    for ang in range(8):
        a = ang * math.pi / 4
        r = 11 - (ang % 3) * 2
        x, y = 16 + math.cos(a) * r, 17 + math.sin(a) * r
        dot(dr, x, y, 1.5, vio)
        ax, ay = 16 + math.cos(a) * (r - 4), 17 + math.sin(a) * (r - 4)
        dr.line([(x, y), (ax, ay)], fill=vio, width=1)
    dot(dr, 16, 17, 3, (255, 255, 255, 255))
    ring(dr, 16, 17, 13, (120, 100, 200, 200), 1)
    return im

def i_shadowlord_s3():  # 그림자 지뢰 — 가시 지뢰
    im, dr = canvas()
    pur = C("a86aff")
    dot(dr, 16, 20, 6, (40, 16, 64, 255))
    dr.ellipse([10, 14, 22, 26], outline=pur, width=2)
    for a in [0, math.pi / 3, 2 * math.pi / 3, math.pi, 4 * math.pi / 3, 5 * math.pi / 3]:
        x1, y1 = 16 + math.cos(a) * 7, 20 + math.sin(a) * 7
        x2, y2 = 16 + math.cos(a) * 11, 20 + math.sin(a) * 11
        dr.line([(x1, y1), (x2, y2)], fill=pur, width=2)
    dot(dr, 16, 20, 2, (255, 80, 80, 255))
    return im

def i_blademaster_s3():  # 파동 검기 — 검+파동
    im, dr = canvas()
    pk = C("ffaaff")
    sword(dr, 15, 14, 18, pk, -math.pi / 4, 3)
    ring(dr, 16, 20, 8, (255, 170, 255, 160), 1, squash=0.4)
    ring(dr, 16, 20, 12, (255, 170, 255, 100), 1, squash=0.4)
    return im

# ─────────────── 4차 (s4) ───────────────

def i_warbringer_s4():  # 종언의 일격 — 내려찍는 대검+충격
    im, dr = canvas()
    red = C("ff3c1c")
    sword(dr, 16, 11, 17, C("ff6a4c"), math.pi / 2, 4)
    dr.line([(6, 24), (26, 24)], fill=red, width=2)
    dr.line([(9, 27), (23, 27)], fill=C("ff7a3c"), width=1)
    for x in (6, 26):
        dr.line([(x, 24), (x + (6 if x == 6 else -6), 27)], fill=red, width=1)
    return im

def i_crusader_s4():  # 심판의 빛기둥
    im, dr = canvas()
    gold = C("ffe9a0")
    dr.polygon([(12, 4), (20, 4), (23, 28), (9, 28)], fill=(255, 233, 160, 70), outline=gold)
    dr.line([(16, 2), (16, 6)], fill=(255, 255, 255, 255), width=2)
    ring(dr, 16, 27, 5, gold, 1, squash=0.35)
    return im

def i_deadeye_s4():  # 신의 화살비 — 퍼지는 유도 화살
    im, dr = canvas()
    grn = C("3cff7a")
    for a in [-0.9, -0.45, 0, 0.45, 0.9]:
        arrow(dr, 16, 24, -math.pi / 2 + a, 13, grn)
    glowstar(dr, 16, 25, 4, (200, 255, 210, 255))
    return im

def i_skylord_s4():  # 천공의 폭풍 — 토네이도+번개
    im, dr = canvas()
    cy_ = C("ccffe8")
    for cy, r in [(25, 12), (19, 9), (13, 6), (8, 4)]:
        ring(dr, 16, cy, r, cy_, 2, squash=0.42)
    bolt(dr, [(24, 4), (21, 9), (25, 10), (22, 15)], C("9dd8ff"), 1)
    dot(dr, 16, 8, 2, (255, 255, 255, 255))
    return im

def i_arclord_s4():  # 마나 붕괴 — 수정 파열
    im, dr = canvas()
    blu = C("5c7cff")
    dr.polygon([(16, 6), (23, 16), (16, 27), (9, 16)], outline=blu, fill=(60, 80, 200, 120))
    dr.line([(16, 6), (16, 27)], fill=C("9daaff"), width=1)
    for a in range(6):
        ang = a * math.pi / 3 + 0.3
        dr.line([(16 + math.cos(ang) * 8, 16 + math.sin(ang) * 8), (16 + math.cos(ang) * 13, 16 + math.sin(ang) * 13)], fill=C("9daaff"), width=1)
    return im

def i_eternal_s4():  # 영원의 고리 — 시간 루프 링
    im, dr = canvas()
    wht = (255, 255, 255, 255)
    ring(dr, 13, 17, 7, wht, 2)
    ring(dr, 20, 17, 7, C("b0a0ff"), 2)
    dot(dr, 16, 17, 2, wht)
    return im

def i_shadowlord_s4():  # 그림자 군주 — 분신
    im, dr = canvas()
    pur = C("a86aff")
    dot(dr, 11, 13, 3, (60, 30, 90, 255)); dr.line([(11, 16), (11, 25)], fill=(60, 30, 90, 255), width=3)
    dot(dr, 21, 13, 3, pur); dr.line([(21, 16), (21, 25)], fill=pur, width=3)
    dot(dr, 16, 11, 3, (200, 160, 255, 255)); dr.line([(16, 14), (16, 23)], fill=(200, 160, 255, 255), width=3)
    return im

def i_blademaster_s4():  # 검무 — 극한 — 부채꼴 검기 3연
    im, dr = canvas()
    pk = C("ffaaff")
    for i, (x, a) in enumerate([(9, -math.pi / 3), (16, -math.pi / 2), (23, -2 * math.pi / 3)]):
        sword(dr, x, 19 - (i == 1) * 4, 15, pk if i == 1 else C("e8a0e8"), a, 2)
    dr.arc([6, 14, 26, 30], 200, 340, fill=(255, 170, 255, 130), width=1)
    return im

ICONS = {
    "warlord_s3": i_warlord_s3, "paladin_s3": i_paladin_s3, "eagleeye_s3": i_eagleeye_s3,
    "tempest_s3": i_tempest_s3, "stormbringer_s3": i_stormbringer_s3, "chronicle_s3": i_chronicle_s3,
    "nightblade_s3": i_nightblade_s3, "duelist_s3": i_duelist_s3,
    "warbringer_s3": i_warbringer_s3, "crusader_s3": i_crusader_s3, "deadeye_s3": i_deadeye_s3,
    "skylord_s3": i_skylord_s3, "arclord_s3": i_arclord_s3, "eternal_s3": i_eternal_s3,
    "shadowlord_s3": i_shadowlord_s3, "blademaster_s3": i_blademaster_s3,
    "warbringer_s4": i_warbringer_s4, "crusader_s4": i_crusader_s4, "deadeye_s4": i_deadeye_s4,
    "skylord_s4": i_skylord_s4, "arclord_s4": i_arclord_s4, "eternal_s4": i_eternal_s4,
    "shadowlord_s4": i_shadowlord_s4, "blademaster_s4": i_blademaster_s4,
}

for name, fn in ICONS.items():
    save(fn(), name)
print(f"saved {len(ICONS)} icons to {OUT}")

# 프리뷰 몽타주
cols = 8
rows = (len(ICONS) + cols - 1) // cols
prev = Image.new("RGB", (cols * 68, rows * 68), (24, 28, 40))
for i, (name, fn) in enumerate(ICONS.items()):
    im = fn().resize((64, 64), Image.NEAREST)
    prev.paste(im, ((i % cols) * 68 + 2, (i // cols) * 68 + 2), im)
prev.save("/tmp/skillicon_preview.png")
print("preview /tmp/skillicon_preview.png")
