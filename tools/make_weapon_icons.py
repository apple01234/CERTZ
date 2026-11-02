#!/usr/bin/env python3
"""vc233 (#15) — 직업별 전용 무기 아이콘 생성.

[배경]
  무기 아이콘이 `item_weapon_1~6`(검) 과 `x3_gun` 뿐이었다. 그래서
  · 마법사가 "대검"을 들고, · 궁수가 검 아이콘을, · 도적이 검을 쓰는
  것처럼 보였다(아이콘 기준). 직업 전용 무기를 늘리려면 아이콘부터 필요하다.

[방식]
  외부 이미지를 새로 받지 않고, 32×32 픽셀아트를 코드로 그린다.
  기존 item_weapon_* 와 같은 크기·같은 픽셀 밀도(32px)를 유지해
  UI 에서 섞여도 이질감이 없다.

산출: public/assets/item_wpn_{staff,dagger,bow,greatsword,cutlass}.webp
"""
from PIL import Image
import os

SIZE = 32
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets")


def new_img():
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def put(px, x, y, col):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        px[x, y] = col


def line(px, x0, y0, x1, y1, col):
    """브레젠험 정수 직선."""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        put(px, x0, y0, col)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy


# ── 색 팔레트 (픽셀아트 톤: 외곽 어둡게, 본체 중간, 하이라이트 밝게) ──
STEEL_D = (58, 64, 78, 255)
STEEL_M = (128, 138, 156, 255)
STEEL_L = (216, 226, 240, 255)
GOLD_D = (120, 84, 28, 255)
GOLD_M = (206, 158, 62, 255)
GOLD_L = (250, 220, 130, 255)
WOOD_D = (78, 48, 26, 255)
WOOD_M = (134, 88, 46, 255)
WOOD_L = (186, 132, 76, 255)
ARC_D = (36, 78, 54, 255)
ARC_M = (78, 168, 104, 255)
ARC_L = (150, 230, 160, 255)
ARCANE_D = (56, 34, 96, 255)
ARCANE_M = (124, 82, 200, 255)
ARCANE_L = (198, 166, 255, 255)
BLOOD_D = (86, 24, 34, 255)
BLOOD_M = (176, 48, 60, 255)
BLOOD_L = (240, 130, 130, 255)


def greatsword():
    """전사 — 넓은 양날 대검 + 금 십자 가드."""
    im = new_img()
    px = im.load()
    # 날 (좌상→우하 대각, 폭 3)
    for off in range(-1, 2):
        line(px, 23 + off, 3, 9 + off, 17, STEEL_M)
    line(px, 24, 4, 10, 18, STEEL_L)          # 하이라이트
    for off in (-2, 2):
        line(px, 23 + off, 4, 9 + off, 18, STEEL_D)   # 외곽
    # 날끝
    put(px, 24, 3, STEEL_L); put(px, 25, 3, STEEL_D)
    # 가드 (금, 가로)
    line(px, 6, 18, 13, 11, GOLD_M)
    line(px, 6, 19, 13, 12, GOLD_D)
    line(px, 7, 17, 13, 11, GOLD_L)
    # 손잡이
    line(px, 8, 21, 5, 24, WOOD_M)
    line(px, 9, 22, 6, 25, WOOD_D)
    # 폼멜
    put(px, 4, 25, GOLD_M); put(px, 3, 26, GOLD_D)
    return im


def staff():
    """마법사 — 나무 지팡이 + 상단 마력 구체."""
    im = new_img()
    px = im.load()
    # 자루 (대각)
    line(px, 8, 30, 20, 12, WOOD_M)
    line(px, 9, 30, 21, 12, WOOD_D)
    line(px, 8, 29, 20, 11, WOOD_L)
    # 구체 (중심 22, 9 / 반지름 5)
    cx, cy, r = 22, 9, 5
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= r * r:
                if d2 <= 4:
                    put(px, x, y, ARCANE_L)
                elif d2 <= (r - 1) ** 2:
                    put(px, x, y, ARCANE_M)
                else:
                    put(px, x, y, ARCANE_D)
    # 반짝이
    put(px, 20, 6, (255, 255, 255, 255))
    put(px, 24, 11, ARCANE_L)
    # 고정 고리 (금)
    line(px, 20, 14, 23, 14, GOLD_M)
    return im


