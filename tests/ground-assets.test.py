#!/usr/bin/env python3
"""python3 tests/ground-assets.test.py — exact crop, no beveled dirt/sand borders."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'public/assets/ground/manifest.json').read_text())
for key in ('ground_dirt','ground_sand'):
    x,y,w,h=manifest[key]['crop']
    assert y>=2 and x%32>=2 and w<=28 and h<=28, f'{key}: source bevel border remains'
for key,entry in manifest.items():
    x,y,w,h=entry['crop']
    expected=Image.open(root/entry['source']).convert('RGBA').crop((x,y,x+w,y+h))
    expected=expected.resize((entry['width'],entry['height']),Image.Resampling.NEAREST)
    actual=Image.open(root/'public/assets/ground'/f'{key}.png').convert('RGBA')
    assert actual.tobytes()==expected.tobytes(), f'{key}: pixels changed'
print(f'ALL CHECKS PASS: {len(manifest)} exact native crops; dirt/sand bevel excluded')
