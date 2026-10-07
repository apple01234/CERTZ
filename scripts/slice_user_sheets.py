#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
유저 제공 보스 시트 4장 → 게임 텍스처 교체 v2 (240x180 · 6프레임 · 알파 정규화)

v2 개선:
  1. 행별 적응형 프레임 중심 — x투영 세그먼트 병합/분할, 균일 그리드와 컷 비용 비교 후 선택
  2. 글로우 배경 임계 강화 (nidhog 48 / jorm 55)
  3. surt 좌향 시트 → 우향 네이티브로 좌우 반전
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

UP = "/home/z/my-project/upload"
PUB = "/home/z/my-project/public/assets"
MON = "/tmp/usheet"
os.makedirs(MON, exist_ok=True)

CELL_W, CELL_H = 240, 180

SHEETS = {
    "nidhog": dict(
        file="file_000000006604820983e9f96db34595a9.png",
        cx0=102.0, pitch=191.0, ncols=8, flip=False,
        rows=[(21, 164), (179, 320), (329, 472), (482, 616), (640, 761)],
        bottom_band=(779, 1011), split_search=(855, 945),
        anims={"idle": (0, [0, 1, 2, 3, 4, 5]), "walk": (1, [0, 1, 2, 3, 4, 5]),
               "atk": (2, [2, 3, 4, 5, 6, 7]), "die": (3, [0, 2, 4, 5, 6, 7]),
               "sp1": (6, [0, 2, 4, 5, 6, 7]), "sp2": (5, [0, 2, 4, 5, 6, 7]),
               "sp3": (4, [0, 2, 4, 5, 6, 7])},
        t_lo=20, t_hi=36, matte="comp0",
    ),
    "jorm": dict(
        file="file_000000004a5482069531efe87ab73ca2.png",
        cx0=132.5, pitch=248.0, ncols=6, flip=False,
        rows=[(23, 170), (198, 345), (360, 514), (529, 686), (714, 869), (884, 1006)],
        anims={"idle": (0, "PP"), "walk": (1, None), "atk": (2, None),
               "die": (3, None), "sp1": (4, None), "sp2": (5, None),
               "sp3": (4, None)},
        t_lo=22, t_hi=40, matte="comp",
    ),
    "fenrir": dict(
        file="file_000000003b688206be0cc7248e5d9eb9.png",
        cx0=109.5, pitch=204.0, ncols=6, flip=False,
        rows=[(35, 234), (265, 433), (469, 662), (716, 882), (916, 1087), (1102, 1269)],
        anims={"idle": (0, None), "walk": (1, None), "atk": (2, None),
               "die": (3, None), "sp1": (5, None), "sp2": (4, None),
               "sp3": (4, None)},
        t_lo=14, t_hi=30, matte="soft",
    ),
    "surt": dict(
        file="file_00000000dbf88206abc6be51bc743b76.png",
        cx0=129.0, pitch=254.0, ncols=6, flip=False,
        rows=[(16, 182), (188, 354), (360, 526), (532, 698), (704, 870), (876, 1012)],
        anims={"idle": (0, None), "walk": (1, None), "atk": (2, None),
               "die": (3, None), "sp1": (4, None), "sp2": (4, None),
               "sp3": (5, None)},
        t_lo=22, t_hi=40, matte="comp",
    ),
}


def bg_est_cell(cell: np.ndarray, ring: int = 3) -> np.ndarray:
    h, w = cell.shape[:2]
    top = cell[:ring].mean(axis=0)
    bot = cell[-ring:].mean(axis=0)
    left = cell[:, :ring].mean(axis=1)
    right = cell[:, -ring:].mean(axis=1)
    ys = np.linspace(0, 1, h)[:, None, None]
    xs = np.linspace(0, 1, w)[None, :, None]
    vert = left[:, None, :] * (1 - xs) + right[:, None, :] * xs
    horiz = top[None, :, :] * (1 - ys) + bot[None, :, :] * ys
    return vert * 0.65 + horiz * 0.35


