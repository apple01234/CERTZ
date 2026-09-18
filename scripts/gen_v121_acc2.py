#!/usr/bin/env python3
"""v1.2.1 (#1) — 마왕 날개 리드로우: 박쥐 스캘롭(오목한 막 가장자리) 구조."""
from PIL import Image

W, H = 40, 24


def build():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    R_IN = (178, 30, 50, 255)     # 막 베이스
    R_HI = (232, 74, 96, 255)     # 막 밝은 부분 (위쪽)
    R_TIP = (255, 130, 140, 255)  # 골 끝 하이라이트
    BONE = (44, 20, 28, 255)      # 골격

    # 좌측 날개 폴리곤 (시계방향: 어깨 위 → 손가락 끝 순회(스캘럽 오목) → 어깨 아래 내연)
    poly = [
        (19, 6), (7, 1), (6, 4), (2, 8), (5, 10), (3, 17), (6, 18), (7, 22), (19, 13),
    ]
    tips = [(7, 1), (2, 8), (3, 17), (7, 22)]
    scallops = [(6, 4), (5, 10), (6, 18)]

    def inside(x, y):
        c = False
        n = len(poly)
        j = n - 1
        for i in range(n):
            xi, yi = poly[i]; xj, yj = poly[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
                c = not c
            j = i
        return c

    for y in range(H):
        for x in range(20):
            if inside(x, y):
                # 위쪽 2행은 밝은 막
                above = inside(x, y - 1) if y > 0 else False
                px[x, y] = R_HI if not above and y < 14 else R_IN

    # 골격: 어깨(18,9)에서 각 끝으로
    def bone(x0, y0, x1, y1):
        steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for s in range(steps + 1):
            t = s / steps
            x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = BONE

    for (tx, ty) in tips:
        bone(18, 8, tx, ty)
    # 골 끝 하이라이트
    for (tx, ty) in tips:
        if px[tx, ty] == BONE:
            px[tx, ty] = R_TIP
    # 어깨 절반 미러 → 우측 (중심 x19/20)
    for y in range(H):
        for x in range(20):
            c = px[x, y]
            if c[3] > 0:
                px[W - 1 - x, y] = c
    # 중앙 몸 연결
    for x in (19, 20):
        for y in range(6, 14):
            if px[x, y][3] == 0:
                px[x, y] = BONE
    return im


im = build()
im.save("public/assets/acc_wings_devil.webp", lossless=True)
im.resize((W * 8, H * 8), Image.NEAREST).save("scripts/preview_wings_devil.png")

# 합성 미리보기: 캐릭터 등에 붙였을 때 (앵커 적용 ×1.35)
ch = Image.open("public/assets/chf0_idle0.webp").convert("RGBA")
comp = Image.new("RGBA", (96, 64), (34, 34, 44, 255))
ws = im.resize((int(40 * 1.35), int(24 * 1.35)), Image.NEAREST)
# 등 중심: 프레임 (48, 24) → 날개 center
comp.alpha_composite(ws, (48 - ws.width // 2, 24 - ws.height // 2))
comp.alpha_composite(ch, (0, 0))
comp.resize((96 * 6, 64 * 6), Image.NEAREST).save("scripts/preview_wings_onchar.png")
print("devil wings redrawn")
