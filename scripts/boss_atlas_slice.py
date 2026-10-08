#!/usr/bin/env python3
"""
보스 아틀라스 최종 파이프라인 (v1.4.31 #4)
  · 블록 경계: 실측 빈 밴드 기반
  · 행: 블록별 가로 투영 거터 (7행 또는 6행 자동)
  · 열: 행별 세로 투영 거터 + 중앙값 피치 보간 (10~12열 자동)
  · 바닥선 정렬: 프레임 하단 기준 붙임 → 발 위치 프레임 간 일치
  · 균일 스케일(블록당) → 프레임 간 크기 일관
출력: public/assets/atl_*.webp + manifest + 전 행 프리뷰
"""
from PIL import Image
import numpy as np
from collections import deque
import json, os

SRC = "/home/z/my-project/upload/file_0000000091d48206b677615d0d54e2ba.png"
OUT_DIR = "/home/z/my-project/public/assets"
PREVIEW_DIR = "/home/z/my-project/scripts/atlas_preview"
os.makedirs(PREVIEW_DIR, exist_ok=True)

SHEETS = [
    ("atl_boss_nidhog", (0, 0), "니드호그=알프헤임 수목룡"),
    ("atl_boss_fenrir", (0, 1), "펜리르=설원 백랑(빙결)"),
    ("atl_boss_hati",   (0, 2), "하티=스콜 트윈(화염)"),
    ("atl_boss2",       (1, 0), "베히모스=미드가르드 해적선"),
    ("atl_boss_surt",   (1, 1), "수르트=무스펠 용암골렘"),
    ("atl_boss_skoll",  (1, 2), "스콜=얼음 봉황"),
    ("atl_boss3",       (2, 0), "심연의 군주=헬 악마"),
    ("atl_boss_nagr",   (2, 1), "발할라 천사기사"),
    ("atl_boss",        (2, 2), "심연의 수호자=스바르트 흑마수"),
]
XBANDS = [(15, 522), (567, 1072), (1121, 1623)]
YBANDS = [(11, 328), (352, 676), (695, 949)]
TARGET_CONTENT = 300.0
SCALE_MIN, SCALE_MAX = 4.0, 8.0
PAD = 10

