#!/usr/bin/env python3
"""Pack generated 4x4 combat sheets with real alpha; no drawn/recolored poses."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/story-boss-generation-sources.json'


def boundaries(image, axis):
    alpha = image.getchannel('A')
    length = image.width if axis == 0 else image.height
    bounds = [0]
    for n in range(1, 4):
        target = round(length * n / 4)
        blank = []
        for pos in range(max(bounds[-1] + 1, target - length // 20), min(length, target + length // 20)):
            strip = alpha.crop((pos, 0, pos + 1, image.height) if axis == 0 else (0, pos, image.width, pos + 1))
            if strip.getbbox() is None:
                blank.append(pos)
        assert blank, f'No transparent separator near {axis}:{n}'
        bounds.append(min(blank, key=lambda p: abs(p - target)))
    return bounds + [length]


def main():
    spec = json.loads(SOURCE.read_text())
    dest = ROOT / 'public/assets/story-bosses'
    dest.mkdir(exist_ok=True)
    records, previews = [], []
    for source in spec['sources']:
        if source['id'] in ['dean']:
            continue
        if source['id'] in ['dio', 'fabian', 'jade', 'littlestar'] and not source.get('combat'):
            continue
        raw_path = Path('/workspace/generated_images') / source['file']
        image = Image.open(raw_path).convert('RGBA')
        image.putalpha(image.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        xs, ys = boundaries(image, 0), boundaries(image, 1)
        cells = []
        for i in range(16):
            cell = image.crop((xs[i % 4], ys[i // 4], xs[i % 4 + 1], ys[i // 4 + 1]))
            box = cell.getbbox()
            assert box and box[0] > 0 and box[1] > 0 and (i % 4 < 3 or box[2] < cell.width) and (i // 4 < 3 or box[3] < cell.height), (source['id'], i, box)
            cells.append(cell.crop(box))
        # Downsample to an explicit logical pixel grid, then integer nearest scaling.
        # Native sprites remain 3-head-tall; a monster has a larger logical budget.
        logical = 72 if source.get('combat') or source['id'] == 'desknis' else 112
        scale = min(logical / max(c.height for c in cells), (logical + 12) / max(c.width for c in cells))
        size, baseline = 256, 238
        atlas = Image.new('RGBA', (size * 4, size * 4)); frames = {}
        for i, cell in enumerate(cells):
            cell = cell.resize((max(1, round(cell.width * scale)), max(1, round(cell.height * scale))), Image.Resampling.NEAREST)
            cell = cell.resize((cell.width * 2, cell.height * 2), Image.Resampling.NEAREST)
            atlas.paste(cell, (i % 4 * size + (size - cell.width) // 2, i // 4 * size + baseline - cell.height))
            name = ['idle', 'walk', 'attack', 'cast'][i // 4] + '-' + str(i % 4)
            frames[name] = {'frame': {'x': i % 4 * size, 'y': i // 4 * size, 'w': size, 'h': size}, 'rotated': False, 'trimmed': False,
                            'sourceSize': {'w': size, 'h': size}, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': size, 'h': size}}
        cid = source['id']; sha = hashlib.sha256(raw_path.read_bytes()).hexdigest()
        atlas.save(dest / f'{cid}.png', optimize=True)
        (dest / f'{cid}.json').write_text(json.dumps({'frames': frames, 'meta': {'image': cid + '.png', 'size': {'w': 1024, 'h': 1024}, 'sourceSHA256': sha}}, indent=2) + '\n')
        first = atlas.crop((0, 0, 256, 256)); box = first.getbbox(); face = first.crop((box[0], box[1], box[2], box[1] + min(box[2] - box[0], box[3] - box[1])))
        face.resize((84, 84), Image.Resampling.NEAREST).save(dest / f'{cid}-portrait.png')
        records.append({'id': cid, 'texture': 'story_' + cid, 'frames': 16, 'sourceSHA256': sha, 'logicalHeightBudget': logical,
                        'prompt': source['prompt'], 'combat': bool(source.get('combat'))})
        previews.append((cid, atlas))
    (dest / 'manifest.json').write_text(json.dumps({'version': 1, 'tool': 'image_gen', 'frameWidth': 256, 'frameHeight': 256, 'bosses': records}, ensure_ascii=False, indent=2) + '\n')
    preview = Image.new('RGB', (1024, ((len(previews) + 1) // 2) * 300), '#303846'); draw = ImageDraw.Draw(preview)
    for n, (cid, atlas) in enumerate(previews):
        x, y = n % 2 * 512, n // 2 * 300
        draw.text((x + 8, y + 5), cid, fill='white')
        for j, i in enumerate([0, 9]):
            cell = atlas.crop((i % 4 * 256, i // 4 * 256, (i % 4 + 1) * 256, (i // 4 + 1) * 256))
            preview.paste(cell, (x + j * 256, y + 25), cell)
    preview.save('/dev/shm/story-boss-preview.png')
    print(f'Packed {len(records)} boss atlases / {len(records) * 16} frames')


if __name__ == '__main__':
    main()
