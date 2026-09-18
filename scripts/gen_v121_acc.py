#!/usr/bin/env python3
"""v1.2.1 (#1 치장위치) — 마왕/요정 날개 아트 재생성 (40x24).

기존 26x14는 캐릭터 몸(폭 27px)보다 좁아 등 뒤에 숨어 "위치가 이상한" 것처럼 보였다.
40x24로 키우고 골격+막 구조를 넣어 실루엣 밖으로 퍼지게 그린다.
- 마왕날개: 진홍 박쥐 — 어깨 관절 → 3지 골격 → 물결 막, 밝은 멤브레인 하이라이트
- 요정날개: 하늘빛 반투명 4엽 — 내곽 광택 하이라이트 + 외곽 라인
게임에서 ×1.35 스케일로 표시(52x31) — 등에서 좌우로 확실히 벌어진다.
"""
from PIL import Image

W, H = 40, 24


def blank():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def sym(im, put):
    """좌측 절반(x<20)에 그린 것을 우측에 미러링"""
    px = im.load()
    for y in range(H):
        for x in range(20):
            c = px[x, y]
            if c[3] > 0:
                put((W - 1 - x, y), c)
    return im


def devil():
    im = blank()
    px = im.load()
    R1 = (168, 26, 44, 255)    # 바깥 막
    R2 = (214, 52, 74, 255)    # 안쪽 막(밝음)
    R3 = (255, 122, 130, 255)  # 멤브레인 하이라이트
    B = (46, 20, 26, 255)      # 골격 라인
    # 골격: 어깨(18,8)에서 3갈래 — 위(6,2) / 중(2,9) / 아래(5,18)
    import math
    def bone(x0, y0, x1, y1, col=B):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for s in range(steps + 1):
            t = s / steps
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = col

    def membrane(pts, inner, hi):
        # 볼록 껍질 근사: 다각형 래스터라이즈
        minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
        miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                # point-in-polygon (even-odd)
                inside = False
                n = len(pts)
                j = n - 1
                for i in range(n):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
                        inside = not inside
                    j = i
                if inside:
                    px[x, y] = inner
        # 하이라이트: 상단 가장자리 근처 한 줄
        for (x0, y0, x1, y1) in hi:
            steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
            for s in range(steps + 1):
                t = s / steps
                x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
                if 0 <= x < W and 0 <= y < H and px[x, y] == inner:
                    px[x, y] = R3

    # 위 막 (어깨→위 골격→바깥 끝→중간 골격)
    membrane([(18, 7), (7, 2), (2, 8), (10, 9)], R2, [(18, 7), (7, 2)])
    # 중간 막
    membrane([(18, 9), (10, 10), (1, 12), (2, 16), (11, 12)], R2, [(18, 9), (10, 10)])
    # 아래 막 (길고 뾰족)
    membrane([(18, 11), (11, 13), (4, 19), (7, 21), (14, 14)], R1, [(18, 11), (11, 13)])
    # 골격 다시 그리기 (막 위에)
    bone(19, 8, 7, 2); bone(19, 9, 2, 11); bone(19, 11, 5, 19)
    bone(18, 8, 19, 8)  # 어깨
    sym(im, lambda p, c: None) if False else sym(im, px.__setitem__ if False else (lambda p: None))
    return im


def devil_sym():
    im = blank()
    px = im.load()
    R1 = (168, 26, 44, 255)
    R2 = (214, 52, 74, 255)
    R3 = (255, 128, 138, 255)
    B = (46, 20, 26, 255)

    def bone(x0, y0, x1, y1):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for s in range(steps + 1):
            t = s / steps
            x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = B

    def membrane(pts):
        minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
        miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                inside = False
                j = len(pts) - 1
                for i in range(len(pts)):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
                        inside = not inside
                    j = i
                if inside:
                    px[x, y] = R2

    # 좌측 날개 절반 (x 3..19) — 어깨는 x19
    membrane([(19, 7), (8, 1), (3, 9), (12, 10)])
    membrane([(19, 9), (11, 11), (2, 14), (4, 18), (13, 13)])
    membrane([(19, 12), (13, 14), (6, 21), (10, 22), (16, 15)])
    bone(19, 8, 8, 1); bone(19, 9, 2, 14); bone(19, 12, 6, 21)
    # 막 하이라이트 (상단 가장자리)
    for (x0, y0, x1, y1) in [(19, 7, 8, 1), (19, 9, 11, 11), (19, 12, 13, 14)]:
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for s in range(steps + 1):
            t = s / steps
            x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
            for dx in (0, 1):
                xx, yy = x - dx, y + dx
                if 0 <= xx < W and 0 <= yy < H and px[xx, yy] == R2:
                    px[xx, yy] = R3
    # 우측 미러
    for y in range(H):
        for x in range(20):
            c = px[x, y]
            if c[3] > 0:
                px[W - 1 - x, y] = c
    # 중앙 어깨 연결 (등에 닿는 부분)
    for x in (19, 20):
        for y in range(7, 14):
            if px[x, y][3] == 0:
                px[x, y] = B
    return im


def fairy():
    im = blank()
    px = im.load()
    W1 = (168, 226, 250, 235)   # 날개 베이스 (반투명)
    W2 = (212, 244, 255, 245)   # 내곽 광택
    WL = (255, 255, 255, 255)   # 하이라이트
    OL = (120, 190, 226, 255)   # 외곽 라인

    def blob(cx, cy, rx, ry, base):
        for y in range(H):
            for x in range(W):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1.0:
                    px[x, y] = base

    # 상엽(큰) / 하엽(작은) 좌측
    blob(10, 7, 8, 6, W1)
    blob(12, 17, 6, 5, W1)
    px2 = px
    # 내곽 광택
    blob(8, 6, 4, 3, W2)
    blob(11, 18, 3, 2, W2)
    # 하이라이트 점
    px2[6, 4] = WL; px2[7, 4] = WL; px2[6, 5] = WL
    px2[10, 17] = WL
    # 외곽 라인: 베이스 가장자리 1px
    for y in range(H):
        for x in range(W):
            if px[x, y] == W1:
                edge = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and px[xx, yy][3] == 0:
                        edge = True
                if edge:
                    px[x, y] = OL
    # 우측 미러 (중심 1px 갭)
    for y in range(H):
        for x in range(19):
            c = px[x, y]
            if c[3] > 0:
                px[W - 1 - x, y] = c
    return im


im = devil_sym()
im.save("public/assets/acc_wings_devil.webp", lossless=True)
imf = fairy()
imf.save("public/assets/acc_wings_fairy.webp", lossless=True)
# 검수용 확대
im.resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_wings_devil.png")
imf.resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_wings_fairy.png")
print("wings regenerated: 40x24")
