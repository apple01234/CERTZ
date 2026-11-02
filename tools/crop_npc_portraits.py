"""현재 월드 NPC 원본을 그대로 crop한다. 생성/색보정/표정 재합성 없음.
실행: python3 tools/crop_npc_portraits.py (--check는 픽셀 재현 검증만)
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/npcportrait'
world = (ROOT / 'src/game/scenes/WorldScene.ts').read_text()
match = re.search(r'const NPC_BODY_OF[^=]*=\s*\{([\s\S]*?)\n\};', world)
assert match is not None, 'NPC_BODY_OF 매핑이 변경됨: 원본 연결 재확인 필요'
block = match.group(1)
aliases = dict(re.findall(r'(spum_\w+):\s*"(npcbody_\w+)"', block))
# 라고스는 참고 외형이 아니라 현재 월드 npcbody_merchant의 픽셀만 보존한다.
aliases.update({'npc_merchant': 'npcbody_merchant', 'spum_merchant': 'npcbody_merchant'})
manifest = {}
OUT.mkdir(parents=True, exist_ok=True)
for src in sorted((ROOT / 'public/assets/npcbody').glob('*.png')):
    key = src.stem
    im = Image.open(src).convert('RGBA')
    # vc235 (#5 "NPC 초상화 좀 줌 아웃해 얼굴이 너무 크게 보여서 잘려서 보임") —
    # 종전 (20,12,80,72) = 60x60 은 얼굴만 꽉 잡아 턱·머리카락이 잘렸다.
    # 96x96 원본에서 상체까지 담기도록 넓힌다(84x84). 중앙 정렬 유지.
    rect = (6, 6, 90, 90)
    crop = im.crop(rect)
    dest = OUT / f'{key}.png'
    if '--check' in sys.argv:
        actual = Image.open(dest).convert('RGBA')
        assert actual.size == crop.size and actual.tobytes() == crop.tobytes(), key
    else:
        crop.save(dest)
    entry = {'src': f'/assets/npcportrait/{key}.png', 'source': f'/assets/npcbody/{key}.png',
             'crop': list(rect), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest()}
    manifest[key] = entry
    for alias, body in aliases.items():
        if body == key:
            manifest[alias] = entry
# 월드에서 npcbody로 치환하지 않는 특수 인물은 본래 스프라이트에서 crop한다.
for key in ['npc_gm', 'spum_priest']:
    src = ROOT / f'public/assets/{key}.webp'
    if not src.exists():
        continue
    im = Image.open(src).convert('RGBA')
    x0, y0, x1, y1 = im.getbbox()
    side = max(x1 - x0, (y1 - y0 + 1) // 2)
    rect = (max(0, (x0 + x1 - side) // 2), y0, min(im.width, (x0 + x1 + side) // 2), min(im.height, y0 + side))
    crop = im.crop(rect)
    dest = OUT / f'{key}.png'
    if '--check' in sys.argv:
        actual = Image.open(dest).convert('RGBA')
        assert actual.size == crop.size and actual.tobytes() == crop.tobytes(), key
    else:
        crop.save(dest)
    manifest[key] = {'src': f'/assets/npcportrait/{key}.png', 'source': f'/assets/{key}.webp',
                     'crop': list(rect), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest()}
if '--check' in sys.argv:
    assert json.loads((OUT / '_map.json').read_text()) == manifest
else:
    (OUT / '_map.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'ALL CHECKS PASS: {len(set(e["src"] for e in manifest.values()))} crops / {len(manifest)} mapped keys; exact source pixels')
