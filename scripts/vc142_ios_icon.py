#!/usr/bin/env python3
"""vc142 iOS 앱 아이콘 생성 — Android 런처(192px) → iOS 싱글사이즈 1024px.
iOS 아이콘은 알파 채널 불가 → 다크 배경 합성. LANCZOS + 언샵으로 보정."""
from PIL import Image, ImageFilter

SRC = "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
DST = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

im = Image.open(SRC).convert("RGBA")
im = im.resize((1024, 1024), Image.LANCZOS)
im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=95, threshold=2))

# 알파 제거 — 코너 투명분을 다크 배경(#0b0b14)으로 합성
bg = Image.new("RGBA", im.size, (11, 11, 20, 255))
out = Image.alpha_composite(bg, im).convert("RGB")
out.save(DST, "PNG")
print("saved", DST, out.size)
