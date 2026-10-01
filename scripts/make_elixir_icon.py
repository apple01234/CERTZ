#!/usr/bin/env python3
"""v3.0.25 (#엘릭서 보라) — item_potion_elixir.png 를 선명한 보라 물약으로 재생성.
HP 물약(item_potion_hp.png)과 같은 픽셀아트 스타일을 유지하기 위해
빨강 계열 픽셀을 보라 램프로 매핑(휴 시프트)한다. 나머지(유리·코르크·외곽선)는 유지."""
from PIL import Image
import os

SRC = "/home/z/my-project/public/assets/item_potion_hp.png"
DST = "/home/z/my-project/public/assets/item_potion_elixir.png"

im = Image.open(SRC).convert("RGBA")
px = im.load()
w, h = im.size

# 보라 램프 (밝을수록 밝은 보라)
LILAC = [
    (26, 6, 48),    # 가장 어두운 외곽 보라
    (74, 20, 120),
    (126, 34, 196),
    (168, 62, 236),
    (200, 110, 250),
    (232, 178, 255), # 하이라이트
]

changed = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        # 빨강 계열 판정: r이 우세하고 g/b는 낮음 (유리 흰색·외곽선 검정은 제외)
        is_red = r >= 18 and r > g * 1.2 and r > b * 1.2
        if is_red:
            lum = (r + g + b) / 3
            # 어두운 빨강 → 어두운 보라, 밝은 빨강 → 밝은 보라
            t = min(1.0, max(0.0, (lum - 20) / 180))
            idx = min(len(LILAC) - 1, int(t * (len(LILAC) - 1) + 0.5))
            nr, ng, nb = LILAC[idx]
            px[x, y] = (nr, ng, nb, a)
            changed += 1

im.save(DST)
print(f"OK — {changed} 픽셀 보라 전환, 저장: {DST}")

# 결과 팔레트 확인
from collections import Counter
im2 = Image.open(DST).convert("RGBA")
c = Counter(p for p in im2.getdata() if p[3] > 60)
print("주요 색상:", [f"({r},{g},{b})x{n}" for (r, g, b, a), n in c.most_common(5)])
