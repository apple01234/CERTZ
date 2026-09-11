"""Gameworks Unity pack candidate textures — contact sheet for visual review."""
from PIL import Image, ImageDraw
import os

CANDS = [
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/MagicCircle.png", "MagicCircle(RGB)"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/MagicCircle2.png", "MagicCircle2(RGBA)"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/TechCircle.png", "TechCircle"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/TechCircle2.png", "TechCircle2"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Electro.png", "Electro"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Star.png", "Star(RGB)"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Splat.png", "Splat(RGB)"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Flare.png", "Flare"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Flash.png", "Flash"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/GlowFree1.png", "GlowFree1"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Gradient2.png", "Gradient2"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Slash.png", "HovlSlash"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Crack.png", "Crack"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Trail67.png", "Trail67"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/Arrow1.png", "Arrow1"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/ProjectileFree1.png", "ProjectileFree1"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/CrystalFree1.png", "CrystalFree1"),
    ("research/gameworks/Hovl Studio/Magic effects pack/Textures/CraterFree1.png", "CraterFree1(RGB)"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Slash.png", "GuzSlash"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Slash 1.png", "GuzSlash1"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Slash M.png", "GuzSlashM"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Slash S.png", "GuzSlashS"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Shockwave 2.png", "GuzShockwave2"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-explosión.png", "GuzBoom"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Spark.png", "GuzSpark"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Crit_2.png", "GuzCrit2"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Fire_.png", "GuzFire"),
    ("research/gameworks/Matthew Guz/Slash Effects FREE/Textures/5-Light_Point.png", "GuzLPoint"),
    ("research/gameworks/Petal Particles - Cherry Petals/Particle/Textures/CherryPetal.png", "CherryPetal"),
]

COLS, CELL, PAD = 6, 220, 26
rows = (len(CANDS) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * (CELL + PAD) + PAD, rows * (CELL + 40 + PAD) + PAD), (24, 26, 34))
d = ImageDraw.Draw(sheet)
for i, (p, name) in enumerate(CANDS):
    r, c = divmod(i, COLS)
    x0, y0 = PAD + c * (CELL + PAD), PAD + r * (CELL + 40 + PAD)
    try:
        im = Image.open(p).convert("RGBA")
        im.thumbnail((CELL, CELL))
        bg = Image.new("RGBA", (CELL, CELL), (60, 62, 74, 255))
        bg.paste(im, ((CELL - im.width) // 2, (CELL - im.height) // 2), im)
        sheet.paste(bg.convert("RGB"), (x0, y0))
        d.text((x0, y0 + CELL + 4), f"{name} {Image.open(p).size[0]}x{Image.open(p).size[1]}", fill=(220, 220, 230))
    except Exception as e:
        d.text((x0, y0 + 8), f"ERR {name}: {e}", fill=(255, 120, 120))
out = "download/gameworks_contact.png"
sheet.save(out)
print("saved", out, sheet.size)
