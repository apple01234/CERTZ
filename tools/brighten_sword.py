#!/usr/bin/env python3
"""전사 검(x3_sword) 대비 보정 (v1.4.41 — #6).

검수 결과 평균 RGB (42,44,58)로 배경과 대비가 낮아 "흐릿하다"는 판정을 받았다.
형태는 유지하고 밝기·대비만 올려 실루엣이 읽히게 한다.
"""
import sys
import numpy as np
from PIL import Image

PATH = "public/assets/x3_sword.webp"

im = Image.open(PATH).convert("RGBA")
a = np.array(im).astype(np.float32)
mask = a[:, :, 3] > 16

rgb = a[:, :, :3]
rgb[mask] = np.clip(rgb[mask] * 1.75 + 34, 0, 255)
a[:, :, :3] = rgb

# 외곽 1px 하이라이트 — 4방향 인접 투명 픽셀 경계를 밝게
edge = np.zeros_like(mask)
for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
    shifted = np.roll(np.roll(mask, dy, 0), dx, 1)
    edge |= mask & ~shifted
a[edge] = (245, 248, 255, 255)

out = Image.fromarray(a.astype(np.uint8), "RGBA")
out.save(PATH, "WEBP", quality=95, method=6)

px = [q for q in out.getdata() if q[3] > 16]
avg = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
print(f"저장 {PATH} {out.size} 평균RGB {avg} 픽셀 {len(px)} 엣지 {int(edge.sum())}")
sys.exit(0)
