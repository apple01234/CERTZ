#!/usr/bin/env python3
# vc142 보스 디자인 교체 슬라이서 (최종)
# 유저 아틀라스(12FPS · idle/run/attack/died/sp1/sp2/sp3) → 게임 아틀라스
# (12열 고정 · idle/walk/atk/sp1/sp2/sp3/die) — 셀 기준 배치 + jorm 거터 검출
from PIL import Image, ImageFilter
import numpy as np
import os, json

UP = '/home/z/my-project/upload'
ASSETS = '/home/z/my-project/public/assets'
PREVIEW = '/home/z/my-project/scripts/atlas_preview'
os.makedirs(PREVIEW, exist_ok=True)

SHEETS = [
    dict(src='요툰헤임.png',  tex='boss',        split=None, mirror_frames=False, rows=7, note='수정골렘→심연의 수호자'),
    dict(src='헬.png',        tex='boss3',       split=None, mirror_frames=False, rows=7, note='헬→심연의 군주'),
    dict(src='스콜&하티.png', tex='boss_skoll',  split='L',  mirror_frames=False, rows=7, note='얼음늑대→스콜'),
    dict(src='스콜&하티.png', tex='boss_hati',   split='R',  mirror_frames=False, rows=7, note='화염늑대→하티'),
    dict(src='file_00000000c8fc8206a70cd9c7ea2a8359.png', tex='boss_fenrir', split=None, mirror_frames=False, rows=7, note='니플헤임 얼음수→펜리르'),
    dict(src='file_000000004a5482069531efe87ab73ca2.png', tex='boss_jorm',   split=None, mirror_frames=False, rows=6, gutter=True, note='녹룡→요르문간드(6행 — sp3 없음)'),
]
COLS = 8
TARGET_W = 292
PAD_X, PAD_Y = 6, 8
MIN_PIX = 60

def detect_row_bands(mask, exp):
    proj = mask.sum(axis=1)
    H = len(proj)
    bands, s = [], None
    for y in range(H):
        if proj[y] > 6 and s is None: s = y
        elif proj[y] <= 6 and s is not None:
            if y - s >= 40: bands.append([s, y])
            s = None
    if s is not None and H - s >= 40: bands.append([s, H])
    while len(bands) < exp:
        heights = [b - a for a, b in bands]
        idx = int(np.argmax(heights))
        a, b = bands[idx]
        if (b - a) < 150: break
        seg = proj[a:b]
        lo, hi = int((b - a) * 0.30), int((b - a) * 0.70)
        inner = seg[lo:hi]
        if len(inner) == 0: break
        cut = a + lo + int(np.argmin(inner))
        bands[idx] = [a, cut]
        bands.insert(idx + 1, [cut, b])
    return bands

def trim_edge_slivers(sub):
    h, w = sub.shape
    for _ in range(6):
        if w <= 24: break
        if sub[:, :3].sum() < 12: sub = sub[:, 3:]
        elif sub[:, -3:].sum() < 12: sub = sub[:, :-3]
        else: break
        w = sub.shape[1]
    for _ in range(4):
        if sub.shape[0] <= 24: break
        if sub[:3, :].sum() < 12: sub = sub[3:, :]
        else: break
    return sub

