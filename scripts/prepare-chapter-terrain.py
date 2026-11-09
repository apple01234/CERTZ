#!/usr/bin/env python3
"""Vendor verified native terrain cells. Crop/nearest packing only; no painted or generated terrain."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/chapter-terrain'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tiny-swords', type=Path, required=True)
    p.add_argument('--receipt', type=Path, required=True)
    p.add_argument('--archive', type=Path, required=True)
    a = p.parse_args()
    receipt = json.loads(a.receipt.read_text())
    assert hashlib.sha256(a.archive.read_bytes()).hexdigest() == receipt['archiveSha256']
    assert receipt['officialFilename'] == 'TS_old version_CC0 Licensed'
    OUT.mkdir(exist_ok=True)
    tiles, roster, materials = [], [], {}
    def admit(path, rect, label):
        data = path.read_bytes()
        if path.is_relative_to(a.tiny_swords):
            relative = str(path.relative_to(a.tiny_swords))
            source = next(f for f in receipt['files'] if f['path'].endswith(relative))
            assert hashlib.sha256(data).hexdigest() == source['sha256'], relative
        im = Image.open(path).convert('RGBA').crop(rect)
        assert im.width == im.height, label
        im = im.resize((64,64), Image.Resampling.NEAREST)
        roster.append({'id':len(tiles), 'label':label, 'source':str(path.relative_to(a.tiny_swords)) if path.is_relative_to(a.tiny_swords) else str(path.relative_to(ROOT)), 'rect':list(rect), 'sha256':hashlib.sha256(data).hexdigest()})
        tiles.append(im)
        return len(tiles)-1
    flat = a.tiny_swords / 'Terrain/Ground/Tilemap_Flat.png'
    elevation = a.tiny_swords / 'Terrain/Ground/Tilemap_Elevation.png'
    for name, ox in [('grass',0),('sand',320)]:
        ids = [admit(flat,(ox+x*64,y*64,ox+(x+1)*64,(y+1)*64),f'{name}-{x}-{y}') for y in range(3) for x in range(3)]
        materials[name]={'tiles':ids, 'center':ids[4], 'edge':True}
    ids = [admit(elevation,(x*64,y*64,(x+1)*64,(y+1)*64),f'rock-{x}-{y}') for y in range(4) for x in range(3)]
    materials['rock']={'tiles':ids,'center':ids[4],'edge':True}
    wi = admit(a.tiny_swords/'Terrain/Water/Water.png',(0,0,64,64),'water')
    materials['water']={'tiles':[wi],'center':wi,'edge':False}
    wi = admit(a.tiny_swords/'Terrain/Bridge/Bridge_All.png',(64,16,96,48),'wood-plank-interior')
    materials['wood']={'tiles':[wi],'center':wi,'edge':False}
    # Actual material floor tiles from the already-vendored CC0 DCSS pack, not props or recolored grass.
    for name, group in [('castle','castle'),('earth','harbor'),('snow','snow'),('machine','machine'),('ruin','ruin'),('astral','astral'),('volcano','volcano'),('forest','forest')]:
        ids=[]
        for suffix in ['', '-1', '-2']:
            path=ROOT / f'public/assets/campaign/drive/floor-{group}{suffix}.png'
            im=Image.open(path)
            assert im.size==(32,32),(path,im.size)
            ids.append(admit(path,(0,0,32,32),name+suffix))
        materials[name]={'tiles':ids,'center':ids[0],'edge':False}
    atlas=Image.new('RGBA',(8*64,((len(tiles)+7)//8)*64))
    for i,im in enumerate(tiles):atlas.paste(im,(i%8*64,i//8*64))
    atlas.save(OUT/'terrain.png',optimize=True)
    for name,mat in materials.items():tiles[mat['center']].save(OUT/f'{name}.png',optimize=True)
    (OUT/'manifest.json').write_text(json.dumps({'tileSize':64,'columns':8,'materials':materials,'tiles':roster,'sources':[{'author':'Pixel Frog','license':'CC0-1.0','url':receipt['source'],'officialFilename':receipt['officialFilename'],'archiveSHA256':receipt['archiveSha256']},{'author':'DCSS artists','license':'CC0-1.0','url':'https://opengameart.org/content/dungeon-crawl-32x32-tiles','licenseFile':'public/assets/campaign/drive/LICENSE.txt'}]},ensure_ascii=False,indent=2)+'\n')
    print(f'Verified and packed {len(tiles)} native tiles; {len(materials)} distinct materials; no recolor/shuffle/noise.')

if __name__=='__main__':main()
