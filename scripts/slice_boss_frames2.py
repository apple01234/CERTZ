#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
보스 전면 리메이크 2차 — 원본 시트(불규칙 격자) → 투영 기반 프레임 검출 → 개별 프레임 출력

입력: scripts/boss_raw3/<key>_raw.png (1024x1024, 흰 배경, AI 격자 불규칙)
출력:
  - public/assets/{tex}_{anim}{i}.webp   (anim: idle/walk/atk/die, i=0..5 — 기존 게임 로딩명 유지)
  - public/assets/{tex}_sp{n}_{i}.webp   (특수기술 1~3, i=0..5 — 신규)
  - /tmp/bossbuild2/<key>_montage.jpg    (검증용 몽타주)
셀: 240x180 균일, 보스별 단일 스케일(사망 축소 연출 보존), 하단 중앙 정렬
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os, sys

RAW = "/home/z/my-project/scripts/boss_raw3"
PUB = "/home/z/my-project/public/assets"
MON = "/tmp/bossbuild2"
os.makedirs(MON, exist_ok=True)

CELL_W, CELL_H = 240, 180
N_FRAMES = 6

TEXMAP = {
    "guardian": "boss", "behemoth": "boss2", "abysslord": "boss3",
    "nidhog": "boss_nidhog", "surt": "boss_surt", "fenrir": "boss_fenrir",
    "skoll": "boss_skoll", "gram": "boss_gram", "abudditos": "boss_abudditos",
    "vord": "boss_vord", "jorm": "boss_jorm", "nagr": "boss_nagr",
}

# 보스별 기하 설정: 실제 시트의 행 수 (검토 기반)
N_ROWS = {
    "nidhog": 4, "jorm": 4, "surt": 5, "skoll": 5,
    "gram": 5, "nagr": 4, "guardian": 4, "abysslord": 4,
    "behemoth": 4, "abudditos": 3, "vord": 3,
}

# 재빌드 제외 (기존 아트 유지)
SKIP = {"fenrir"}

# 행 경계 수동 오버라이드 (검토 몽타주 기반 — 자동 검출이 깨지는 시트용)
ROWS_OVERRIDE = {
    "surt": [0, 230, 445, 665, 925, 1024],
    "skoll": [0, 232, 455, 672, 890, 1024],
    "nagr": [0, 265, 530, 795, 1024],
    "vord": [0, 335, 665, 1024],
    "behemoth": [0, 330, 660, 880, 1024],
}

# 행별 셀 수 수동 오버라이드 (프레임 접촉으로 x-투영 실패 시 균등 분할)
COLS_OVERRIDE = {
    "nagr": {0: 6, 1: 6, 2: 6, 3: 6},
    "vord": {0: 4, 1: 4, 2: 4},
    "behemoth": {0: 4, 1: 4, 2: 4, 3: 4},
}

# 행→애니 매핑 (행 인덱스, None=폴백) — 몽타주 검토 기반 확정
ROWMAP = {
    "nidhog":     {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 3, "sp2": 3, "sp3": 2},
    "jorm":       {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 3, "sp2": 3, "sp3": 3},
    "behemoth":   {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 3, "sp2": 2, "sp3": 3},
    "surt":       {"idle": 0, "walk": 1, "atk": 2, "die": 4, "sp1": 3, "sp2": 2, "sp3": 1},
    "skoll":      {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 4, "sp2": 3, "sp3": 4},
    "gram":       {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 4, "sp2": 3, "sp3": 4},
    "nagr":       {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 2, "sp2": 3, "sp3": 1},
    "guardian":   {"idle": 0, "walk": None, "atk": 2, "die": None, "sp1": 1, "sp2": 3, "sp3": 2},
    "abysslord":  {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 3, "sp2": 3, "sp3": 3},
    "abudditos":  {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 2, "sp2": 1, "sp3": 2},
    "vord":       {"idle": 0, "walk": 1, "atk": 2, "die": None, "sp1": 1, "sp2": 2, "sp3": 0},
}

# (행, 셀) 제외 — 이펙트 전용 셀 등 (검토 후 보강)
CELL_EXCLUDE = {}


def white_to_alpha(im: Image.Image, thr: int = 228) -> np.ndarray:
    """가장자리 연결 근백색 플러드필 → 알파화 (캐릭터 내부 흰색 보존)"""
    rgba = np.array(im.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3].astype(np.int16)
    near_white = (rgb.min(axis=-1) >= thr)
    lbl, _ = ndimage.label(near_white)
    border_labels = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]])))
    border_labels.discard(0)
    mask = np.isin(lbl, list(border_labels))
    rgba[..., 3] = np.where(mask, 0, rgba[..., 3])
    weak = (rgba[..., 3] < 60) & near_white
    rgba[..., 3][weak] = 0
    return rgba