def extract_cell(img_rgb: np.ndarray, x0: float, x1: float, y0: int, y1: int,
                 t_lo: float, t_hi: float, flip: bool, matte: str = "comp") -> np.ndarray:
    H, W = img_rgb.shape[:2]
    xa, xb = int(max(0, round(x0))), int(min(W, round(x1)))
    cell = img_rgb[y0:y1, xa:xb].astype(np.float32)
    if flip:
        cell = cell[:, ::-1]
    est = bg_est_cell(cell)
    dist = np.abs(cell - est).max(axis=2)
    if matte == "soft":
        # 소프트 마atte: 가장자리 연결 배경 제거 + 경계 페더 (펜리르 얼음 이펙트·수르트용)
        bg_mask = dist < t_hi
        lab, n = ndimage.label(bg_mask)
        if n > 0:
            border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
            border.discard(0)
            bg_final = np.isin(lab, list(border))
        else:
            bg_final = bg_mask
        solid = ~bg_final
        eroded = ndimage.binary_erosion(solid, iterations=2) if solid.any() else solid
        soft = np.clip((dist - t_lo) / max(1e-6, (t_hi - t_lo)), 0, 1)
        a = np.where(bg_final, 0.0, np.where(eroded, 1.0, soft))
        a = ndimage.gaussian_filter(a, sigma=0.6)
        a = np.where(bg_final, 0.0, np.maximum(a, np.where(eroded, 1.0, 0.0)))
        return np.dstack([cell, a[..., None] * 255]).astype(np.uint8)
    # comp matte: 그리데이터로 글로우까지 배경 모델링 후 성분 기반 보존
    if matte == "comp":
        bgm1 = dist < t_hi
        lab1, n1 = ndimage.label(bgm1)
        bg1 = bgm1.copy()
        if n1 > 0:
            border1 = set(lab1[0, :]) | set(lab1[-1, :]) | set(lab1[:, 0]) | set(lab1[:, -1])
            border1.discard(0)
            bg1 = np.isin(lab1, list(border1))
        if bg1.sum() > 400:
            from scipy.interpolate import griddata
            ys, xs = np.where(bg1)
            st = 4
            ys, xs = ys[::st], xs[::st]
            vals = cell[ys, xs]
            gy, gx = np.mgrid[0:cell.shape[0], 0:cell.shape[1]]
            est2 = griddata((xs, ys), vals, (gx, gy), method="linear")
            bad = np.isnan(est2[..., 0])
            est2[bad] = est[bad]
            dist = np.abs(cell - est2).max(axis=2)
    # matte v4: 성분 기반 — dist>=t_lo 후보 중 유의 성분 보존 + 최대 성분 홀 채움
    cand = dist >= t_lo
    lab, n = ndimage.label(cand)
    keep = np.zeros_like(cand)
    if n > 0:
        sizes = ndimage.sum(cand, lab, range(1, n + 1))
        min_sz = max(30, cand.size * 0.0008)
        keep_ids = [i + 1 for i, sz in enumerate(sizes) if sz >= min_sz]
        keep = np.isin(lab, keep_ids)
        main = lab == (1 + int(np.argmax(sizes)))
        keep = keep | ndimage.binary_fill_holes(main)
    # 경계 페더: hard mask 블러 + 내부 1.0 보장
    a = ndimage.gaussian_filter(keep.astype(np.float32), sigma=0.8)
    eroded = ndimage.binary_erosion(keep, iterations=1)
    a = np.where(eroded, 1.0, a)
    a = np.where(a < 0.15, 0.0, a)
    return np.dstack([cell, a[..., None] * 255]).astype(np.uint8)


