"""Pack reviewed image_gen sheets; keep sources and existing runtime assets intact.

Usage: python scripts/pack-story-enemies.py
Only crops, alpha-normalizes and nearest-neighbour resizes supplied animation frames.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets_src/story-enemies-2026-11'
RECORD = ROOT / 'scripts/story-enemy-generation-sources.json'


def cuts(image, axis):
    alpha = image.getchannel('A')
    length = image.size[axis]
    result = [0]
    for n in range(1, 4):
        center = round(length * n / 4)
        blanks = []
        for p in range(max(1, center - length // 7), min(length - 1, center + length // 7)):
            strip = (p, 0, p + 1, image.height) if axis == 0 else (0, p, image.width, p + 1)
            if alpha.crop(strip).getbbox() is None:
                blanks.append(p)
        assert blanks, ('No transparent cell separator', axis, n)
        result.append(min(blanks, key=lambda p: abs(p - center)))
    return result + [length]


def cells(path):
    image = Image.open(path).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    ys = cuts(image, 1)
    result = []
    for row in range(4):
        band = image.crop((0, ys[row], image.width, ys[row + 1]))
        xs = cuts(band, 0)
        for col in range(4):
            cell = band.crop((xs[col], 0, xs[col + 1], band.height))
            box = cell.getbbox()
            # Internal cuts lie on fully transparent strips; the preceding pixel may
            # belong to a sword tip. Require padding at the actual sheet edges.
            assert box and box[0] > 0 and box[1] > 0 and (col < 3 or box[2] < cell.width) and (row < 3 or box[3] < cell.height), (path.name, row, col, box)
            result.append(cell.crop(box))
    return result


def pack(cid, sprites, names, folder, size, height, width, baseline, sha):
    assert len(sprites) == len(names) and len(set(names)) == len(names)
    scale = min(height / max(c.height for c in sprites), width / max(c.width for c in sprites))
    atlas = Image.new('RGBA', (size * 4, size * (len(sprites) // 4)))
    frames = {}
    for i, (cell, name) in enumerate(zip(sprites, names)):
        cell = cell.resize((max(1, round(cell.width * scale)), max(1, round(cell.height * scale))), Image.Resampling.NEAREST)
        assert cell.width < size and cell.height < baseline
        atlas.paste(cell, (i % 4 * size + (size - cell.width) // 2, i // 4 * size + baseline - cell.height))
        frames[name] = {'frame': {'x': i % 4 * size, 'y': i // 4 * size, 'w': size, 'h': size}, 'rotated': False, 'trimmed': False,
                        'sourceSize': {'w': size, 'h': size}, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': size, 'h': size}}
    folder.mkdir(parents=True, exist_ok=True)
    for motion in {name.split('-')[0] for name in names}:
        indices = [i for i, name in enumerate(names) if name.startswith(motion + '-')]
        assert len({atlas.crop((i % 4 * size, i // 4 * size, (i % 4 + 1) * size, (i // 4 + 1) * size)).tobytes() for i in indices}) >= 2, (cid, motion, 'static animation')
    atlas.save(folder / f'{cid}.png', optimize=True)
    (folder / f'{cid}.json').write_text(json.dumps({'frames': frames, 'meta': {'image': f'{cid}.png', 'size': {'w': atlas.width, 'h': atlas.height}, 'sourceSHA256': sha}}, indent=2) + '\n')
    return atlas


def main():
    sources = json.loads(RECORD.read_text())
    bosses_dir = ROOT / 'public/assets/story-bosses'
    monsters_dir = ROOT / 'public/assets/story-enemies'
    manifest_path = bosses_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    monsters = []
    for source in sources:
        path = SOURCE / source['file']
        sprites = cells(path)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        for role in source['roles']:
            cid = role['id']
            boss = role.get('boss', False)
            selected = [sprites[i] for i in role['indices']] if 'indices' in role else sprites[role.get('start', 0):role.get('start', 0) + (16 if boss else 8)]
            if boss:
                names = [f'{row}-{i}' for row in ['idle', 'walk', 'attack', 'cast'] for i in range(4)]
                atlas = pack(cid, selected, names, bosses_dir, 256, 144, 168, 238, sha)
                first = atlas.crop((0, 0, 256, 256)); box = first.getbbox()
                face = first.crop((box[0], box[1], box[2], box[1] + min(box[2] - box[0], box[3] - box[1])))
                face.resize((84, 84), Image.Resampling.NEAREST).save(bosses_dir / f'{cid}-portrait.png')
                entry = {'id': cid, 'texture': 'story_' + cid, 'frames': 16, 'sourceSHA256': sha, 'logicalHeightBudget': 72,
                         'prompt': source['brief'], 'combat': True}
                manifest['bosses'] = [b for b in manifest['bosses'] if b['id'] != cid] + [entry]
            else:
                # Source order: idle x2, stride x2, attack x2, stride x2.
                names = ['idle-0', 'idle-1', 'run-0', 'run-1', 'attack-0', 'attack-1', 'run-2', 'run-3']
                pack(cid, selected, names, monsters_dir, 64, 46, 54, 62, sha)
                monsters.append({'id': cid, 'texture': 'storymob_' + cid, 'frames': 8, 'sourceSHA256': sha, 'canon': role['canon']})
            role['sourceSHA256'] = sha
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (monsters_dir / 'manifest.json').write_text(json.dumps({'version': 1, 'frameWidth': 64, 'frameHeight': 64, 'monsters': monsters}, ensure_ascii=False, indent=2) + '\n')
    RECORD.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
    print(f'Packed {len(monsters)} monster roles and reviewed boss/companion sheets')


if __name__ == '__main__':
    main()
