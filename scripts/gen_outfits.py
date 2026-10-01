#!/usr/bin/env python3
# v1.0.7 — SPUM식 코스튬 프레임 변환기 + 포니테일 헤어 스프라이트 생성
#  - hero_* 28프레임을 의상 픽셀만 재색상화(hue shift)해 4종 코스튬 프레임 세트 생성
#    (피부/머리카락/외곽선 보호 — 의상·방어구 픽셀만 변환)
#  - 포니테일 1장(96x64, hero 캔버스 정렬 — 머리 뒤에서 흘러내리는 곱슬 꼬리)
# 출력: public/assets/outfit_{royal,shadow,spring,navy}_<frame>.webp · hair_ponytail.webp
#       scripts/outfit_preview.png (검수용 컨택트시트)
import colorsys
import os
from PIL import Image

ASSETS = "/home/z/my-project/public/assets"
FRAMES = []
for base, n in [("hero_idle", 4), ("hero_walk", 4), ("hero_walkside", 4), ("hero_walkup", 4),
                ("hero_atk", 4), ("hero_atkdown", 4), ("hero_atkup", 4)]:
    for i in range(n):
        FRAMES.append(f"{base}{i}")

# 의상 픽셀 판정: 피부(15~45° 밝은 저채도)·머리카락(15~40° 어두운 갈색)·외곽선(l<0.10) 제외
def is_cloth(r, g, b, a):
    if a <= 10:
        return False
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360
    if l < 0.10:            # 외곽선 검정 유지
        return False
    if 15 <= hue <= 45 and l > 0.33 and s < 0.52:   # 피부 보호
        return False
    if 12 <= hue <= 45 and l <= 0.35:               # 머리카락(어두운 갈색) 보호
        return False
    return True

# hue 이동 + 명도/채도 보정 ( cloth 픽셀만 )
OUTFITS = {
    "royal":   dict(dh=+190 / 360.0, dl=+0.04, ds=+0.10),  # 왕실 황금 갑옷 (청록→골드)
    "shadow":  dict(dh=+60 / 360.0,  dl=-0.10, ds=+0.05),  # 암살자의 그림자의상 (→보라)
    "spring":  dict(dh=+115 / 360.0, dl=+0.08, ds=-0.05),  # 봄맞이 의상 (→핑크)
    "navy":    dict(dh=-25 / 360.0,  dl=-0.04, ds=+0.08),  # 해군 제복 (딥 네이비/틸)
}

def transform(im, dh, dl, ds):
    im = im.convert("RGBA")
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if not is_cloth(r, g, b, a):
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            h = (h + dh) % 1.0
            l = min(1.0, max(0.0, l + dl))
            s = min(1.0, max(0.0, s + ds))
            nr, ng, nb = colorsys.hls_to_rgb(h, l, s)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return im

# 포니테일 — 96x64 캔버스, 머리 뒤 (44,19) 앵커에서 S자로 흘러내림
def draw_ponytail():
    im = Image.new("RGBA", (96, 64), (0, 0, 0, 0))
    px = im.load()
    base = (87, 58, 35, 255)     # #573a23 hero 머리카락 베이스
    dark = (64, 39, 23, 255)     # #402717 그늘
    hi = (122, 88, 54, 255)      # 하이라이트
    out = (20, 12, 8, 255)       # 외곽선

    def P(x, y, c):
        if 0 <= x < 96 and 0 <= y < 64:
            px[x, y] = c

    import math
    # 꼬리 중심선: (44,19)에서 좌후방으로 살짝 빠졌다 하단에서 안쪽 S커브
    pts = []
    for t in range(27):
        tt = t / 26.0
        cx = 43 - 7 * math.sin(tt * math.pi * 0.9) + 5 * tt
        cy = 19 + t * 0.95
        pts.append((cx, cy))
    # 두께 4→1 테이퍼
    for i, (cx, cy) in enumerate(pts):
        w = max(1, round(4.0 * (1.0 - i / len(pts)) + 1))
        for dx in range(-w, w + 1):
            for dy in range(-1, 2):
                x, y = int(cx + dx), int(cy + dy)
                c = base
                if dx == -w or i % 7 == 3:
                    c = dark
                elif dx == w - 1 and i % 5 == 1:
                    c = hi
                edge = abs(dx) == w
                P(x, y, out if edge else c)
    # 묶음 리본 (머리 근처 1px 포인트)
    for dx in range(-3, 4):
        P(44 + dx, 21, (200, 60, 70, 255) if abs(dx) < 3 else out)
    return im

def main():
    os.makedirs(ASSETS, exist_ok=True)
    for style, cfg in OUTFITS.items():
        for fr in FRAMES:
            src = os.path.join(ASSETS, f"{fr}.webp")
            im = Image.open(src)
            out = transform(im, cfg["dh"], cfg["dl"], cfg["ds"])
            out.save(os.path.join(ASSETS, f"outfit_{style}_{fr.replace('hero_', '')}.webp"), "WEBP", lossless=True)
    tail = draw_ponytail()
    tail.save(os.path.join(ASSETS, "hair_ponytail.webp"), "WEBP", lossless=True)

    # 검수용 프리뷰 (원본 + 4코스튬 + 포니테일, 4배 확대)
    scale = 4
    cols = len(OUTFITS) + 2
    sheet = Image.new("RGBA", (96 * scale * cols + 8 * (cols + 1), 96 * scale + 16), (24, 26, 38, 255))
    sheet.paste(Image.open(os.path.join(ASSETS, "hero_idle0.webp")).convert("RGBA").resize((96 * scale, 64 * scale), Image.NEAREST), (8, 8))
    for i, style in enumerate(OUTFITS):
        im = Image.open(os.path.join(ASSETS, f"outfit_{style}_idle0.webp")).resize((96 * scale, 64 * scale), Image.NEAREST)
        sheet.paste(im, (8 + (i + 1) * (96 * scale + 8), 8))
    tail_big = tail.crop((30, 12, 66, 56)).resize((36 * scale * 2, 44 * scale * 2), Image.NEAREST)
    sheet.paste(tail_big, (8 + (cols - 1) * (96 * scale + 8) + 30, 8))
    sheet.save("/home/z/my-project/scripts/outfit_preview.png")
    total = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in os.listdir(ASSETS) if f.startswith(("outfit_", "hair_ponytail")))
    print(f"OK — frames={len(FRAMES) * len(OUTFITS)} + ponytail 1, total {total / 1024:.0f}KB")

if __name__ == "__main__":
    main()
