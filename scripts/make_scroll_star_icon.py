#!/usr/bin/env python3
"""v3.0.7 — 강화 주문서(item_scroll_star) 아이콘 생성.
기존 scroll 아이콘과 같은 픽셀아트 감각 — 보라색 별 문양 종이 두루마리."""
from PIL import Image
import pathlib

P = pathlib.Path("/home/z/my-project/public/assets/item_scroll_star.png")
S = 32  # 32x32 픽셀아트 (다른 item_* 아이콘과 동일 규격)

# 팔레트
PAPER = (233, 228, 245)      # 연보라 종이
PAPER_DK = (186, 178, 214)   # 종이 그림자
EDGE = (90, 82, 120)         # 테두리
STAR = (210, 157, 255)       # 스타포스 보라
STAR_LT = (245, 225, 255)    # 별 하이라이트
GLOW = (255, 215, 106)       # 금빛 반짝
ROD = (120, 100, 70)         # 두루마리 축
ROD_DK = (80, 66, 46)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
px = img.load()

# 두루마리 몸통 (중앙 사각 종이)
for y in range(8, 25):
    for x in range(7, 26):
        px[x, y] = PAPER
# 종이 상/하단 말기 (어두운 라인)
for x in range(7, 26):
    px[x, 8] = PAPER_DK
    px[x, 24] = PAPER_DK
# 테두리
for x in range(6, 27):
    px[x, 7] = EDGE
    px[x, 25] = EDGE
for y in range(7, 26):
    px[6, y] = EDGE
    px[26, y] = EDGE
# 좌우 축 (두루마리 막대)
for y in range(5, 28):
    for dx in (4, 5, 26, 27):
        px[dx, y] = ROD
    px[4, 5] = px[5, 5] = ROD_DK
    px[4, 27] = px[5, 27] = ROD_DK

# 중앙 별 문양 (5각 별 러프 픽셀)
star_pts = [
    (16, 10), (17, 10),
    (15, 12), (16, 12), (17, 12), (18, 12),
    (14, 14), (15, 14), (16, 14), (17, 14), (18, 14), (19, 14),
    (13, 16), (14, 16), (15, 16), (16, 16), (17, 16), (18, 16), (19, 16), (20, 16),
    (14, 18), (18, 18),
    (13, 20), (14, 20), (15, 20), (16, 20), (17, 20), (18, 20), (19, 20), (20, 20),
]
for (x, y) in star_pts:
    px[x, y] = STAR
# 별 하이라이트
px[16, 13] = STAR_LT
px[17, 13] = STAR_LT
px[16, 15] = STAR_LT

# 금빛 반짝 점 (좌상/우하)
px[10, 11] = GLOW
px[11, 12] = GLOW
px[21, 21] = GLOW
px[22, 22] = GLOW

P.parent.mkdir(parents=True, exist_ok=True)
img.save(P)
print("saved:", P, P.stat().st_size, "bytes")