def row_content_cols(img_rgb: np.ndarray, y0: int, y1: int, t_lo: float) -> np.ndarray:
    """행 밴드의 열별 콘텐츠 비율 (0~1) — 컷 비용 계산용"""
    band = img_rgb[y0:y1].astype(np.float32)
    # 배경 근사: 밴드 4모서리 평균색과의 거리
    corners = np.concatenate([band[:4, :4].reshape(-1, 3), band[:4, -4:].reshape(-1, 3),
                              band[-4:, :4].reshape(-1, 3), band[-4:, -4:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    d = np.abs(band - bg).max(axis=2)
    return (d > t_lo).mean(axis=0)


def find_segs(profile: np.ndarray, thr=0.02, min_w=8, merge_gap=6):
    segs, in_seg = [], False
    for x, v in enumerate(profile > thr):
        if v and not in_seg:
            s = x; in_seg = True
        elif not v and in_seg:
            segs.append([s, x]); in_seg = False
    if in_seg:
        segs.append([s, len(profile)])
    segs = [s for s in segs if s[1] - s[0] >= min_w]
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < merge_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged


def row_centers(profile: np.ndarray, ncols: int, pitch: float, cx0: float, W: int) -> list:
    """행별 프레임 중심 산출 (v3 — 크롭폭은 항상 pitch로 고정, 중심만 적응형)
      1. 세그 수 == ncols → 세그 중심 그대로 (무절단)
      2. 세그 수 > ncols → 가장 좁은 세그를 인접에 병합
      3. 세그 수 < ncols → 최광 세그를 곡점(투영 최소점)에서 분할, 폭이 1.35×pitch 미만이면 포기
      4. 그래도 실패 → 균일 그리드 폴백
    반환: [(center_x, width)] — width는 pitch 고정(드리프트 절단 방지)"""
    segs = [list(x) for x in find_segs(profile)]
    exp_w = pitch * 1.35

    work = [list(x) for x in segs]
    guard = 0
    while len(work) > ncols and guard < 60:  # 병합: 가장 좁은 세그 → 이웃
        guard += 1
        wi = int(np.argmin([s2[1] - s2[0] for s2 in work]))
        s2 = work.pop(wi)
        if work and wi > 0:
            work[wi - 1][1] = max(work[wi - 1][1], s2[1])
        elif work:
            work[0][0] = min(work[0][0], s2[0])
    guard = 0
    while len(work) < ncols and guard < 60:  # 분할: 최광 세그 곡점
        guard += 1
        wi = int(np.argmax([s2[1] - s2[0] for s2 in work]))
        s2 = work[wi]
        if s2[1] - s2[0] < exp_w:
            break
        lo = s2[0] + int((s2[1] - s2[0]) * 0.25)
        hi = s2[0] + int((s2[1] - s2[0]) * 0.75)
        if hi - lo < 10:
            break
        valley = lo + int(np.argmin(profile[lo:hi]))
        work[wi] = [s2[0], valley]
        work.insert(wi + 1, [valley, s2[1]])
    if len(work) == ncols:
        return [((s2[0] + s2[1]) / 2, pitch) for s2 in work]
    if 0 < len(work) < ncols:
        # 분할 불가(모든 세그가 프레임 폭 이하) → 세그 중심 그대로, 남는 셀은 빈 프레임
        # (idle 3프레임 행 등 — 균일 폴백 시 이웃 프레임 침범 절단 방지)
        if all((s2[1] - s2[0]) < pitch * 1.3 for s2 in work):
            return [((s2[0] + s2[1]) / 2, pitch) for s2 in work]
    # 폴백: 균일 그리드
    return [(cx0 + pitch * i, pitch) for i in range(ncols)]


def main():
    texs = {}
    for tex, cfg in SHEETS.items():
        im = np.array(Image.open(os.path.join(UP, cfg["file"])).convert("RGB"))
        H, W = im.shape[:2]
        rows = list(cfg["rows"])
        if "bottom_band" in cfg:
            y0, y1 = cfg["bottom_band"]
            band = im[y0:y1].astype(np.float32).mean(axis=2)
            prof = np.abs(band - np.median(band)).mean(axis=1)
            s0, s1 = cfg["split_search"]
            split = y0 + int(np.argmin(prof[s0 - y0:s1 - y0])) + (s0 - y0)
            rows += [(y0, split), (split, y1)]
            print(f"[{tex}] bottom split @ y={split}")
        frames = {}
        for ri, (y0, y1) in enumerate(rows):
            prof = row_content_cols(im, y0, y1, cfg["t_lo"])
            centers = row_centers(prof, cfg["ncols"], cfg["pitch"], cfg["cx0"], W)
            for ci in range(cfg["ncols"]):
                cx, hw = centers[ci][0], centers[ci][1] / 2
                cell = extract_cell(im, cx - hw, cx + hw, y0, y1,
                                    cfg["t_lo"], cfg["t_hi"], cfg["flip"], cfg.get("matte", "comp"))
                a = cell[..., 3]
                ys, xs = np.where(a > 8)
                if len(ys) == 0:
                    frames[(ri, ci)] = np.zeros((CELL_H, CELL_W, 4), dtype=np.uint8)
                else:
                    fr = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                    frames[(ri, ci)] = fr
        max_w = max(f.shape[1] for f in frames.values())
        max_h = max(f.shape[0] for f in frames.values())
        scale = min(CELL_W * 0.96 / max_w, CELL_H * 0.96 / max_h, 1.0)
        print(f"[{tex}] max bbox {max_w}x{max_h} → scale {scale:.3f}")
        texs[tex] = (frames, cfg, scale)
        for anim, spec in cfg["anims"].items():
            row, idxs = spec
            if idxs is None:
                seq = [0, 1, 2, 3, 4, 5]
            elif idxs == "PP":
                seq = [0, 1, 2, 1, 0, 1]
            else:
                seq = [i for i in idxs if i < cfg["ncols"]]
                while len(seq) < 6:
                    seq.append(seq[-1])
                seq = seq[:6]
            for fi, ci in enumerate(seq):
                fr = frames[(row, ci)]
                h, w = fr.shape[:2]
                nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
                arr = np.array(Image.fromarray(fr).resize((nw, nh), Image.LANCZOS))
                canvas = np.zeros((CELL_H, CELL_W, 4), dtype=np.uint8)
                px = (CELL_W - nw) // 2
                canvas[CELL_H - nh:, px:px + nw] = arr
                name = f"boss_{tex}_{anim}_{fi}.webp" if anim.startswith("sp") else f"boss_{tex}_{anim}{fi}.webp"
                Image.fromarray(canvas).save(os.path.join(PUB, name), "WEBP", quality=92, method=6)
        print(f"[{tex}] 7 anims x 6 frames 출력 완료")
    # 검증 몽타주
    for tex, (frames, cfg, scale) in texs.items():
        tiles = []
        for anim in ["idle", "walk", "atk", "die", "sp1", "sp2", "sp3"]:
            row, idxs = cfg["anims"][anim]
            if idxs is None:
                seq = [0, 1, 2, 3, 4, 5]
            elif idxs == "PP":
                seq = [0, 1, 2, 1, 0, 1]
            else:
                seq = [i for i in idxs if i < cfg["ncols"]][:6]
                while len(seq) < 6:
                    seq.append(seq[-1])
            for ci in seq:
                fr = frames[(row, ci)]
                h, w = fr.shape[:2]
                nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
                arr = np.array(Image.fromarray(fr).resize((nw, nh), Image.LANCZOS))
                canvas = np.zeros((CELL_H, CELL_W, 4), dtype=np.uint8)
                px = (CELL_W - nw) // 2
                canvas[CELL_H - nh:, px:px + nw] = arr
                tiles.append(canvas)
        mt = Image.new("RGBA", (CELL_W * 6, CELL_H * 7), (40, 44, 40, 255))
        for i, t in enumerate(tiles):
            r, c = divmod(i, 6)
            img = Image.fromarray(t)
            mt.paste(img, (c * CELL_W, r * CELL_H), img)
        mt.convert("RGB").save(os.path.join(MON, f"montage_{tex}.jpg"), quality=88)
        print(f"몽타주 → {MON}/montage_{tex}.jpg")


if __name__ == "__main__":
    main()
