#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc139 보스 아틀라스 화질 복구 파이프라인
  원인(v1.4.31/vc137): 저해상도 마스터 시트(프레임 ~48px)를 NEAREST ×6~8 비정수 확대 + webp q82
                       → 픽셀 격자 일그러짐 + 압축 뭉개짐 = "화질 ㅈ구림"
  조치:
    A. 고해상 소스 4종 교체 (유저 업로드 원본 크롭 — 원칙 준수)
       surt   ← assets_src/boss_sheets/bsw_surt.webp     (6열×7행, 셀 256×171)
       fenrir ← assets_src/boss_sheets/bsw_fenrir.webp   (6열×7행, 셀 204×183)
       boss2  ← assets_src/boss_sheets/bsw_behemoth.webp (유령선, 6열×7행)
       nidhog ← upload/file_000000007c8c82069f7efbeb11b62fb2.png (수목룡 식물, 10열×6행)
       · bsw 행 순서 [idle,walk,atk,death,sp1,sp2,sp3] → 게임 순서 [idle,walk,atk,sp1,sp2,sp3,die] 리맵
    B. 마스터 유도 5종(boss·boss3·skoll·nagr·hati) — vc137과 동일 기하(프레임 크기/행 구성 보존),
       NEAREST → LANCZOS + 언샵 + q92 (프리멀티지 알파로 체커보드 오염 제거)
  출력: public/assets/atl_*.webp + bossport_*.webp + manifest 갱신 + 검수 프리뷰
