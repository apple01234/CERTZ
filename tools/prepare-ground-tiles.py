#!/usr/bin/env python3
"""기존 팩의 순수 지면 셀만 무손실 추출. 새 그림/색조 생성 없음."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/ground'
# x,y,w,h — 격자 확대 검수로 물가/절벽/소품 없는 내부 셀 확인.
SOURCES = {
    'ground_meadow': ('public/assets/tiles/kenney_tinytown.png', (16, 0, 16, 16), 4, 'Kenney Tiny Town', 'CC0-1.0'),
    'ground_dirt': ('assets_dl/tilesets/simple_tiles_32px.png', (34, 2, 28, 28), 3, 'Simple tiles', 'CC0-1.0'),
    'ground_sand': ('assets_dl/tilesets/simple_tiles_32px.png', (66, 2, 28, 28), 3, 'Simple tiles', 'CC0-1.0'),
    'ground_forest': ('assets_dl/tilesets/simple_tiles_32px.png', (192, 32, 32, 32), 3, 'Simple tiles', 'CC0-1.0'),
    'ground_slate': ('assets_dl/tilesets/simple_tiles_32px.png', (224, 32, 32, 32), 3, 'Simple tiles', 'CC0-1.0'),
    'ground_ash': ('assets_dl/tilesets/simple_tiles_32px.png', (224, 0, 32, 32), 3, 'Simple tiles', 'CC0-1.0'),
    'ground_violet': ('assets_dl/tilesets/buch_outdoor_32px.png', (160, 96, 32, 32), 3, 'Buch outdoor tiles', 'CC0-1.0'),
    'ground_cavern': ('assets_dl/tilesets/buch_outdoor_32px.png', (160, 224, 32, 32), 3, 'Buch outdoor tiles', 'CC0-1.0'),
    'ground_snow': ('public/assets/.tile_pack_backup/tile_snow.png', (0, 0, 256, 256), 1, 'Preserved snow terrain before incorrect border replacement', 'Existing project asset; see public/assets/CREDITS.md'),
    'ground_lava': ('public/assets/.tile_pack_backup/tile_magma.png', (0, 0, 256, 256), 1, 'Preserved volcanic terrain before incorrect border replacement', 'Existing project asset; see public/assets/CREDITS.md'),
}

def main():
    OUT.mkdir(exist_ok=True)
    manifest = {}
    sheet = Image.new('RGB', (len(SOURCES)*140, 170), '#293d49')
    draw = ImageDraw.Draw(sheet)
    for i, (key, (source, crop, scale, pack, license_name)) in enumerate(SOURCES.items()):
        src = ROOT / source
        x, y, w, h = crop
        cell = Image.open(src).convert('RGBA').crop((x,y,x+w,y+h))
        assert cell.getchannel('A').getextrema() == (255,255), (key, 'not full-bleed floor')
        image = cell.resize((w*scale,h*scale), Image.Resampling.NEAREST)
        image.save(OUT/(key+'.png'))
        assert Image.open(OUT/(key+'.png')).tobytes() == image.tobytes()
        manifest[key] = {'source': source, 'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
                         'crop':list(crop), 'integerScale':scale, 'pack':pack, 'license':license_name,
                         'width':image.width,'height':image.height}
        preview = image.resize((128,128), Image.Resampling.NEAREST)
        sheet.paste(preview,(i*140+6,6));draw.text((i*140+4,140),key.removeprefix('ground_'),fill='white')
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    dest = ROOT/'build/qa-ground';dest.mkdir(exist_ok=True,parents=True)
    sheet.save(dest/'native-floor-cells.png')
    print('ALL CHECKS PASS:',len(manifest),'lossless floor cells; no recolor/no generated art')
    print('preview:',dest/'native-floor-cells.png')

if __name__ == '__main__':
    main()
