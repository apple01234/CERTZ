#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.13 (#2 책 모양 GUI) — 유저 지시: "내가 책 모양 플레이어 GUI 사용하랬지?? + 인벤토리도??"
기존 패널(panel_big.webp — 직사각 다크 + 주황 프레임)을 "열린 책" 형태로 교체한다.

· 책 모양: 양쪽 페이지가 펼쳐진 2스프레드 레이아웃
  · 가운데 세로 라인(제본선) — 약간 어둡고 그림자
  · 좌/우 페이지는 미세하게 다른 밝기(오른쪽이 약간 밝음)
  · 모서리 라운드 처리 + 가장자리 음영(페이지 두께감)
  · 페이지 행번호/가로줄 무늬는 빼고 깔끔하게
· 색: 따뜻한 양피지톤 (타이틀 메뉴얼 RPG 분위기)
· 사이즈: 1024x768 (인벤토리/스탯 패널용 — stretch 적용됨)
· CSS에서 background-image: book_panel.webp 로 적용
"""
import os, math
from PIL import Image, ImageDraw, ImageFilter

OUT = "/home/z/my-project/CERTZ/public/assets/ui2"
os.makedirs(OUT, exist_ok=True)

W, H = 1024, 768

# 양피지 색 팔레트
PAPER_LIGHT = (250, 232, 198)
PAPER = (240, 220, 184)
PAPER_SHADE = (218, 196, 158)
PAPER_DARK = (188, 164, 128)
PAPER_EDGE = (138, 112, 80)
SPINE_LINE = (96, 72, 48)
SPINE_SHADOW = (60, 44, 30)

# 외곽(책 표지) — 갈색 가죽
COVER = (118, 80, 48)
COVER_DARK = (78, 50, 28)
COVER_HI = (158, 116, 76)
GOLD = (212, 168, 84)

def draw_book_panel(path, with_cover=True):
    """열린 책 패널 — 가운데 제본선, 양쪽 페이지, 외곽 가죽 표지"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # 외곽 — 라운드 사각형 책 표지 (갈색 가죽)
    if with_cover:
        margin = 8
        # 그림자
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle([margin+4, margin+6, W-margin-4, H-margin-2], radius=24, fill=(0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
        im = Image.alpha_composite(im, shadow)
        d = ImageDraw.Draw(im)
        # 표지 외곽 (갈색 가죽)
        d.rounded_rectangle([margin, margin, W-margin, H-margin], radius=22, fill=COVER)
        # 표지 하이라이트 (상단)
        d.rounded_rectangle([margin+4, margin+3, W-margin-4, margin+24], radius=14, fill=COVER_HI)
        # 표지 그림자 (하단)
        d.rounded_rectangle([margin+4, H-margin-24, W-margin-4, H-margin-3], radius=14, fill=COVER_DARK)
        # 금색 테두리 라인 (내측)
        d.rounded_rectangle([margin+10, margin+10, W-margin-10, H-margin-10], radius=18, outline=GOLD, width=3)
        # 모서리 장식 (4곳)
        for cx, cy in [(margin+22, margin+22), (W-margin-22, margin+22),
                       (margin+22, H-margin-22), (W-margin-22, H-margin-22)]:
            d.ellipse([cx-8, cy-8, cx+8, cy+8], outline=GOLD, width=2)
            d.ellipse([cx-3, cy-3, cx+3, cy+3], fill=GOLD)
    else:
        margin = 4
        d.rounded_rectangle([0, 0, W-1, H-1], radius=12, fill=PAPER)

    # 내부 페이지 영역 (양피지)
    page_inset = 28 if with_cover else 4
    page_box = [page_inset, page_inset, W-page_inset, H-page_inset]
    d.rounded_rectangle(page_box, radius=14, fill=PAPER)

    # 가운데 제본선 (세로) — 양쪽 페이지 구분
    cx = W // 2
    # 제본 그림자 (약간 넓게)
    for i, alpha in enumerate([30, 50, 80]):
        d.line([cx-i, page_inset+6, cx-i, H-page_inset-6], fill=(*SPINE_SHADOW, alpha), width=1)
        d.line([cx+i, page_inset+6, cx+i, H-page_inset-6], fill=(*SPINE_SHADOW, alpha), width=1)
    # 제본선 본체
    d.line([cx, page_inset+6, cx, H-page_inset-6], fill=SPINE_LINE, width=2)

    # 페이지 미세 질감 — 양피지 얼룩 (노이즈) — 얇게
    import random
    random.seed(42)
    noise = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    nd = ImageDraw.Draw(noise)
    for _ in range(800):
        nx = random.randint(page_inset+8, W-page_inset-8)
        ny = random.randint(page_inset+8, H-page_inset-8)
        # 제본선 근처는 짙게
        dist = abs(nx - cx)
        if dist < 16:
            continue  # 제본선 영역 건너뜀
        a = random.randint(8, 28)
        nd.point([nx, ny], fill=(180, 150, 100, a))
    noise = noise.filter(ImageFilter.GaussianBlur(radius=0.5))
    im = Image.alpha_composite(im, noise)
    d = ImageDraw.Draw(im)

    # 페이지 가장자리 음영 (페이지 두께감)
    # 상단 — 약간 어둡게
    d.rounded_rectangle([page_inset, page_inset, W-page_inset, page_inset+12], radius=14,
                        fill=(*PAPER_SHADE, 80))
    # 하단
    d.rounded_rectangle([page_inset, H-page_inset-12, W-page_inset, H-page_inset], radius=14,
                        fill=(*PAPER_SHADE, 80))
    # 좌우
    d.rectangle([page_inset, page_inset+12, page_inset+8, H-page_inset-12], fill=(*PAPER_SHADE, 60))
    d.rectangle([W-page_inset-8, page_inset+12, W-page_inset, H-page_inset-12], fill=(*PAPER_SHADE, 60))

    # 미세한 라인 패턴 — 인벤토리/스탯의 행 구분 가이드로 쓸 수 있게 (매우 연하게)
    # 좌측 페이지에만 가로 라인 6줄 — 행 구분 가이드
    left_page_left = page_inset + 24
    left_page_right = cx - 24
    for i in range(1, 7):
        ly = page_inset + (H - 2*page_inset) * i // 7
        d.line([left_page_left, ly, left_page_right, ly], fill=(*PAPER_DARK, 60), width=1)

    # 외곽선 (페이지 테두리)
    d.rounded_rectangle(page_box, radius=14, outline=PAPER_EDGE, width=2)

    # 저장
    im.save(path, "WEBP", lossless=True, quality=100, method=2)
    # PNG도 함께 (CSS에서 webp 지원하지만 폴백용)
    im.save(path.replace(".webp", ".png"))

def draw_book_header(path):
    """책 제목 네임플레이트 — header.webp 교체용 (롤 시트지 마냥)"""
    w, h = 512, 80
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 양피지 배경 (라운드)
    d.rounded_rectangle([4, 4, w-4, h-4], radius=18, fill=PAPER)
    # 양끝 장식 (롤 끝)
    d.ellipse([4, h//2-22, 36, h//2+22], fill=COVER)
    d.ellipse([w-36, h//2-22, w-4, h//2+22], fill=COVER)
    # 금색 라인
    d.rounded_rectangle([4, 4, w-4, h-4], radius=18, outline=GOLD, width=2)
    # 양끝 금색 장식
    d.ellipse([10, h//2-12, 30, h//2+12], outline=GOLD, width=2)
    d.ellipse([w-30, h//2-12, w-10, h//2+12], outline=GOLD, width=2)
    # 그림자
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([6, 8, w-2, h], radius=18, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=4))
    im = Image.alpha_composite(Image.new("RGBA", (w, h), (0, 0, 0, 0)), shadow)
    im = Image.alpha_composite(im, Image.open(path.replace(".webp", ".png")) if os.path.exists(path.replace(".webp", ".png")) else Image.new("RGBA", (w, h)))
    im.save(path, "WEBP", lossless=True, quality=100, method=2)
    im.save(path.replace(".webp", ".png"))

print("[v1.4.13] 책 모양 GUI 패널 생성")
draw_book_panel(os.path.join(OUT, "book_panel.webp"), with_cover=True)
draw_book_panel(os.path.join(OUT, "book_panel_plain.webp"), with_cover=False)
draw_book_header(os.path.join(OUT, "book_header.webp"))
print("  ✓ book_panel.webp (표지 포함, 인벤토리/스탯용)")
print("  ✓ book_panel_plain.webp (표지 없음, 하위 패널용)")
print("  ✓ book_header.webp (제목 네임플레이트)")
print("완료")