def dagger():
    """도적 — 짧은 단검 2자루(쌍단검)."""
    im = new_img()
    px = im.load()
    # 왼쪽 단검 (좌하 방향)
    line(px, 12, 6, 6, 14, STEEL_M)
    line(px, 13, 6, 7, 14, STEEL_L)
    line(px, 11, 7, 5, 15, STEEL_D)
    line(px, 4, 16, 8, 16, GOLD_M)      # 가드
    line(px, 9, 17, 11, 21, WOOD_M)     # 손잡이
    # 오른쪽 단검 (우하 방향) — 살짝 겹침
    line(px, 22, 10, 16, 19, STEEL_M)
    line(px, 23, 10, 17, 19, STEEL_L)
    line(px, 21, 11, 15, 20, STEEL_D)
    line(px, 14, 20, 18, 20, GOLD_D)
    line(px, 19, 21, 21, 25, WOOD_D)
    # 날끝 하이라이트
    put(px, 6, 15, STEEL_L); put(px, 16, 20, STEEL_L)
    return im


def bow():
    """궁수 — 곡궁 + 시위 + 화살."""
    im = new_img()
    px = im.load()
    cx, cy, r = 11, 16, 11
    # 활 몸체 — 오른쪽으로 볼록한 반원. 반지름 r 부근 픽셀을 칠한다.
    for y in range(cy - r, cy + r + 1):
        dy = y - cy
        rem = r * r - dy * dy
        if rem < 0:
            continue
        dx = int(rem ** 0.5)
        # 두께 2px: 바깥(밝음) + 안쪽(어두움)
        put(px, cx + dx, y, ARC_L)
        if dx - 1 >= 0:
            put(px, cx + dx - 1, y, ARC_M)
        if dx - 2 >= 0:
            put(px, cx + dx - 2, y, ARC_D)
    # 시위 (세로 직선)
    line(px, cx, cy - r, cx, cy + r, (228, 236, 250, 255))
    # 화살 (가로)
    line(px, 5, cy, 26, cy, WOOD_L)
    put(px, 27, cy, STEEL_L)
    put(px, 28, cy, STEEL_D)
    put(px, 27, cy - 1, STEEL_L)
    # 깃
    put(px, 6, cy - 1, BLOOD_M); put(px, 6, cy + 1, BLOOD_M)
    put(px, 7, cy - 1, BLOOD_L); put(px, 7, cy + 1, BLOOD_D)
    # 그립
    line(px, cx - 1, cy - 2, cx - 1, cy + 2, WOOD_D)
    return im


def cutlass():
    """해적 — 넓은 곡도(커틀러스) + 금 가드 + 원목 손잡이."""
    im = new_img()
    px = im.load()
    # 곡선 날: 왼쪽 아래(자루) → 오른쪽 위(끝)로 휘어 오른다. 폭 3~4px.
    pts = []
    for t in range(0, 21):
        x = 9 + t
        y = 21 - int(t * 0.85) - (t * t) // 150
        pts.append((x, y))
    for x, y in pts:
        put(px, x, y - 1, STEEL_L)   # 상단 하이라이트
        put(px, x, y, STEEL_M)       # 본체
        put(px, x, y + 1, STEEL_M)
        put(px, x, y + 2, STEEL_D)   # 하단 외곽
    # 날끝 — 뾰족하게
    ex, ey = pts[-1]
    put(px, ex + 1, ey - 1, STEEL_L)
    put(px, ex + 1, ey, STEEL_M)
    put(px, ex + 2, ey - 2, STEEL_D)
    # 가드 (금) — 날과 손잡이 경계
    line(px, 7, 23, 12, 18, GOLD_M)
    line(px, 8, 24, 13, 19, GOLD_D)
    line(px, 7, 22, 12, 17, GOLD_L)
    # 손잡이 — 가드에서 왼쪽 아래로
    line(px, 6, 25, 2, 29, WOOD_M)
    line(px, 7, 26, 3, 30, WOOD_L)
    line(px, 6, 26, 2, 30, WOOD_D)
    # 폼멜 (금)
    put(px, 1, 30, GOLD_M); put(px, 2, 30, GOLD_D)
    return im


MAKERS = {
    "item_wpn_greatsword": greatsword,
    "item_wpn_staff": staff,
    "item_wpn_dagger": dagger,
    "item_wpn_bow": bow,
    "item_wpn_cutlass": cutlass,
}

if __name__ == "__main__":
    for name, fn in MAKERS.items():
        im = fn()
        path = os.path.join(OUT, f"{name}.webp")
        im.save(path, "WEBP", lossless=True)
        print(f"{name}.webp  {os.path.getsize(path)}B")