def process(cfg):
    im = Image.open(os.path.join(UP, cfg['src'])).convert('RGBA')
    W, H = im.size
    mask = np.array(im.getchannel('A')) > 12
    bands = detect_row_bands(mask, cfg['rows'])
    nrows = len(bands)

    if cfg['split'] == 'L':   x0, x1, ncol = 0, W // 2, COLS // 2
    elif cfg['split'] == 'R': x0, x1, ncol = W // 2, W, COLS // 2
    else:                     x0, x1, ncol = 0, W, COLS
    cw = (x1 - x0) / ncol

    rows_frames, row_cells = [], []
    for (by0, by1) in bands:
        frames, cells = [], []
        if cfg.get('gutter'):
            proj = mask[by0:by1].sum(axis=0)
            segs, s = [], None
            for x in range(x0, x1):
                if proj[x] > 3 and s is None: s = x
                elif proj[x] <= 3 and s is not None:
                    if x - s > 30: segs.append((s, x))
                    s = None
            if s is not None and x1 - s > 30: segs.append((s, x1))
            for (sx0, sx1) in segs:
                sub = mask[by0:by1, sx0:sx1]
                ys, xs = np.where(sub)
                if len(xs) < MIN_PIX: continue
                frames.append((sx0 + int(xs.min()), by0 + int(ys.min()),
                               sx0 + int(xs.max()) + 1, by0 + int(ys.max()) + 1))
                cells.append((sx0, sx1))
        else:
            for c in range(ncol):
                cx0, cx1 = int(x0 + c * cw), int(x0 + (c + 1) * cw)
                sub = mask[by0:by1, cx0:cx1]
                ys, xs = np.where(sub)
                if len(xs) < MIN_PIX:
                    frames.append(None); cells.append(None)
                    continue
                frames.append((cx0 + int(xs.min()), by0 + int(ys.min()),
                               cx0 + int(xs.max()) + 1, by0 + int(ys.max()) + 1))
                cells.append((cx0, cx1))
        rows_frames.append(frames); row_cells.append(cells)

    max_content_w = 0
    max_band_h = max(b - a for a, b in bands)
    for frames in rows_frames:
        for f in frames:
            if f: max_content_w = max(max_content_w, f[2] - f[0])
    scale = min(1.9, max(1.0, TARGET_W / max_content_w))
    GW = int((cw if not cfg.get('gutter') else max_content_w) * scale) + PAD_X * 2
    GH = int(max_band_h * scale) + PAD_Y * 2

    atlas_order = [0, 1, 2, 4, 5, 6, 3] if nrows == 7 else [0, 1, 2, 4, 5, 3]
    canvas_rows = max(atlas_order) + 1  # 빈행 → 팬텀 프레임 방지

    canvas = Image.new('RGBA', (GW * 12, GH * canvas_rows), (0, 0, 0, 0))
    counts = []
    for arow, srow in enumerate(atlas_order):
        frames, cells = rows_frames[srow], row_cells[srow]
        by0, by1 = bands[srow]
        n = 0
        for i, f in enumerate(frames):
            if not f or i >= 12: continue
            fx0, fy0, fx1, fy1 = f
            cx0, cx1 = cells[i]
            sub = mask[fy0:fy1, fx0:fx1]
            sub_t = trim_edge_slivers(sub)
            dleft = int(np.where(sub_t.sum(axis=0) > 0)[0].min()) if sub_t.size else 0
            ncrop = im.crop((fx0 + dleft, fy0, fx0 + dleft + sub_t.shape[1], fy0 + sub_t.shape[0]))
            if cfg['mirror_frames']:
                ncrop = ncrop.transpose(Image.FLIP_LEFT_RIGHT)
            nw, nh = max(1, round(ncrop.width * scale)), max(1, round(ncrop.height * scale))
            ncrop = ncrop.resize((nw, nh), Image.LANCZOS)
            ncrop = ncrop.filter(ImageFilter.UnsharpMask(radius=1.2, percent=52, threshold=2))
            fcx = fx0 + dleft + sub_t.shape[1] / 2
            ccx = (cx0 + cx1) / 2
            dx = round((fcx - ccx) * scale) * (-1 if cfg['mirror_frames'] else 1)
            if cfg.get('gutter'):
                dx = 0
            off_bottom = round((by1 - fy1) * scale)
            X = i * GW + GW // 2 + dx - nw // 2
            Y = arow * GH + GH - off_bottom - nh
            canvas.alpha_composite(ncrop, (max(0, X), max(0, Y)))
            n += 1
        counts.append(n)

    out = os.path.join(ASSETS, f'atl_{cfg["tex"]}.webp')
    assert canvas.width <= 16383 and canvas.height <= 16383, f'{cfg["tex"]} canvas {canvas.size}'
    canvas.save(out, 'WEBP', quality=84, method=5)
    print(f"[{cfg['tex']}] {cfg['note']} — 프레임 {GW}x{GH} (scale {scale:.2f}) counts={counts}")

    pv = canvas.copy(); pv.thumbnail((1500, 1500), Image.LANCZOS)
    pv.save(f'{PREVIEW}/vc142_{cfg["tex"]}_all.png')

    idle = [f for f in rows_frames[0] if f]
    if idle:
        f = max(idle, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        crop = im.crop(f)
        if cfg['mirror_frames']:
            crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
        h = 220
        w = max(1, round(crop.width * h / crop.height))
        crop = crop.resize((w, h), Image.LANCZOS)
        crop.save(os.path.join(ASSETS, f'bossport_{cfg["tex"]}.webp'), 'WEBP', quality=86, method=5)
    return dict(tex=cfg['tex'], fw=GW, fh=GH, counts=counts, file=f'atl_{cfg["tex"]}.webp')

results = [process(cfg) for cfg in SHEETS]
print('\n═══ BOSS_ATLAS ═══')
for r in results:
    print(f'  {r["tex"]:12s}{{ key: "atl_{r["tex"]}", file: "atl_{r["tex"]}.webp", fw: {r["fw"]}, fh: {r["fh"]} }},')
print('═══ BOSS_ATLAS_ROWS ═══')
for r in results:
    print(f'  {r["tex"]:12s}{json.dumps(r["counts"])},')
json.dump(results, open('/home/z/my-project/scripts/vc142_slicer_result.json', 'w'), indent=1)
