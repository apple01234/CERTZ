"""
Ground tile manifest provenance fix (vc274).

[Problem] `_swap_ground.py` replaced the PNGs but left the manifest entries without
the provenance-tracking fields (`crop` / `generatedBy` / `sourceSha256`).
`tests/ground-tiles.test.mjs:28` enforces that every entry has one of them,
so the test failed.

[Fix] Follow the exact shape already used by `ground_snow` / `ground_lava`, which
are also "a whole 256px source tile copied losslessly":
`sourceSha256` + `crop: [0, 0, w, h]` + `integerScale: 1`.
No new format is introduced.

Usage: python scripts/fix_ground_manifest.py
"""
from PIL import Image
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

MANIFEST = "public/assets/ground/manifest.json"

# dest key -> original webp path (same mapping as the swap script)
SOURCE_OF = {
    "ground_meadow": "public/assets/tile_grass_pack.webp",
    "ground_slate": "public/assets/tile_tech.webp",
    "ground_ash": "public/assets/tile_marble.webp",
    "ground_violet": "public/assets/tile_mushroom.webp",
    "ground_cavern": "public/assets/tile_void.webp",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)

    changed = []
    for dest, src in SOURCE_OF.items():
        entry = manifest.get(dest)
        if entry is None:
            print("SKIP %s: no manifest entry" % dest)
            continue
        if not os.path.exists(src):
            print("SKIP %s: source %s missing" % (dest, src))
            continue
        dst_png = "public/assets/ground/%s.png" % dest
        if not os.path.exists(dst_png):
            print("SKIP %s: target png missing" % dest)
            continue

        w, h = Image.open(dst_png).size
        entry["sourceSha256"] = sha256(src)
        # Lossless whole-image copy, so the crop is the entire image
        # (same convention as ground_snow / ground_lava).
        entry["crop"] = [0, 0, w, h]
        entry["integerScale"] = 1
        entry["width"] = w
        entry["height"] = h
        changed.append("%s %dx%d sha=%s" % (dest, w, h, entry["sourceSha256"][:12]))

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("updated %d entries" % len(changed))
    for line in changed:
        print("  " + line)


if __name__ == "__main__":
    main()
