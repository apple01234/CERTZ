#!/usr/bin/env python3
"""Slice generated, portrait-referenced 4x4 sheets; never draw or synthesize poses.

python scripts/build-cutscene-cast.py --source-dir /workspace/generated_images
Raw generations stay outside public/. The committed PNG/JSON pairs work offline.
"""
import argparse
import hashlib
import json
import statistics
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/assets/cutscene-cast/manifest.json"
SOURCES = ROOT / "scripts/cutscene-cast-sources.json"
NAMES = ["idle-down-0", "idle-down-1", "walk-down-0", "walk-down-1",
         "idle-side-0", "idle-side-1", "walk-side-0", "walk-side-1",
         "idle-up-0", "idle-up-1", "walk-up-0", "walk-up-1",
         "talk", "reach", "hurt", "ready"]


def build(source, character, target, spec):
    raw = Image.open(source).convert("RGBA")
    # Alpha threshold removes nearly invisible generation fringes, not costume colors.
    alpha = raw.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    raw.putalpha(alpha)
    cells, boxes = [], []
    # Some generators leave uneven empty gutters. Slice at transparent seams only.
    def seams(axis):
        length = raw.width if axis == 0 else raw.height
        result = [0]
        for n in range(1, 4):
            target = round(length * n / 4)
            blank = [p for p in range(target - length // 20, target + length // 20)
                     if alpha.crop((p, 0, p + 1, raw.height) if axis == 0 else (0, p, raw.width, p + 1)).getbbox() is None]
            assert blank, f"{character['id']}: no transparent sprite separator"
            result.append(min(blank, key=lambda p: abs(p - target)))
        return result + [length]
    xs, ys = seams(0), seams(1)
    for row in range(4):
        for col in range(4):
            rect = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            cell = raw.crop(rect)
            box = cell.getchannel("A").getbbox()
            assert box, f"{character['id']}: empty generated cell {row},{col}"
            assert box[0] > 0 and box[1] > 0 and box[2] < cell.width and box[3] < cell.height, f"{character['id']}: clipped source cell {row},{col}"
            cells.append(cell)
            boxes.append(box)
    fw, fh = spec["frameWidth"], spec["frameHeight"]
    feet = round(fh * spec["origin"]["y"])
    standing_height = statistics.median(b[3] - b[1] for b in boxes[:12])
    horizontal = max(max(c.width / 2 - b[0], b[2] - c.width / 2) for c, b in zip(cells, boxes))
    scale = min(72 / standing_height, (fw / 2 - 4) / horizontal)
    atlas = Image.new("RGBA", (fw * 4, fh * 4))
    frames = {}
    for i, (cell, box, name) in enumerate(zip(cells, boxes, NAMES)):
        crop = cell.crop(box)
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (fw, fh))
        left = round(fw / 2 + (box[0] - cell.width / 2) * scale)
        top = feet - crop.height
        assert left >= 1 and left + crop.width < fw and top >= 1, f"{character['id']}: normalized clipping {name}"
        frame.paste(crop, (left, top))
        x, y = i % 4 * fw, i // 4 * fh
        atlas.paste(frame, (x, y))
        frames[name] = {"frame": {"x": x, "y": y, "w": fw, "h": fh}, "rotated": False,
                        "trimmed": False, "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
                        "sourceSize": {"w": fw, "h": fh}}
    cid = character["id"]
    atlas.save(target / f"{cid}.png", optimize=True)
    meta = {"app": "CERTZ portrait-matched cast", "version": "1", "image": f"{cid}.png", "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height}, "scale": "1", "character": cid,
            "reference": character["reference"], "sourceSHA256": hashlib.sha256(source.read_bytes()).hexdigest()}
    (target / f"{cid}.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=2) + "\n")
    # Portrait and body come from the SAME generated character, including all corrected outfits.
    first, box = cells[0], boxes[0]
    size = round(standing_height * 0.58)
    cx = first.width / 2
    portrait = first.crop((round(cx - size / 2), box[1], round(cx + size / 2), box[1] + size))
    portrait.resize((84, 84), Image.Resampling.NEAREST).save(target / "portraits" / f"{cid}.png", optimize=True)
    return atlas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--preview", type=Path, default=Path("/dev/shm/cutscene-cast-preview.png"))
    args = parser.parse_args()
    spec = json.loads(MANIFEST.read_text())
    sources = {s["id"]: s for s in json.loads(SOURCES.read_text())["sources"]}
    target = MANIFEST.parent
    (target / "portraits").mkdir(exist_ok=True)
    previews = []
    for c in spec["characters"]:
        assert c["id"] in sources, f"Missing generation: {c['id']}"
        sheet = build(args.source_dir / sources[c["id"]]["file"], c, target, spec)
        previews.append((c, sheet))
    # Technical contact sheet for review: portrait + idle, two actual walk poses, and action poses.
    tile_w, tile_h = 8 * 96, 130
    preview = Image.new("RGB", (tile_w * 2, tile_h * ((len(previews) + 1) // 2)), "#272c38")
    draw = ImageDraw.Draw(preview)
    for n, (c, sheet) in enumerate(previews):
        x, y = n % 2 * tile_w, n // 2 * tile_h
        draw.text((x + 6, y + 4), c["id"], fill="white")
        portrait = Image.open(target / "portraits" / f"{c['id']}.png")
        preview.paste(portrait, (x + 6, y + 26), portrait)
        for col, i in enumerate([0, 2, 3, 6, 12, 14, 15], 1):
            frame = sheet.crop((i % 4 * 96, i // 4 * 96, (i % 4 + 1) * 96, (i // 4 + 1) * 96))
            preview.paste(frame, (x + col * 96, y + 20), frame)
    preview.save(args.preview)
    print(f"Built {len(previews)} character atlases ({len(previews) * 16} frames) and matching portraits; preview: {args.preview}")


if __name__ == "__main__":
    main()
