"""tile_path 계열 텍스처의 알파 채널 분석 — 불투명 배경 여부 확인"""
from PIL import Image
import os

A = "/home/z/my-project/public/assets"
for name in ["tile_path.png", "tile_path_dark.png", "tile_grass.png", "tx_gp_pvar.png", "tx_gp_edge_dn.png"]:
    p = os.path.join(A, name)
    img = Image.open(p).convert("RGBA")
    px = list(img.getdata())
    total = len(px)
    transparent = sum(1 for r, g, b, a in px if a < 32)
    # 코너/중앙 픽셀 색상
    w, h = img.size
    corners = [img.getpixel((0, 0)), img.getpixel((w-1, 0)), img.getpixel((w//2, h//2)), img.getpixel((2, 2))]
    print(f"{name}: 투명픽셀 {transparent}/{total} ({100*transparent/total:.0f}%) 샘플={corners}")
