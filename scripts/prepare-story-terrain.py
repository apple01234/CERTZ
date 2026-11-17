#!/usr/bin/env python3
"""Pack selected CC0 ground and wall tiles alongside the original chapter atlas."""
import hashlib
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/chapter-terrain"
ARCHIVE = "https://opengameart.org/sites/default/files/Dungeon%20Crawl%20Stone%20Soup%20Full_0.zip"
ARCHIVE_SHA = "41b4dc79632be19c47bf4555fd61e949189bb4496771b72e2dec5715b2d7bab4"
FLOOR = "dungeon/floor/"
WALL = "dungeon/wall/"
GROUPS = {
    "meadow": [FLOOR + f"grass/grass_{i}_new.png" for i in range(3)],
    "flowers": [FLOOR + f"grass/grass_flowers_{color}_1_new.png" for color in ("blue", "red", "yellow")],
    "gravel": [FLOOR + f"pebble_brown_{i}_new.png" for i in range(3)],
    "marble": [FLOOR + f"marble_floor_{i}.png" for i in range(1, 4)],
    "mosaic": [FLOOR + f"mosaic_{i}.png" for i in range(3)],
    "ice": [FLOOR + f"frozen_{i}.png" for i in range(3)],
    "crystal": [FLOOR + f"crystal_floor_{i}.png" for i in range(3)],
    "redStone": [FLOOR + f"demonic_red_{i}.png" for i in range(1, 4)],
    "grates": [FLOOR + f"cage_{i}.png" for i in range(3)],
    "brick": [WALL + f"brick_dark_{i}.png" for i in range(3)],
    "masonry": [WALL + f"stone_2_gray_{i}.png" for i in range(2)],
    "metal": [WALL + f"lab-metal_{i}.png" for i in range(3)],
}


def main(archive_path):
    archive = archive_path.read_bytes()
    assert hashlib.sha256(archive).hexdigest() == ARCHIVE_SHA, "Unexpected archive"
    original = json.loads((OUT / "manifest.json").read_text())
    tile_size, columns = original["tileSize"], original["columns"]
    first_index = len(original["tiles"])
    count = first_index + sum(map(len, GROUPS.values()))
    size = (columns * tile_size, (count + columns - 1) // columns * tile_size)
    atlas = Image.new("RGBA", size)
    atlas.paste(Image.open(OUT / "terrain.png"), (0, 0))
    groups, tiles = {}, []
    with ZipFile(io.BytesIO(archive)) as source:
        for name, files in GROUPS.items():
            groups[name] = []
            for file in files:
                data = source.read("Dungeon Crawl Stone Soup Full/" + file)
                tile = Image.open(io.BytesIO(data)).convert("RGBA")
                assert tile.size == (32, 32), file
                index = first_index + len(tiles)
                atlas.paste(tile.resize((tile_size, tile_size), Image.Resampling.NEAREST),
                            (index % columns * tile_size, index // columns * tile_size))
                groups[name].append(index)
                tiles.append({"id": index, "source": file, "sha256": hashlib.sha256(data).hexdigest()})
    atlas.save(OUT / "story-terrain.png", optimize=True)
    (OUT / "story-terrain.json").write_text(json.dumps({
        "source": "https://opengameart.org/content/dungeon-crawl-32x32-tiles",
        "archive": ARCHIVE, "archiveSha256": ARCHIVE_SHA,
        "author": "Dungeon Crawl Stone Soup tile contributors",
        "license": "CC0-1.0", "licenseFile": "public/assets/campaign/drive/LICENSE.txt",
        "base": "terrain.png", "groups": groups, "tiles": tiles,
    }, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