# ── 배경 제거 ──────────────────────────────────────────
img = Image.open(SRC).convert("RGB")
W, H = img.size
arr = np.array(img).astype(int)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
bg_like = ((mx - mn) <= 16) & (mx >= 195)
bg = np.zeros((H, W), dtype=bool); dq = deque()
for x in range(W):
    for y in (0, H - 1):
        if bg_like[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if bg_like[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
while dq:
    y, x = dq.popleft()
    for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
        if 0 <= ny < H and 0 <= nx < W and bg_like[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; dq.append((ny, nx))
for _ in range(2):
    adj = np.roll(bg,1,0)|np.roll(bg,-1,0)|np.roll(bg,1,1)|np.roll(bg,-1,1)
    bg = bg | (adj & bg_like)

def gutters(proj, min_w=2):
    """빈 구간 목록 [(start,end)]"""
    out, in_g, gs = [], False, 0
    for i, v in enumerate(proj):
        if not v:
            if not in_g: gs, in_g = i, True
        else:
            if in_g:
                out.append((gs, i - 1)); in_g = False
    if in_g: out.append((gs, len(proj) - 1))
    return [(a, b_) for a, b_ in out if b_ - a + 1 >= min_w]

def row_bands(blk, BW):
    """행 밴드 검출: 밀도 기반 거터 → 6/7행 아니면 균일 그리드 폴백"""
    alpha = blk[..., 3]
    density = alpha.sum(axis=1) / (255 * BW)  # 행당 콘텐츠 밀도 (0~1)
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
    # 폴백: 7행 vs 6행 균일 그리드 — 경계 밀도 총합이 낮은 쪽
    best = None
    for n in (7, 6):
        bounds = [round(k * len(density) / n) for k in range(n + 1)]
        score = sum(density[max(0, b_ - 1):b_ + 2].sum() for b_ in bounds[1:-1])
        if best is None or score < best[0]:
            best = (score, [(bounds[k], bounds[k + 1] - 1) for k in range(n)])
    return best[1]

def spans_from_gutters(gl, total):
    """거터 사이 스팬 목록"""
    spans = []
    prev = 0
    for a, b_ in gl:
        if a > prev: spans.append((prev, a))
        prev = b_ + 1
    if prev < total: spans.append((prev, total))
    return spans

manifest = {}
for name, (br, bc), desc in SHEETS:
    x0, x1 = XBANDS[bc]; y0, y1 = YBANDS[br]
    blk = np.dstack([arr[y0:y1, x0:x1].astype(np.uint8), np.where(bg[y0:y1, x0:x1], 0, 255).astype(np.uint8)])
    BH, BW = blk.shape[:2]

    # ── 행 밴드 ──
    rows = row_bands(blk, BW)
    nrows = len(rows)
    # 행 의미: 7행=idle,run,atk,sp1,sp2,sp3,die / 6행=sp3 없음
    row_names = (["idle","walk","atk","sp1","sp2","sp3","die"] if nrows == 7
                 else ["idle","walk","atk","sp1","sp2","die"] if nrows == 6
                 else [f"r{i}" for i in range(nrows)])

    # ── 셀 슬라이스 (행별 열 검출) ──
    row_cells = []  # [(row_name, [(x0,x1)])]
    all_pitches = []
    raw_rows = []
    for ra, rb in rows:
        band = blk[ra:rb+1]
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
            if k >= 2:  # 넓은 스팬 → 균등 분할 (스프라이트 접촉으로 거터 소실)
                step = w / k
                for i in range(k):
                    fixed.append((int(round(a + i * step)), int(round(a + (i + 1) * step)) - 1))
            else:
                fixed.append((a, b_))
        row_cells.append(fixed)

    ncols = max(len(rc) for rc in row_cells)
    # 프레임 크기: 블록 최대 셀 크기 기준
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
        n = len(cells)
        row_counts.append(n)
        for ci, (ca, cb) in enumerate(cells[:12]):
            cell = blk[ra:rb+1, ca:cb+1]
            w = cb - ca + 1
            tw = max(1, int(round(w * scale)))
            th = max(1, int(round(band_h * scale)))
            im = Image.fromarray(cell).resize((tw, th), Image.NEAREST)
            # 하단 중앙 정렬 (바닥선 일치)
            px = ci * fw + (fw - tw) // 2
            py = ri * fh + (fh - th - 2)
            atlas.paste(im, (px, py), im)

    out = f"{OUT_DIR}/{name}.webp"
    atlas.save(out, "WEBP", quality=82, method=6)
    # 초상화 (idle 0프레임 — 대화창·도감용, 220px)
    port = atlas.crop((0, 0, fw, fh))
    ps = 220 / max(fw, fh)
    port = port.resize((int(fw * ps), int(fh * ps)), Image.NEAREST)
    pbg = Image.new("RGBA", port.size, (0, 0, 0, 0))
    pbg.paste(port, (0, 0), port)
    pbg.save(f"{OUT_DIR}/bossport_{name.replace('atl_', '')}.webp", "WEBP", quality=85, method=6)
    # 프리뷰: 전 행 1/3 축소
    pv = atlas.resize((atlas.width // 3, atlas.height // 3), Image.NEAREST)
    pv.save(f"{PREVIEW_DIR}/{name}_all.png")
    kb = os.path.getsize(out) / 1024
    manifest[name] = {"fw": fw, "fh": fh, "nrows": nrows, "rowNames": row_names,
                      "rowCounts": row_counts, "kb": round(kb), "desc": desc, "scale": round(scale, 2)}
    print(f"{name}: {fw}x{fh} · {nrows}행 {row_counts} · {kb:.0f}KB · {desc}")

with open("/home/z/my-project/scripts/atlas_manifest.json", "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print("manifest saved")