def row_bands(alpha: np.ndarray, n_rows: int, gap: int = 7, min_h: int = 36):
    """y-투영 → n_rows개 행 밴드. 과소 밴드 병합 → 병합 밴드 균등 분할(스냅) → 행수 보정"""
    proj = (alpha > 30).sum(axis=1)
    bands, start, empty = [], None, 0
    for y, v in enumerate(proj):
        if v > 4:
            if start is None:
                start = y
            empty = 0
        else:
            if start is not None:
                empty += 1
                if empty >= gap:
                    if y - empty + 1 - start >= min_h:
                        bands.append([start, y - empty + 1])
                    start, empty = None, 0
    if start is not None and len(proj) - start >= min_h:
        bands.append([start, len(proj)])
    if not bands:
        return [(0, len(proj))]

    # 1) 과소 밴드(중앙값의 0.5배 미만) → 인접 밴드에 병합 (행 내부 공백선 오분할 제거)
    hs = sorted(b[1] - b[0] for b in bands)
    med = hs[len(hs) // 2]
    changed = True
    while changed and len(bands) > 1:
        changed = False
        for i, b in enumerate(bands):
            if b[1] - b[0] < med * 0.5:
                if i == 0:
                    bands[1][0] = b[0]
                else:
                    bands[i - 1][1] = b[1]
                bands.pop(i)
                changed = True
                break

    # 2) 병합 밴드 균등 분할로 총 행수 맞추기 + 분할점 스냅(국소 최솟값)
    need = n_rows - len(bands)
    if need > 0:
        sizes = sorted(((b[1] - b[0], i) for i, b in enumerate(bands)), reverse=True)
        for _, i in sizes[:need]:
            y0, y1 = bands[i]
            h = y1 - y0
            parts = max(2, round(h / med))
            step = h / parts
            newb = []
            for p in range(parts):
                a, c = int(y0 + p * step), int(y0 + (p + 1) * step)
                if p > 0:  # 내부 분할점: ±25% 창에서 y-투영 국소 최솟값으로 스냅
                    win = int(step * 0.25)
                    lo, hi = max(a - win, y0 + min_h), min(c + win, y1 - min_h)
                    if hi > lo:
                        seg = proj[lo:hi]
                        a = lo + int(np.argmin(seg))
                newb.append([a, c])
            bands = bands[:i] + newb + bands[i + 1:]
            if len(bands) >= n_rows:
                break
        bands.sort(key=lambda b: b[0])
    while len(bands) > n_rows:
        idx = min(range(len(bands)), key=lambda i: bands[i][1] - bands[i][0])
        if idx == 0:
            bands[1][0] = bands[0][0]; bands.pop(0)
        else:
            bands[idx - 1][1] = bands[idx][1]; bands.pop(idx)
    return [(a, b) for a, b in bands]


def frame_clusters(alpha: np.ndarray, y0: int, y1: int, gap: int = 6, min_w: int = 30):
    """행 밴드 내 x-투영 → 프레임 클러스터 [(x0,x1), ...]"""
    proj = (alpha[y0:y1] > 30).sum(axis=0)
    clusters, start, empty = [], None, 0
    for x, v in enumerate(proj):
        if v > 1:
            if start is None:
                start = x
            empty = 0
        else:
            if start is not None:
                empty += 1
                if empty >= gap:
                    if x - empty + 1 - start >= min_w:
                        clusters.append([start, x - empty + 1])
                    start, empty = None, 0
    if start is not None and len(proj) - start >= min_w:
        clusters.append([start, len(proj)])
    # 과대 클러스터 서브분할 (프레임 접촉/이펙트 브리지 대응)
    # 기준 폭: 중앙값 클러스터폭 vs 행높이 기반 기대폭 중 큰 값
    if clusters:
        ws = sorted(c[1] - c[0] for c in clusters)
        med_w = ws[len(ws) // 2]
        row_h = y1 - y0
        expect = max(med_w, row_h * 0.62)
        out = []
        for c in clusters:
            w = c[1] - c[0]
            if w > expect * 1.45:
                parts = max(2, round(w / expect))
                step = w / parts
                for p in range(parts):
                    out.append([int(c[0] + p * step), int(c[0] + (p + 1) * step)])
            else:
                out.append(c)
        clusters = out
    return clusters


def pick_six(clusters, exclude=None):
    """클러스터 → 6프레임 (사이클 패딩)"""
    exclude = exclude or set()
    cl = [c for i, c in enumerate(clusters) if i not in exclude]
    n = len(cl)
    if n == 0:
        return []
    if n >= N_FRAMES:
        idx = np.linspace(0, n - 1, N_FRAMES).round().astype(int)
        return [cl[i] for i in idx]
    return [cl[i % n] for i in range(N_FRAMES)]


def slice_boss(key: str, alpha_thr: int = 228):
    path = f"{RAW}/{key}_raw.png"
    if not os.path.exists(path):
        print(f"!! 원본 없음: {key}")
        return None
    im = Image.open(path).convert("RGB")
    rgba = white_to_alpha(im, alpha_thr)
    alpha = rgba[..., 3]
    if key in ROWS_OVERRIDE:
        bs = ROWS_OVERRIDE[key]
        bands = [(bs[i], bs[i + 1]) for i in range(len(bs) - 1)]
    else:
        bands = row_bands(alpha, N_ROWS[key])
    rows = []
    for ri, (y0, y1) in enumerate(bands):
        if key in COLS_OVERRIDE and ri in COLS_OVERRIDE[key]:
            n = COLS_OVERRIDE[key][ri]
            step = 1024 / n
            cl = [[int(c * step), int((c + 1) * step)] for c in range(n)]
        else:
            cl = frame_clusters(alpha, y0, y1)
        rows.append({"y": (y0, y1), "clusters": cl})
    return rgba, rows


def build_frames(key: str, rgba: np.ndarray, rows, verbose=True):
    """행 매핑 → 42프레임 (240x180 균일 셀, 보스별 단일 스케일)"""
    tex = TEXMAP[key]
    rmap = ROWMAP[key]
    # 1) 전 프레임 콘텐츠 최대 크기 → 보스별 단일 스케일
    max_dim = 1
    all_cells = []
    for anim, ri in rmap.items():
        if ri is None or ri >= len(rows):
            continue
        y0, y1 = rows[ri]["y"]
        ex = CELL_EXCLUDE.get(key, {}).get(ri, set())
        for ci, (x0, x1) in enumerate(pick_six(rows[ri]["clusters"], ex)):
            cell = rgba[y0:y1, x0:x1]
            a = cell[..., 3]
            ys, xs = np.where(a > 24)
            if len(ys) == 0:
                continue
            bbox = (ys.min(), ys.max(), xs.min(), xs.max())
            all_cells.append((anim, ci, cell, bbox))
            max_dim = max(max_dim, bbox[1] - bbox[0] + 1, bbox[3] - bbox[2] + 1)
    scale = min((CELL_W - 12) / max_dim, (CELL_H - 10) / max_dim, 1.0)
    # 2) 프레임 합성
    frames = {}  # (anim, i) → PIL.Image(240x180)
    for anim, ci, cell, bbox in all_cells:
        ys0, ys1, xs0, xs1 = bbox
        crop = cell[ys0:ys1 + 1, xs0:xs1 + 1]
        w, h = xs1 - xs0 + 1, ys1 - ys0 + 1
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        img = Image.fromarray(crop).resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        canvas.alpha_composite(img, ((CELL_W - nw) // 2, CELL_H - 5 - nh))
        frames[(anim, ci)] = canvas
    if verbose:
        print(f"  {key}: 스케일 {scale:.3f} (max_dim {max_dim}) 프레임 {len(frames)}개")
    return frames


def save_frames(key: str, frames):
    tex = TEXMAP[key]
    count = 0
    for (anim, ci), img in frames.items():
        suffix = f"{anim}{ci}" if anim in ("idle", "walk", "atk", "die") else f"{anim}_{ci}"
        path = f"{PUB}/{tex}_{suffix}.webp"
        img.save(path, "WEBP", quality=88, alpha_quality=100, method=4)
        count += 1
    print(f"  ✓ {key}: {count}프레임 저장 ({tex}_*)")


def montage(key: str, frames):
    """애니별 6프레임 몽타주 (검증용)"""
    anims = ["idle", "walk", "atk", "die", "sp1", "sp2", "sp3"]
    present = [a for a in anims if (a, 0) in frames]
    if not present:
        return
    m = Image.new("RGB", (CELL_W * N_FRAMES, CELL_H * len(present)), (40, 44, 52))
    for r, a in enumerate(present):
        for c in range(N_FRAMES):
            f = frames.get((a, c))
            if f:
                m.paste(f, (c * CELL_W, r * CELL_H), f)
    m.save(f"{MON}/{key}_montage.jpg", quality=88)
    print(f"  ✓ 몽타주 {MON}/{key}_montage.jpg ({len(present)}행)")


if __name__ == "__main__":
    mode = "report"
    keys = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--build" in sys.argv:
        mode = "build"
    keys = keys or [k for k in TEXMAP if k not in SKIP]
    for k in keys:
        if mode == "build" and k in SKIP:
            print(f"[skip] {k} — 기존 아트 유지")
            continue
        res = slice_boss(k)
        if res is None:
            continue
        rgba, rows = res
        print(f"\n== {k}: {len(rows)}행 ==")
        for i, r in enumerate(rows):
            y0, y1 = r["y"]
            print(f"  행{i}: y={y0}~{y1} (h={y1-y0}) 셀 {len(r['clusters'])}개: {[(c[1]-c[0]) for c in r['clusters']]}")
        if mode == "build":
            frames = build_frames(k, rgba, rows)
            save_frames(k, frames)
            montage(k, frames)
