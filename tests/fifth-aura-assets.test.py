# python3 tests/fifth-aura-assets.test.py
import importlib.util
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_aura', root/'tools/prepare-fifth-aura.py')
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
manifest = json.loads((root/'public/assets/aura/manifest.json').read_text())
assert len(manifest) == len(module.KEYS) == 23
checks = 0
for d in manifest:
    source = root/'public/assets'/f"{d['source']}.webp"
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    a = np.array(Image.open(source).convert('RGBA'))
    b = np.array(Image.open(root/'public'/d['file'].lstrip('/')).convert('RGBA'))
    assert a.shape == b.shape, d['source']
    assert np.array_equal(a[:,:,:3], b[:,:,:3]), f"RGB changed: {d['source']}"
    assert np.all(b[:,:,3] <= a[:,:,3]), 'alpha must never add light'
    fw,fh = d['width']//d['cols'], d['height']//d['rows']
    for r in range(d['rows']):
        for c in range(d['cols']):
            cell = b[r*fh:(r+1)*fh,c*fw:(c+1)*fw,3]
            assert not any((cell[0].any(),cell[-1].any(),cell[:,0].any(),cell[:,-1].any())), d['source']
    expected, mask = module.derive(Image.open(source), d['cols'], d['rows'], d['source'] in module.RADIAL)
    assert np.array_equal(np.array(expected), b), d['source']
    assert np.any((mask>0)&(mask<1)), 'smooth fade required'
    # Full-strength interior keeps exact pre-existing RGB/alpha brightness.
    tiled = np.tile(mask, (d['rows'],d['cols']))
    assert np.array_equal(a[tiled==1],b[tiled==1]), d['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == before
    checks += 1
print(f'ALL CHECKS PASS: {checks} assets; frame edge alpha=0; RGB/resolution/interior brightness exact; smooth mask')
