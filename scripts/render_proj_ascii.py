#!/usr/bin/env python3
"""투사체 텍스처 ASCII 렌더링 — 알파 채널을 문자로 찍어 방향을 눈으로 확정."""
from PIL import Image
import numpy as np, sys, os

def render(path, scale_frames=None):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[:, :, 3]
    h, w = a.shape
    print(f"\n=== {os.path.basename(path)} ({w}x{h}) ===")
    if scale_frames and w % scale_frames == 0:
        fw = w // scale_frames
        for f in range(min(scale_frames, 3)):
            fa = a[:, f*fw:(f+1)*fw]
            print(f"--- 프레임 {f} (x{fw}) ---")
            for row in fa:
                print("".join("#" if v > 128 else ("." if v > 40 else " ") for v in row))
    else:
        for row in a:
            print("".join("#" if v > 128 else ("." if v > 40 else " ") for v in row))

render("public/assets/x2_arrow.webp")
render("public/assets/x2_sp_darkbolt.webp", scale_frames=6)
