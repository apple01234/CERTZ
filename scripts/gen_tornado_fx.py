#!/usr/bin/env python3
"""토네이도 스프라이트 시트 생성 — fx_tornado.png (8프레임 64x64)
스카이로드 토네이도 스킬(폭풍 소용돌이/천공의 폭풍) 전용 비주얼.
살짝 기울인 시점의 회오리 기둥: 하단이 넓고 상단이 좁은 wind ring 4단 +
나선 wind streak + 회전하는 파편 점. ADD 블렌드로 발광.

프레임마다 링 위상이 회전해서 재생 시 진짜 빙글빙글 도는 회오리가 된다.
"""
from PIL import Image, ImageDraw
import math

FRAMES = 8
CELL = 64
# 링 4단: (cy, rx, ry, alpha) — 하단(넓음) → 상단(좁음)
RINGS = [
    (46, 26, 10, 150),
    (36, 21, 8, 170),
    (26, 16, 6.5, 190),
    (17, 11, 5, 210),
]
CORE_TOP, CORE_BOT = 14, 48  # 중심 기둥 x 드리프트 범위(위로 갈수록 좁아 보이는 흔들림)

OUT = "/home/z/my-project/CERTZ/public/assets/fx_tornado.png"

def lerp(a, b, t):
    return a + (b - a) * t

def draw_ring(dr, cx, cy, rx, ry, phase, alpha, tint):
    """타원 링을 호(arc) 6개로 — 위상만큼 회전해 회전감 부여"""
    segs = 6
    for s in range(segs):
        a0 = phase + (s / segs) * math.tau
        a1 = a0 + (math.tau / segs) * 0.62  # 끊긴 호 — 바람 띠 느낌
        bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
        dr.arc(bbox, math.degrees(a0), math.degrees(a1), fill=tint + (alpha,), width=2)

def draw_streak(dr, cx, cy, rx, ry, phase, alpha, tint):
    """링 밖으로 휘날리는 바람 꼬리 3개"""
    for k in range(3):
        a = phase * 1.0 + k * (math.tau / 3)
        # 외곽으로 갈수록 위로 말리는 나선
        pts = []
        for t in range(6):
            r = 1.0 + t * 0.22
            ang = a + t * 0.5
            x = cx + math.cos(ang) * rx * r
            y = cy + math.sin(ang) * ry * r * 0.8 - t * 1.6
            pts.append((x, y))
        dr.line(pts, fill=tint + (alpha,), width=1)

def make_frame(fi):
    phase = (fi / FRAMES) * math.tau
    im = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    cx = CELL / 2

    # 하단 먼지 베이스 (옅은 원)
    dr.ellipse([cx - 27, 42, cx + 27, 56], fill=(200, 240, 255, 26))

    tint_main = (224, 255, 255)   # 하늘색 화이트
    tint_deep = (150, 220, 255)   # 딥 스카이

    # 링 4단 — 아래일수록 진하고 넓게
    for i, (cy, rx, ry, alpha) in enumerate(RINGS):
        sway = math.sin(phase * 2 + i * 0.9) * (1.5 - i * 0.3)
        draw_ring(dr, cx + sway, cy, rx, ry, phase * (1 + i * 0.08), alpha,
                  tint_main if i % 2 == 0 else tint_deep)
        draw_streak(dr, cx + sway, cy, rx, ry, phase * (1 + i * 0.08),
                    alpha - 60, tint_deep)

    # 중심 기둥 (코어) — 위아래로 잇는 옅은 세로 광선
    top_x = cx + math.sin(phase * 2) * 1.2
    dr.line([(cx, CORE_BOT), (top_x, CORE_TOP)], fill=tint_main + (120,), width=3)
    dr.line([(cx - 2, CORE_BOT - 4), (top_x - 1, CORE_TOP + 2)], fill=tint_deep + (70,), width=1)

    # 회전 파편 (잎/먼지) — 링 사이를 도는 점 5개
    for k in range(5):
        ring = RINGS[k % len(RINGS)]
        ang = phase * 1.35 + k * (math.tau / 5)
        px = cx + math.cos(ang) * ring[1] * 1.08
        py = ring[0] + math.sin(ang) * ring[2] * 1.1
        r = 1 if k % 2 == 0 else 2
        dr.ellipse([px - r, py - r, px + r, py + r], fill=(255, 255, 255, 220))

    return im

sheet = Image.new("RGBA", (CELL * FRAMES, CELL), (0, 0, 0, 0))
for f in range(FRAMES):
    sheet.paste(make_frame(f), (f * CELL, 0))
sheet.save(OUT)
print("saved", OUT, sheet.size)
