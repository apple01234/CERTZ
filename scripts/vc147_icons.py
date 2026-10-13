#!/usr/bin/env python3
"""vc147 (#9) — 앱 아이콘 전면 교체: 유저 제공 YGGDRASIL SERTZ 아이콘(1254×1254).
Android mipmap(launcher/round/foreground) + Electron + iOS AppIcon 동시 생성.
AI 생성 0 — 유저 업로드 원본 그대로 리사이즈/마스크만 적용."""
from PIL import Image, ImageDraw, ImageOps
import os

SRC = "/home/z/my-project/upload/file_00000000a260820693b7067878d42e60.png"
ROOT = "/home/z/my-project"

im = Image.open(SRC).convert("RGBA")

def square_fill(size: int) -> Image.Image:
    """라운드 코너 원본을 살짝 줌(112%)해 코너 여백이 없는 풀블리드 정사각형."""
    zoom = 1.12
    big = im.resize((int(size * zoom), int(size * zoom)), Image.LANCZOS)
    off = (big.width - size) // 2
    return big.crop((off, off, off + size, off + size))

def round_icon(size: int) -> Image.Image:
    sq = square_fill(size)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4, size * 4), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(sq, (0, 0), mask)
    return out

def adaptive_foreground(size: int) -> Image.Image:
    """적응형 foreground: 108dp 캔버스(여기선 size)에 콘텐츠 ~66% 중앙 배치 + 안전 패딩."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.62)
    content = square_fill(inner)
    off = (size - inner) // 2
    canvas.paste(content, (off, off), content)
    return canvas

# 1) Android mipmap — launcher(square) / round / foreground
MIP = {
    "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192,
}
for dpi, px in MIP.items():
    d = f"{ROOT}/android/app/src/main/res/mipmap-{dpi}"
    square_fill(px).save(f"{d}/ic_launcher.png")
    round_icon(px).save(f"{d}/ic_launcher_round.png")
    adaptive_foreground(px * 2).resize((px, px), Image.LANCZOS).save(f"{d}/ic_launcher_foreground.png")
    print(f"android mipmap-{dpi}: {px}px OK")

# 2) Electron 아이콘 (512)
square_fill(512).save(f"{ROOT}/electron/icon.png")
print("electron/icon.png 512 OK")

# 3) iOS AppIcon (1024 — AppIcon-512@2x)
square_fill(1024).save(f"{ROOT}/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
print("iOS AppIcon 1024 OK")

# 4) 웹 파비콘/애플터치/PWA (Next app router 관례 + manifest용)
square_fill(64).save(f"{ROOT}/public/favicon-64.png")
square_fill(180).save(f"{ROOT}/public/apple-touch-icon.png")
square_fill(192).save(f"{ROOT}/public/icon-192.png")
square_fill(512).save(f"{ROOT}/public/icon-512.png")
sq32 = square_fill(32).convert("RGB")
sq32.save(f"{ROOT}/public/favicon.ico", sizes=[(16, 16), (32, 32)])
sq = square_fill(32)
sq.save(f"{ROOT}/src/app/icon.png")
print("web icons OK")
