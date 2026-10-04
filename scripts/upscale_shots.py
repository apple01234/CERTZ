#!/usr/bin/env python3
"""Play 스크린샷 최소 픽셀 보정 — 720→1080(1.5x), 675→1080(1.6x) Lanczos 업스케일.
   레이아웃은 CSS 뷰포트(720)로 캡처(모바일 UI 유지)하고, 픽셀만 Play 요구(1080px+)로 확대."""
from PIL import Image
import os

ROOT = "/home/z/my-project/download/Capture"

JOBS = [
    ("01_휴대전화_1080x1920", (1080, 1920)),
    ("02_태블릿7인치_1080x1920", (1080, 1920)),
    ("03_태블릿10인치_1080x1920", (1080, 1920)),
]

PICKS = [
    ("01_휴대전화_1080x1920/01_타이틀화면.png", "선별1_타이틀화면.png"),
    ("01_휴대전화_1080x1920/03_시작마을.png", "선별2_시작마을.png"),
    ("01_휴대전화_1080x1920/08_스킬전투.png", "선별3_스킬전투.png"),
    ("01_휴대전화_1080x1920/10_보스조우.png", "선별4_보스조우.png"),
]

for d, want in JOBS:
    p = os.path.join(ROOT, d)
    for f in sorted(os.listdir(p)):
        fp = os.path.join(p, f)
        img = Image.open(fp)
        if img.size == want:
            continue
        out = img.resize(want, Image.LANCZOS)
        out.save(fp, optimize=True)
        print(f"↑ {d}/{f}: {img.size} → {want}")

# 선별용 4장 — 업스케일된 폰 컷으로 갱신
for src, dst in PICKS:
    sp = os.path.join(ROOT, src)
    dp = os.path.join(ROOT, "00_선별용_4장", dst)
    if os.path.exists(sp):
        Image.open(sp).save(dp, optimize=True)
        print(f"★ 선별 갱신 {dst}")

print("보정 완료")
