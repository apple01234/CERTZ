"""vc252 — 바닥 텍스처 품질 통계 (검증용).

회색 노이즈 판정과 돌 구조 품질을 수치로 낸다.
- grayRatio    : 순수 회색조(R==G==B) 픽셀 비율. 1.0 이면 완전 무채색 = 노이즈.
- neighborDiff : 이웃 픽셀 평균 차이. 너무 높으면 돌이 조각조각 튀고, 아주 낮으면 밋밋하다.
- avgSat       : 팔레트 평균 채도. 0 이면 색조가 전혀 없다.
"""
from PIL import Image
from collections import Counter
import json
import statistics
import sys

NAMES = sys.argv[1:] or ["ground_slate", "ground_ash", "ground_violet"]
res = {}
for n in NAMES:
    im = Image.open(f"public/assets/ground/{n}.png").convert("RGB")
    data = list(im.getdata())
    w, h = im.size
    c = Counter(data)
    gray = sum(v for p, v in c.items() if p[0] == p[1] == p[2])
    diff = sum(
        abs(data[i][0] - data[i - 1][0]) + abs(data[i][1] - data[i - 1][1]) + abs(data[i][2] - data[i - 1][2])
        for i in range(1, len(data)) if i % w
    )
    avg = diff / (3 * (len(data) - h))
    sats = []
    for p in list(c)[:5]:
        mx, mn = max(p), min(p)
        sats.append((mx - mn) / max(1, mx))
    res[n] = {
        "size": [w, h],
        "colors": len(c),
        "grayRatio": round(gray / len(data), 4),
        "neighborDiff": round(avg, 2),
        "avgSat": round(statistics.mean(sats), 3),
    }
print(json.dumps(res, ensure_ascii=False))
