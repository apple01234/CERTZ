#!/usr/bin/env python3
"""SERTZ EXE 아이콘 생성 — 안드로이드 런처 아이콘에서 512x512 PNG 생성 (electron-builder용)."""
from PIL import Image

BASE = "/home/z/my-project"
launcher = Image.open(f"{BASE}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png").convert("RGBA")
fg = Image.open(f"{BASE}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png").convert("RGBA")

# 배경색: 런처 아이콘 모서리 픽셀 샘플
bg_color = launcher.getpixel((4, 4))[:3]
print("bg color:", bg_color)

# 512x512 캔버스: 배경색 채우기 → 포그라운드(432) 중앙 합성 → 가장자리는 런처 원본 레이어도 합성
canvas = Image.new("RGBA", (512, 512), bg_color + (255,))
canvas.alpha_composite(launcher.resize((512, 512), Image.LANCZOS))
canvas.alpha_composite(fg.resize((512, 512), Image.LANCZOS))

out = f"{BASE}/electron/icon.png"
canvas.save(out, "PNG")
print("saved:", out, canvas.size)
