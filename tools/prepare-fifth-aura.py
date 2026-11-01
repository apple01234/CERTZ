#!/usr/bin/env python3
"""Aura-only derivatives: preserve RGB/resolution, smooth alpha per explicit frame.
Never edits shared source VFX or creates playable art. python3 tools/prepare-fifth-aura.py
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
OUT = ASSETS / 'aura'
KEYS = '''gvb_buff_air gvb_glow_blue gvb_glow_blurry gvb_glow_white gvb_lensflare gvb_lightning_blue gvb_ring_soft gvb_shield_hex gvb_star4 gvb_star_green gvb_trail_stylized gvb_twinkle gvu_circle_aggr gvu_energynoise gvu_energyweb gvu_flare_xo gvu_glow gvu_mask_ommi gvu_mask_razor gvu_shockwave_fiery gvu_spark gvu_trail_ghost gvu_trail_wave'''.split()
RADIAL = {'gvu_energynoise', 'gvu_energyweb', 'gvu_mask_ommi', 'gvu_mask_razor'}

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)

def derive(source, cols=1, rows=1, radial=False):
    a = np.array(source.convert('RGBA'))
    h, w = a.shape[:2]
    assert w % cols == 0 and h % rows == 0
    fw, fh = w // cols, h // rows
    yy, xx = np.mgrid[:fh, :fw]
    # C1 smooth boundary fade: retains the source silhouette and its original RGB.
    edge = np.minimum.reduce([xx / max(1, fw * .045), (fw-1-xx) / max(1, fw*.045), yy / max(1, fh*.045), (fh-1-yy) / max(1, fh*.045)])
    mask = smooth(edge)
    if radial:
        radius = np.sqrt(((xx-(fw-1)/2)/((fw-1)/2))**2 + ((yy-(fh-1)/2)/((fh-1)/2))**2)
        mask *= smooth((1-radius)/.22)
    for r in range(rows):
        for c in range(cols):
            cell = a[r*fh:(r+1)*fh, c*fw:(c+1)*fw]
            cell[:,:,3] = np.rint(cell[:,:,3].astype(float) * mask).astype('uint8')
    return Image.fromarray(a), mask

def main():
    OUT.mkdir(exist_ok=True)
    manifest = []
    for key in KEYS:
        source = Image.open(ASSETS / f'{key}.webp').convert('RGBA')
        cols = rows = 4 if key == 'gvu_circle_aggr' else 1
        image, _ = derive(source, cols, rows, key in RADIAL)
        # PNG retains RGB even under alpha=0, avoiding WebP transparent-RGB rewriting.
        file = f'/assets/aura/{key}.png'
        image.save(ROOT / 'public' / file.lstrip('/'))
        manifest.append(dict(source=key, key=f'aura_{key}', file=file, width=image.width, height=image.height, cols=cols, rows=rows, mask='radial-smooth' if key in RADIAL else 'edge-smooth', mode='explicit-4x4' if cols > 1 else 'static-full-source'))
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Prepared {len(manifest)} aura-only derivatives; shared originals unchanged')

if __name__ == '__main__':
    main()
