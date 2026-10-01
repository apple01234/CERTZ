#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SERTZ 앱 아이콘 생성기 (v4.6.0 — 게임 출시 준비)
- 픽셀아트 감성의 스타포스(4점 별) 엠블럼: 심연 남색 배경 + 호박금 별 + 스파클
- 산출물:
  * android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png       (레거시 라운드사각)
  * android/app/src/main/res/mipmap-*/ic_launcher_round.png                                (원형)
  * android/app/src/main/res/mipmap-*/ic_launcher_foreground.png                           (적응형 전경 — 66% 세이프존)
  * download/SERTZ_icon_512.png                                                            (플레이 스토어 등록용 512px)
"""
from PIL import Image, ImageDraw
import os

RES = "/home/z/my-project/android/app/src/main/res"
OUT = "/home/z/my-project/download"
os.makedirs(OUT, exist_ok=True)

# ---------------- 팔레트 (게임 심연/스타포스 아이덴티티) ----------------
BG_TOP = (13, 19, 38)       # #0D1326 심연 남색
BG_BOT = (4, 6, 13)         # #04060D
GLOW = (252, 206, 77)       # #FCCE4D 스타포스 골드
STAR_OUT = (252, 206, 77)
STAR_CORE = (255, 243, 196) # 밝은 심부
STAR_EDGE = (176, 132, 32)  # 테두리 골드
SPARK = (168, 236, 255)     # #A8ECFF 시안 스파클 (에메랄드 재화 연상)
BORDER = (30, 42, 74)       # #1E2A4A 프레임

GRID = 64   # 논리 픽셀 그리드
SCALE = 8   # 64 → 512


def px(v: int) -> int:
    return v * SCALE


def make_canvas() -> Image.Image:
    """512 마스터 캔버스 + 그라디언트 배경 + 비네트"""
    im = Image.new("RGB", (GRID * SCALE, GRID * SCALE), BG_BOT)
    d = ImageDraw.Draw(im)
    for y in range(GRID):
        t = y / (GRID - 1)
        c = tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOT))
        d.rectangle([0, px(y), GRID * SCALE - 1, px(y) + SCALE - 1], fill=c)
    # 중앙 방사형 글로우 (별 뒤 은은한 빛)
    glow = Image.new("L", im.size, 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([px(8), px(4), px(56), px(52)], fill=46)
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(38))
    im.paste(Image.new("RGB", im.size, GLOW), (0, 0), glow)
    return im


def draw_star4(d: ImageDraw.Draw, cx: float, cy: float, r: float, core: bool = False) -> None:
    """4점 별(콘케이브 다이아몬드) — 스타포스 심볼. 픽셀 감성으로 계단형 라인"""
    pts = [(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy), (cx + r * 0.28, cy + r * 0.28),
           (cx, cy + r), (cx - r * 0.28, cy + r * 0.28), (cx - r, cy), (cx - r * 0.28, cy - r * 0.28)]
    col = STAR_CORE if core else STAR_OUT
    d.polygon([(px(x), px(y)) for x, y in pts], fill=col)


def draw_sparkle(d: ImageDraw.Draw, cx: float, cy: float, r: float) -> None:
    """십자 스파클 — 작은 별"""
    d.polygon([(px(cx), px(cy - r)), (px(cx + r * 0.22), px(cy - r * 0.22)), (px(cx + r), px(cy)),
               (px(cx + r * 0.22), px(cy + r * 0.22)), (px(cx), px(cy + r)), (px(cx - r * 0.22), px(cy + r * 0.22)),
               (px(cx - r), px(cy)), (px(cx - r * 0.22), px(cy - r * 0.22))], fill=SPARK)


def draw_pixel_dots(d: ImageDraw.Draw) -> None:
    """배경 별밤 픽셀 점 — 픽셀아트 게임 정체성"""
    rng = [(6, 14), (10, 40), (16, 8), (50, 12), (54, 30), (48, 50), (12, 55), (58, 55), (22, 47), (44, 8)]
    for x, y in rng:
        c = (90, 110, 160) if (x + y) % 2 else (70, 88, 130)
        d.rectangle([px(x), px(y), px(x) + SCALE - 1, px(y) + SCALE - 1], fill=c)


def emblem(master_size: int, inset_scale: float = 1.0) -> Image.Image:
    """스타포스 엠블럼 (배경 포함). inset_scale < 1 이면 엠블럼을 중앙으로 축소 (적응형 전경용)"""
    im = make_canvas().convert("RGBA")
    d = ImageDraw.Draw(im)
    draw_pixel_dots(d)
    cx, cy = GRID / 2, GRID / 2 + 1.5
    r = 21 * inset_scale
    # 외곽 링
    d.ellipse([px(cx - r - 3.4), px(cy - r - 3.4), px(cx + r + 3.4), px(cy + r + 3.4)],
              outline=BORDER, width=SCALE)
    # 별 (외곽 + 심부)
    draw_star4(d, cx, cy, r)
    draw_star4(d, cx, cy, r * 0.52, core=True)
    # 스파클 2개
    draw_sparkle(d, 13 * inset_scale + GRID / 2 * (1 - inset_scale) + 6.5 * (1 - inset_scale) * 0,
                 cy - r * 0.95, 3.2 * inset_scale)
    draw_sparkle(d, GRID - 12 * inset_scale - GRID / 2 * (1 - inset_scale),
                 cy + r * 0.9, 2.6 * inset_scale)
    return im


def rounded(im: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    """레거시 런처 아이콘 — 라운드드 사각 마스크"""
    s = im.size[0]
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    # 얇은 프레임 라인
    d = ImageDraw.Draw(out)
    b = int(s * 0.045)
    d.rounded_rectangle([b, b, s - 1 - b, s - 1 - b], radius=int(s * radius_ratio * 0.82),
                        outline=GLOW + (90,), width=max(2, s // 128))
    return out


def circle(im: Image.Image) -> Image.Image:
    s = im.size[0]
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def transparent_fg(inset_scale: float = 0.60) -> Image.Image:
    """적응형 아이콘 전경 — 투명 배경 + 중앙 60% 엠블럼(세이프존 66% 내부)"""
    s = GRID * SCALE
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    # 엠블럼만 다시 그림 (배경 없이)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = GRID / 2, GRID / 2 + 1.5
    r = 21 * inset_scale
    d.ellipse([px(cx - r - 3.4), px(cy - r - 3.4), px(cx + r + 3.4), px(cy + r + 3.4)],
              outline=BORDER + (255,), width=SCALE)
    draw_star4(d, cx, cy, r)
    draw_star4(d, cx, cy, r * 0.52, core=True)
    draw_sparkle(d, 13, cy - r * 0.95, 3.2)
    draw_sparkle(d, GRID - 13, cy + r * 0.9, 2.6)
    # 그림자 글로우 (전경 뒤 은은하게 — 알파만)
    glow = Image.new("L", (s, s), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([px(cx - r * 1.5), px(cy - r * 1.5), px(cx + r * 1.5), px(cy + r * 1.5)], fill=60)
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(40))
    im.paste(Image.new("RGBA", (s, s), GLOW + (255,)), (0, 0), glow)
    im.alpha_composite(layer)
    return im


def main() -> None:
    master = emblem(512)
    dpi = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dpi_name, size in dpi.items():
        folder = f"{RES}/mipmap-{dpi_name}"
        # 레거시
        rounded(master).resize((size, size), Image.NEAREST if size >= 96 else Image.LANCZOS).save(f"{folder}/ic_launcher.png")
        # 원형
        circle(master).resize((size, size), Image.NEAREST if size >= 96 else Image.LANCZOS).save(f"{folder}/ic_launcher_round.png")
        # 적응형 전경 (108dp 기준 밀도 배율: mdpi 1.0)
        fg_size = int(108 * (size / 48))
        transparent_fg().resize((fg_size, fg_size), Image.LANCZOS).save(f"{folder}/ic_launcher_foreground.png")
        print(f"mipmap-{dpi_name}: launcher/round {size}px, foreground {fg_size}px")
    # 플레이 스토어 등록용 512
    store = rounded(emblem(512), radius_ratio=0.18).resize((512, 512), Image.LANCZOS)
    store_path = f"{OUT}/SERTZ_icon_512.png"
    store.convert("RGB").save(store_path)
    print(f"store icon: {store_path}")
    print("DONE")


if __name__ == "__main__":
    main()
