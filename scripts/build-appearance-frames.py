#!/usr/bin/env python3
"""Record alpha bounds for DOM crops; never alter the source images."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/assets"


def frame(path, region=None, head=False, square=False):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    if region:
        alpha = alpha.crop(region)
    box = alpha.getbbox()
    assert box, path
    if head:
        bottom = box[1] + round((box[3] - box[1]) * 0.58)
        head_box = alpha.crop((0, box[1], alpha.width, bottom)).getbbox()
        # Head/shoulder bounds, rather than the sheet cell's center or a weapon.
        side = max(bottom - box[1], head_box[2] - head_box[0]) + 2
        x = (head_box[0] + head_box[2] - side) // 2
        box = (x, box[1] - 1, x + side, box[1] - 1 + side)
    elif square:
        side = max(box[2] - box[0], box[3] - box[1])
        x = (box[0] + box[2] - side) // 2
        y = (box[1] + box[3] - side) // 2
        box = (x, y, x + side, y + side)
    x, y, right, bottom = box
    return {"src": "/assets/" + path.relative_to(ASSETS).as_posix(),
            "crop": {"x": x, "y": y, "w": right - x, "h": bottom - y},
            "sheet": {"w": image.width, "h": image.height}}


def build():
    frames = {}
    for path in sorted(ASSETS.glob("*_idle0.webp")):
        if path.stem.startswith(("chm", "chf", "jobm_", "jobf_", "cost_", "costm_", "gm_")):
            frames["/assets/" + path.name] = frame(path)
    for path in sorted((ASSETS / "npcportrait").glob("*.png")):
        frames["/assets/npcportrait/" + path.name] = frame(path, square=True)
    manifest = json.loads((ASSETS / "cutscene-cast/manifest.json").read_text())
    for character in manifest["characters"]:
        cid = character["id"]
        frames[f"/assets/cutscene-cast/portraits/{cid}.png"] = frame(
            ASSETS / f"cutscene-cast/{cid}.png", (0, 0, 96, 96), head=True)
    return frames


if __name__ == "__main__":
    target = ROOT / "src/game/appearanceFrames.json"
    target.write_text("{\n" + ",\n".join(
        "  " + json.dumps(key) + ": " + json.dumps(value)
        for key, value in build().items()) + "\n}\n")
    print("Recorded appearance crop metadata:", target)
