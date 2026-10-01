#!/usr/bin/env python3
"""Contact sheets for drive asset curation."""
from PIL import Image
import os, sys

GROUPS = {
    "cainos": ("/home/z/my-project/upload/drive_extracted/file1/Cainos/Pixel Art Platformer - Village Props/Texture", ".png"),
    "buff": ("/home/z/my-project/upload/drive_extracted/file1/GameVFX Buff Collection/Textures", ".png"),
    "fireworks": ("/home/z/my-project/upload/drive_extracted/file1/CartoonVFX9X/FireworksEffect2D/Textures", ".png"),
    "water": ("/home/z/my-project/upload/drive_extracted/file1/Cainos/Interactive Pixel Water/Texture", ".png"),
    "anime": ("/home/z/my-project/upload/drive_extracted/file2/Vefects/Anime Stylized VFX/Shared/Textures", ".png"),
    "petal": ("/home/z/my-project/upload/drive_extracted/file3/Petal Particles - Cherry Petals/Particle", ".png"),
    "slash": ("/home/z/my-project/upload/drive_extracted/file3/Matthew Guz/Slash Effects FREE/Textures", ".png"),
    "pixelfx": ("/home/z/my-project/upload/drive_extracted/file1/PixelFX_vol1/Sprite", ".png"),
}

def sheet(name, root, ext, out, cols=6, cell=200):
    if not os.path.isdir(root):
        print(f"{name}: missing {root}")
        return
    files = []
    for dp, _, fns in os.walk(root):
        for fn in fns:
            if fn.lower().endswith(ext) and not fn.endswith(".meta"):
                files.append(os.path.join(dp, fn))
    files.sort()
    files = files[:36]
    if not files:
        print(f"{name}: no files")
        return
    rows = (len(files) + cols - 1) // cols
    canvas = Image.new("RGBA", (cols * cell, rows * (cell + 18)), (24, 26, 34, 255))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    for i, f in enumerate(files):
        try:
            im = Image.open(f).convert("RGBA")
            im.thumbnail((cell - 8, cell - 8))
            x = (i % cols) * cell
            y = (i // cols) * (cell + 18)
            canvas.paste(im, (x + 4, y + 4), im)
            label = os.path.basename(f)[:30]
            d.text((x + 4, y + cell + 2), label, fill=(220, 220, 230, 255))
        except Exception as e:
            print(f"  {f}: {e}")
    canvas.save(out)
    print(f"{name}: {len(files)} tiles -> {out}")

if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for name, (root, ext) in GROUPS.items():
        if only and name != only:
            continue
        sheet(name, root, ext, f"/home/z/my-project/upload/review_{name}.png")
