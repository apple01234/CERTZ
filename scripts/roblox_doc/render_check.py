#!/usr/bin/env python3
"""PDF 페이지 시각 검증용 PNG 렌더"""
import sys
import pymupdf

pdf = sys.argv[1] if len(sys.argv) > 1 else "CERTZ_Roblox_이식_총지시서.pdf"
pages = sys.argv[2] if len(sys.argv) > 2 else None  # 예: 1,2,5

doc = pymupdf.open(pdf)
targets = [int(x) for x in pages.split(",")] if pages else list(range(len(doc)))
for p in targets:
    if p < 1 or p > len(doc):
        continue
    page = doc[p - 1]
    pix = page.get_pixmap(dpi=95)
    out = f"render_p{p:02d}.png"
    pix.save(out)
    print(out, pix.width, "x", pix.height)

# 폰트별 사용 페이지 확인
print("\n=== embedded fonts ===")
fonts = set()
for i in range(len(doc)):
    for f in doc[i].get_fonts():
        fonts.add(f[3])
print(sorted(fonts))