"""
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
import json, os

BASE = "/home/z/my-project"
OUT_DIR = f"{BASE}/public/assets"
PREVIEW_DIR = f"{BASE}/scripts/atlas_preview"
MANIFEST = f"{BASE}/scripts/atlas_manifest.json"
MASTER = f"{BASE}/upload/file_0000000091d48206b677615d0d54e2ba.png"

os.makedirs(PREVIEW_DIR, exist_ok=True)
PAD = 10
TARGET_MAX = 320.0        # HD 보스 콘텐츠 최대변 목표 (vc137 300px급 유지)
HD_UPSCAPLE_CAP = 1.5     # HD 소스 과대 확대 방지 (부드러움·용량 절제)
Q_HD, Q_MS, Q_PORT = 80, 78, 88
M_ETH = 5                 # webp 인코더 method (6은 대형 캔버스에서 수십 배 느림)

# ── 프리멀티지 알파 LANCZOS 리사이즈 (배경 오염 RGB가 번지는 것 방지) ──
def premul_resize(im_rgba, tw, th, sharpen_pct=60):
    arr = np.array(im_rgba).astype(np.float32)
    a = arr[..., 3:4] / 255.0
    prem = np.dstack([arr[..., 0] * a[..., 0], arr[..., 1] * a[..., 0], arr[..., 2] * a[..., 0]]).clip(0, 255).astype(np.uint8)
    al = arr[..., 3].clip(0, 255).astype(np.uint8)
    rgb = Image.fromarray(prem, "RGB").resize((max(1, tw), max(1, th)), Image.LANCZOS)
    alp = Image.fromarray(al, "L").resize((max(1, tw), max(1, th)), Image.LANCZOS)
    out = np.dstack([np.array(rgb), np.array(alp)]).astype(np.float32)
    aa = out[..., 3:4] / 255.0
    inv = 1.0 / np.maximum(aa, 1e-3)
    rgbu = (out[..., :3] * inv).clip(0, 255)
    outim = Image.fromarray(np.dstack([rgbu, out[..., 3]]).clip(0, 255).astype(np.uint8))
    if sharpen_pct > 0:
        r_, g_, b_, a_ = outim.split()
        rgb2 = Image.merge("RGB", (r_, g_, b_)).filter(ImageFilter.UnsharpMask(radius=1.3, percent=sharpen_pct, threshold=2))
        outim = Image.merge("RGBA", (*rgb2.split(), a_))
    return outim

def sharpen(im, percent=80):
    """RGB만 언샵 (알파 채널 보존)"""
    r, g, b, a = im.split()
    rgb = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.3, percent=percent, threshold=2))
    r2, g2, b2 = rgb.split()
    return Image.merge("RGBA", (r2, g2, b2, a))

# ── 공용: 프레임 배치 ──
def build_atlas(cells, nrows, fw, fh, scale):
    """cells[r][c] = RGBA 이미지(원본 해상도) → 균일 아틀라스. 하단 중앙 정렬 + LANCZOS"""
    atlas = Image.new("RGBA", (fw * 12, fh * nrows), (0, 0, 0, 0))
    counts = []
    for ri, row in enumerate(cells):
        n = 0
        for ci, cell in enumerate(row[:12]):
            if cell is None:
                continue
            bb = cell.getbbox()
            if not bb:
                continue
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            tw, th = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
            im = premul_resize(cell.crop(bb), tw, th, sharpen_pct=60)
            px = ci * fw + (fw - tw) // 2
            py = ri * fh + (fh - th - 2)
            atlas.alpha_composite(im, (px, py))
            n += 1
        counts.append(n)
    return atlas, counts

def save_portrait(atlas, fw, fh, name):
    port = atlas.crop((0, 0, fw, fh))
    bb = port.getbbox()
    if bb:
        port = port.crop(bb)
    w, h = port.size
    s = 220 / max(w, h)
    if s < 1.0:
        port = premul_resize(port, int(w * s), int(h * s))
    port.save(f"{OUT_DIR}/bossport_{name}.webp", "WEBP", quality=Q_PORT, method=M_ETH)

# ═════════════════ PART A — 고해상 소스 4종 ═════════════════
# bsw 합성 시트 행 순서 [idle,walk,atk,death,sp1,sp2,sp3] → 게임 [idle,walk,atk,sp1,sp2,sp3,die]
BSW_REMAP = [0, 1, 2, 4, 5, 6, 3]
manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}

def slice_uniform(img, x0s, y0s, cw, ch):
    """고정 그리드 슬라이스 → cells[r][c] (내용 없는 셀은 None). y0s는 (y0,y1) 박스 지원"""
    cells = []
    for yb in y0s:
        y0, y1 = (yb, yb + ch - 1) if isinstance(yb, int) else yb
        row = []
        for x0 in x0s:
            cell = img.crop((x0, y0, x0 + cw, y1 + 1))
            a = np.array(cell)[..., 3]
            row.append(cell if (a > 12).sum() > 40 else None)
        cells.append(row)
    return cells

def hd_boss(name, src_path, x0s, y0s, cw, ch, remap, desc):
    img = Image.open(src_path).convert("RGBA")
    cells = slice_uniform(img, x0s, y0s, cw, ch)
    if remap:
        cells = [cells[i] for i in remap]
    max_dim = max(max(c.getbbox()[2] - c.getbbox()[0], c.getbbox()[3] - c.getbbox()[1])
                  for row in cells for c in row if c is not None)
    scale = min(TARGET_MAX / max_dim, HD_UPSCAPLE_CAP)
    scale = max(scale, 1.0)
    max_w = max(c.getbbox()[2] - c.getbbox()[0] for row in cells for c in row if c is not None)
    max_h = max(c.getbbox()[3] - c.getbbox()[1] for row in cells for c in row if c is not None)
    fw = int(np.ceil(max_w * scale)) + PAD
    fh = int(np.ceil(max_h * scale)) + PAD
    fw += fw % 2; fh += fh % 2
    atlas, counts = build_atlas(cells, len(cells), fw, fh, scale)
    out = f"{OUT_DIR}/{name}.webp"
    atlas.save(out, "WEBP", quality=Q_HD, method=M_ETH)
    save_portrait(atlas, fw, fh, name.replace("atl_", ""))
    pv = atlas.resize((max(1, atlas.width // 3), max(1, atlas.height // 3)), Image.LANCZOS)
    pv.save(f"{PREVIEW_DIR}/{name}_all.png")
    kb = os.path.getsize(out) / 1024
    manifest[name] = {"fw": fw, "fh": fh, "nrows": len(cells), "rowNames":
                      (["idle", "walk", "atk", "sp1", "sp2", "sp3", "die"] if len(cells) == 7
                       else ["idle", "walk", "atk", "sp1", "sp2", "die"]),
                      "rowCounts": counts, "kb": round(kb), "desc": desc,
                      "scale": round(scale, 2), "src": os.path.basename(src_path)}
    print(f"[HD] {name}: {fw}x{fh} · {len(cells)}행 {counts} · {kb:.0f}KB · ×{scale:.2f} · {desc}")

# 1) 수르트 — bsw_surt 6열×7행 (실측: x=5+256k w245 / y=4+171k h163)
hd_boss("atl_boss_surt", f"{BASE}/assets_src/boss_sheets/bsw_surt.webp",
        [5 + 256 * i for i in range(6)], [4 + 171 * i for i in range(7)], 256, 171,
        BSW_REMAP, "수르트 — 무스펠 용암골렘(고해상)")

# 2) 펜리르 — bsw_fenrir 6열×7행 (실측: x=4+204k w196 / y 실측행)
hd_boss("atl_boss_fenrir", f"{BASE}/assets_src/boss_sheets/bsw_fenrir.webp",
        [4 + 204 * i for i in range(6)], [(18, 180), (189, 364), (373, 548), (556, 732), (741, 916), (924, 1100), (1108, 1284)], 196, 0,
        BSW_REMAP, "펜리르 — 설원 백랑(고해상)")

# 3) 보스2 — bsw_behemoth 유령선 6열×7행 (균일 그리드 256×171)
hd_boss("atl_boss2", f"{BASE}/assets_src/boss_sheets/bsw_behemoth.webp",
        [256 * i for i in range(6)], [171 * i for i in range(7)], 256, 171,
        BSW_REMAP, "베히모스 — 미드가르드 해적선(고해상 유령선)")

# 4) 니드호그 — 식물 시트 (시트 자체 그리드라인 피팅: 10/11/12열 × 6/7행 후보 중 경계선 밝기 최적)
plant = Image.open(f"{BASE}/upload/file_000000007c8c82069f7efbeb11b62fb2.png").convert("RGBA")
parr = np.array(plant)
PH, PW = parr.shape[:2]
plum = np.array(plant.convert("RGB")).astype(int).mean(axis=2)
colmean = plum.mean(axis=0); rowmean = plum.mean(axis=1)

def fit_grid(means, N):
    """N등분 균일 그리드 가정 — 각 내부 경계 ±6px 내 최대 밝기 위치로 점수화"""
    score, bounds = 0.0, [0]
    for k in range(1, N):
        c = round(k * len(means) / N)
        lo, hi = max(1, c - 6), min(len(means) - 2, c + 6)
        best = lo + int(np.argmax(means[lo:hi + 1]))
        score += float(means[best])
        bounds.append(best)
    bounds.append(len(means))
    return score, bounds

best = None
for nc in (10, 11, 12):
    for nr in (6, 7):
        s_c, cb_ = fit_grid(colmean, nc)
        s_r, rb_ = fit_grid(rowmean, nr)
        tot = s_c / nc + s_r / nr
        if best is None or tot > best[0]:
            best = (tot, cb_, rb_, nc, nr)
_, pcb, prb, PNC, PNR = best
print(f"plant 그리드 피팅: {PNC}열 {PNR}행")
pcells = []
for ri in range(PNR):
    y0 = prb[ri] + (3 if ri else 0)
    y1 = prb[ri + 1] - 3
    row = []
    for ci in range(PNC):
        x0 = pcb[ci] + (3 if ci else 0)
        x1 = pcb[ci + 1] - 3
        cell = plant.crop((x0, y0, x1 + 1, y1 + 1))
        a = np.array(cell)[..., 3]
        row.append(cell if (a > 12).sum() > 40 else None)
    pcells.append(row)
# 행 순서 [idle,walk,atk,sp1,sp2,die] — 게임 6행 구성과 동일 (리맵 불필요)
max_dim = max(max(c.getbbox()[2] - c.getbbox()[0], c.getbbox()[3] - c.getbbox()[1])
              for row in pcells for c in row if c is not None)
scale = max(1.0, min(TARGET_MAX / max_dim, HD_UPSCAPLE_CAP))
max_w = max(c.getbbox()[2] - c.getbbox()[0] for row in pcells for c in row if c is not None)
max_h = max(c.getbbox()[3] - c.getbbox()[1] for row in pcells for c in row if c is not None)
fw = int(np.ceil(max_w * scale)) + PAD; fh = int(np.ceil(max_h * scale)) + PAD
fw += fw % 2; fh += fh % 2
atlas, counts = build_atlas(pcells, len(pcells), fw, fh, scale)
out = f"{OUT_DIR}/atl_boss_nidhog.webp"
atlas.save(out, "WEBP", quality=Q_HD, method=M_ETH)
save_portrait(atlas, fw, fh, "boss_nidhog")
pv = atlas.resize((max(1, atlas.width // 3), max(1, atlas.height // 3)), Image.LANCZOS)
pv.save(f"{PREVIEW_DIR}/atl_boss_nidhog_all.png")
kb = os.path.getsize(out) / 1024
manifest["atl_boss_nidhog"] = {"fw": fw, "fh": fh, "nrows": len(pcells),
                               "rowNames": (["idle", "walk", "atk", "sp1", "sp2", "sp3", "die"] if len(pcells) == 7
                                            else ["idle", "walk", "atk", "sp1", "sp2", "die"]),
                               "rowCounts": counts, "kb": round(kb),
                               "desc": "니드호그 — 알프헤임 수목룡(고해상)", "scale": round(scale, 2),
                               "src": "file_000000007c8c8206.png"}
print(f"[HD] atl_boss_nidhog: {fw}x{fh} · {len(pcells)}행 {counts} · {kb:.0f}KB · ×{scale:.2f}")

# ═════════════════ PART B — 마스터 유도 5종 (vc137 기하 보존 + LANCZOS) ═════════════════
SRC = MASTER
img = Image.open(SRC).convert("RGB")
W, H = img.size
arr = np.array(img).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
bg_like = ((mx - mn) <= 16) & (mx >= 195)
# 배경 = bg_like 중 테두리와 연결된 성분 (scipy 라벨링 — BFS 대비 수백 배 빠름)
from scipy import ndimage as _ndi
_lbl, _n = _ndi.label(bg_like)
_border = set(_lbl[0, :]) | set(_lbl[-1, :]) | set(_lbl[:, 0]) | set(_lbl[:, -1])
_border.discard(0)
bg = (bg_like & np.isin(_lbl, list(_border))) if _border else np.zeros_like(bg_like)
for _ in range(2):
    adj = np.roll(bg, 1, 0) | np.roll(bg, -1, 0) | np.roll(bg, 1, 1) | np.roll(bg, -1, 1)
    bg = bg | (adj & bg_like)

def gutters(proj, min_w=2):
    out, in_g, gs = [], False, 0
    for i, v in enumerate(proj):
        if not v:
            if not in_g: gs, in_g = i, True
        else:
            if in_g:
                out.append((gs, i - 1)); in_g = False
    if in_g: out.append((gs, len(proj) - 1))
    return [(a, b_) for a, b_ in out if b_ - a + 1 >= min_w]

def spans_from_gutters(gl, total):
    spans, prev = [], 0
    for a, b_ in gl:
        if a > prev: spans.append((prev, a))
        prev = b_ + 1
    if prev < total: spans.append((prev, total))
    return spans

def row_bands(blk, BW):
    alpha_ = blk[..., 3]
    density = alpha_.sum(axis=1) / (255 * BW)
    thr = 0.010
    empty = density <= thr
    rg, in_g, gs = [], False, 0
    for i, e in enumerate(empty):
        if e:
            if not in_g: gs, in_g = i, True
        else:
            if in_g:
                if i - gs >= 2: rg.append((gs, i - 1))
                in_g = False
    if in_g and len(empty) - gs >= 2: rg.append((gs, len(empty) - 1))
    bands = spans_from_gutters(rg, len(density))
    bands = [(a, b_) for a, b_ in bands if b_ - a + 1 >= 18]
    if len(bands) in (6, 7):
        return bands
    best = None
    for n in (7, 6):
        bounds = [round(k * len(density) / n) for k in range(n + 1)]
        score = sum(density[max(0, b_ - 1):b_ + 2].sum() for b_ in bounds[1:-1])
        if best is None or score < best[0]:
            best = (score, [(bounds[k], bounds[k + 1] - 1) for k in range(n)])
    return best[1]

XBANDS = [(15, 522), (567, 1072), (1121, 1623)]
YBANDS = [(11, 328), (352, 676), (695, 949)]
TARGET_CONTENT = 300.0
SCALE_MIN, SCALE_MAX = 4.0, 5.6   # vc137 8.0 → 5.6 (용량·연화 절제, 콘텐츠 ~260px)

MASTER_SHEETS = [
    ("atl_boss",      (2, 2), "심연의 수호자 — 스바르트 흑마수(LANCZOS 개선)"),
    ("atl_boss3",     (2, 0), "심연의 군주 — 헬 악마(LANCZOS 개선)"),
    ("atl_boss_skoll",(1, 2), "스콜 — 얼음 봉황(LANCZOS 개선)"),
    ("atl_boss_nagr", (2, 1), "발할라 천사기사(LANCZOS 개선)"),
    ("atl_boss_hati", (0, 2), "하티 — 스콜 트윈 화염 늑대(LANCZOS 개선)"),
]

for name, (br, bc), desc in MASTER_SHEETS:
    x0, x1 = XBANDS[bc]; y0, y1 = YBANDS[br]
    blk = np.dstack([arr[y0:y1, x0:x1].astype(np.uint8),
                     np.where(bg[y0:y1, x0:x1], 0, 255).astype(np.uint8)])
    BH, BW = blk.shape[:2]
    rows = row_bands(blk, BW)
    nrows = len(rows)
    row_names = (["idle", "walk", "atk", "sp1", "sp2", "sp3", "die"] if nrows == 7
                 else ["idle", "walk", "atk", "sp1", "sp2", "die"] if nrows == 6
                 else [f"r{i}" for i in range(nrows)])
    row_cells, all_pitches, raw_rows = [], [], []
    for ra, rb in rows:
        band = blk[ra:rb + 1]
        cg = gutters(band[..., 3].any(axis=0), 2)
        sp = spans_from_gutters(cg, BW)
        sp = [(a, b_) for a, b_ in sp if b_ - a + 1 >= 8]
        raw_rows.append(sp)
        for a, b_ in sp: all_pitches.append(b_ - a + 1)
    med = float(np.median(all_pitches)) if all_pitches else BW / 12
    for sp in raw_rows:
        fixed = []
        for a, b_ in sp:
            w = b_ - a + 1
            k = int(round(w / med))
            if k >= 2:
                step = w / k
                for i in range(k):
                    fixed.append((int(round(a + i * step)), int(round(a + (i + 1) * step)) - 1))
            else:
                fixed.append((a, b_))
        row_cells.append(fixed)
    ncols = max(len(rc) for rc in row_cells)
    scale = max(SCALE_MIN, min(SCALE_MAX, TARGET_CONTENT / max(med, 1)))
    max_cw = max(b_ - a + 1 for rc in row_cells for a, b_ in rc)
    max_ch = max(rb - ra + 1 for (ra, rb) in rows)
    fw = int(np.ceil(max_cw * scale)) + PAD
    fh = int(np.ceil(max_ch * scale)) + PAD
    fw += fw % 2; fh += fh % 2
    atlas = Image.new("RGBA", (fw * 12, fh * nrows), (0, 0, 0, 0))
    row_counts = []
    for ri, ((ra, rb), cells) in enumerate(zip(rows, row_cells)):
        band_h = rb - ra + 1
        n = 0
        for ci, (ca, cb) in enumerate(cells[:12]):
            cell = blk[ra:rb + 1, ca:cb + 1]
            a = cell[..., 3]
            if (a > 12).sum() < 40:
                continue
            w = cb - ca + 1
            tw = max(1, int(round(w * scale)))
            th = max(1, int(round(band_h * scale)))
            im = premul_resize(Image.fromarray(cell), tw, th, sharpen_pct=50)
            px = ci * fw + (fw - tw) // 2
            py = ri * fh + (fh - th - 2)
            atlas.alpha_composite(im, (px, py))
            n += 1
        row_counts.append(n)
    out = f"{OUT_DIR}/{name}.webp"
    atlas.save(out, "WEBP", quality=Q_MS, method=M_ETH)
    save_portrait(atlas, fw, fh, name.replace("atl_", ""))
    pv = atlas.resize((max(1, atlas.width // 3), max(1, atlas.height // 3)), Image.LANCZOS)
    pv.save(f"{PREVIEW_DIR}/{name}_all.png")
    kb = os.path.getsize(out) / 1024
    old = manifest.get(name, {})
    manifest[name] = {"fw": fw, "fh": fh, "nrows": nrows, "rowNames": row_names,
                      "rowCounts": row_counts, "kb": round(kb), "desc": desc,
                      "scale": round(scale, 2)}
    print(f"[MS] {name}: {fw}x{fh} · {nrows}행 {row_counts} · {kb:.0f}KB · ×{scale:.2f} · {desc}")

with open(MANIFEST, "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print("manifest saved")
