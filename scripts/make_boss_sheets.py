#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SERTZ 보스 전면 리메이크 — 스프라이트 시트 파이프라인 (플랜 8종 + 재림 3종 + 최종보스)

출력: public/assets/bsw_*.webp  (7행 균일 시트: idle/walk/atk/death/sp1/sp2/sp3, 12FPS 플레이 전제)
행 구성(타깃): 0=idle 1=walk 2=atk 3=death 4=sp1 5=sp2 6=sp3
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os, math, random

UP = "/home/z/my-project/upload"
OUT = "/home/z/my-project/public/assets"
TMP = "/tmp/bossbuild"
os.makedirs(TMP, exist_ok=True)

# ---------------------------------------------------------------- 소스 로드
DRAGON_B = Image.open(f"{UP}/file_000000006604820983e9f96db34595a9.png").convert("RGBA")  # 1536x1024 7x7
DRAGON_A = Image.open(f"{UP}/file_000000004a5482069531efe87ab73ca2.png").convert("RGBA")  # 1536x1024 6x6 (행2=참격)
GOLEM    = Image.open(f"{UP}/file_00000000dbf88206abc6be51bc743b76.png").convert("RGBA")  # 1536x1024 6x6
WOLF     = Image.open(f"{UP}/file_000000003b688206be0cc7248e5d9eb9.png").convert("RGBA")  # 1224x1285 6x7

# ---------------------------------------------------------------- 유틸
def cell(src, r, c, cols, rows):
    """소스 시트의 셀을 정수 경계로 잘라 반환 (내용 bbox 여백 포함)"""
    W, H = src.size
    cw, ch = W / cols, H / rows
    x0, y0 = int(round(c * cw)), int(round(r * ch))
    x1, y1 = int(round((c + 1) * cw)), int(round((r + 1) * ch))
    return src.crop((x0, y0, x1, y1))

def paste_fit(dst_sheet, img, r, c, cw, ch, pad=4):
    """내용 bbox만 잘라 cw×ch 셀에 하단 중앙 정렬로 붙임"""
    bb = img.getbbox()
    if bb:
        img = img.crop(bb)
    w, h = img.size
    scale = min((cw - pad * 2) / w, (ch - pad * 2) / h, 1.0)
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    w, h = img.size
    x = c * cw + (cw - w) // 2
    y = r * ch + (ch - h) - pad  # 하단 정렬 — 발이 바닥에
    dst_sheet.alpha_composite(img, (x, y))

def compose_sheet(cols, cw, ch, rows_of_cells):
    """rows_of_cells[r][c] = PIL Image → 균일 시트"""
    sheet = Image.new("RGBA", (cols * cw, 7 * ch), (0, 0, 0, 0))
    for r, row in enumerate(rows_of_cells):
        for c, im in enumerate(row):
            paste_fit(sheet, im, r, c, cw, ch)
    return sheet

# ---------------------------------------------------------------- 색조 변형
def hue_shift_selective(im, h_lo, h_hi, s_min, new_h_lo, new_h_hi, s_mul=1.0, v_mul=1.0):
    """HSV 선택 변형: 마스크(휴대위/채도하한) 픽셀의 H를 new 범위로 선형 재매핑"""
    rgb = im.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)
    alpha = np.array(im)[:, :, 3]
    # RGB→HSV (numpy 벡터화, H 0-360)
    r, g, b = arr[..., 0] / 255, arr[..., 1] / 255, arr[..., 2] / 255
    mx, mn = np.max(arr, axis=-1) / 255, np.min(arr, axis=-1) / 255
    df = mx - mn
    h = np.zeros_like(mx)
    nz = df > 1e-6
    idx = (mx == r) & nz; h[idx] = (60 * ((g - b) / df) % 360)[idx]
    idx = (mx == g) & nz; h[idx] = (60 * ((b - r) / df) + 120)[idx]
    idx = (mx == b) & nz; h[idx] = (60 * ((r - g) / df) + 240)[idx]
    s = np.where(mx > 1e-6, df / np.maximum(mx, 1e-6), 0)
    v = mx
    mask = (h >= h_lo) & (h <= h_hi) & (s > s_min / 255.0) & (alpha > 40)
    t = np.zeros_like(h)
    t[mask] = (h[mask] - h_lo) / max(1e-6, (h_hi - h_lo))
    h2 = h.copy(); h2[mask] = new_h_lo + t[mask] * (new_h_hi - new_h_lo)
    s2 = np.clip(s * s_mul, 0, 1); v2 = np.clip(v * v_mul, 0, 1)
    # HSV→RGB
    c = v2 * s2
    x = c * (1 - np.abs((h2 / 60) % 2 - 1))
    m = v2 - c
    z = np.zeros_like(c)
    conds = [(h2 < 60), (h2 < 120), (h2 < 180), (h2 < 240), (h2 < 300), (h2 >= 300)]
    rgb2 = np.zeros_like(arr)
    for i, cond in enumerate(conds):
        cm = cond & nz
        if i == 0: rgb2[..., 0][cm] = c[cm]; rgb2[..., 1][cm] = x[cm]; rgb2[..., 2][cm] = z[cm]
        elif i == 1: rgb2[..., 0][cm] = x[cm]; rgb2[..., 1][cm] = c[cm]; rgb2[..., 2][cm] = z[cm]
        elif i == 2: rgb2[..., 0][cm] = z[cm]; rgb2[..., 1][cm] = c[cm]; rgb2[..., 2][cm] = x[cm]
        elif i == 3: rgb2[..., 0][cm] = z[cm]; rgb2[..., 1][cm] = x[cm]; rgb2[..., 2][cm] = c[cm]
        elif i == 4: rgb2[..., 0][cm] = x[cm]; rgb2[..., 1][cm] = z[cm]; rgb2[..., 2][cm] = c[cm]
        else: rgb2[..., 0][cm] = c[cm]; rgb2[..., 1][cm] = z[cm]; rgb2[..., 2][cm] = x[cm]
    rgb2 += (m * 255)[..., None]
    out = np.concatenate([np.clip(rgb2, 0, 255), alpha[..., None]], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def channel_tint(im, rm=1.0, gm=1.0, bm=1.0, vmul=1.0):
    """단순 채널 배수 틴트 (흰색 계열용)"""
    arr = np.array(im, dtype=np.float32)
    arr[..., 0] = np.clip(arr[..., 0] * rm, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1] * gm, 0, 255)
    arr[..., 2] = np.clip(arr[..., 2] * bm, 0, 255)
    if vmul != 1.0:
        arr[..., :3] = np.clip(arr[..., :3] * vmul, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def dragon_variant(target):
    """드래곤 B(본체 7행) + A 행2(참격 6프레임) → 7행 시트, 초록→target 색조 변형 후 합성.
    target: (new_h_lo, new_h_hi, s_mul, v_mul) 또는 None(네이티브)"""
    cw, ch = 220, 147
    rows = []
    # 행 매핑: [B0 idle, B1 walk, A2 참격, B3 death, B4 sp1, B5 sp2, B6 sp3]
    for r in range(7):
        if r == 2:
            cells = [cell(DRAGON_A, 2, c, 6, 6) for c in range(6)]
        else:
            cells = [cell(DRAGON_B, r, c, 7, 7) for c in range(7)]
        rows.append(cells)
    sheet = compose_sheet(7, cw, ch, rows)
    if target is not None:
        nlo, nhi, s_mul, v_mul = target
        sheet = hue_shift_selective(sheet, 55, 125, 55, nlo, nhi, s_mul, v_mul)
    return sheet, 7

def golem_variant(target=None):
    """골렘 6행 → sp3=sp1 복제로 7행. target=(h_lo,h_hi,s_min,new_lo,new_hi,s_mul,v_mul)"""
    cw, ch = 256, 171
    rows = [
        [cell(GOLEM, 0, c, 6, 6) for c in range(6)],  # idle
        [cell(GOLEM, 1, c, 6, 6) for c in range(6)],  # walk
        [cell(GOLEM, 2, c, 6, 6) for c in range(6)],  # atk
        [cell(GOLEM, 3, c, 6, 6) for c in range(6)],  # death
        [cell(GOLEM, 4, c, 6, 6) for c in range(6)],  # sp1 용암 분출
        [cell(GOLEM, 5, c, 6, 6) for c in range(6)],  # sp2 화염 브레스
        [cell(GOLEM, 4, c, 6, 6) for c in range(6)],  # sp3 = sp1 재사용
    ]
    sheet = compose_sheet(6, cw, ch, rows)
    if target is not None:
        h_lo, h_hi, s_min, nlo, nhi, s_mul, v_mul = target
        sheet = hue_shift_selective(sheet, h_lo, h_hi, s_min, nlo, nhi, s_mul, v_mul)
    return sheet, 6

def wolf_variant(tint=None):
    """늑대 7행 재구성: [idle, walk, 참격(행3), 빙파(행4=death), 돌진참격(행5), 포효(행6), 돌주행(행2)]
    행2(머리 숙인 주행)는 sp3(돌진)로 재활용, 행4는 death."""
    cw, ch = 204, 184
    rows = [
        [cell(WOLF, 0, c, 6, 7) for c in range(6)],
        [cell(WOLF, 1, c, 6, 7) for c in range(6)],
        [cell(WOLF, 3, c, 6, 7) for c in range(6)],  # atk — 얼음 참격
        [cell(WOLF, 4, c, 6, 7) for c in range(6)],  # death — 얼음 파편 소멸
        [cell(WOLF, 5, c, 6, 7) for c in range(6)],  # sp1 — 얼음 대시 참격
        [cell(WOLF, 6, c, 6, 7) for c in range(6)],  # sp2 — 포효 얼음 기둥
        [cell(WOLF, 2, c, 6, 7) for c in range(6)],  # sp3 — 머리 숙인 돌진 주행
    ]
    sheet = compose_sheet(6, cw, ch, rows)
    if tint is not None:
        sheet = channel_tint(sheet, *tint)
    return sheet, 6

# ---------------------------------------------------------------- 저장
def save_sheet(sheet, name):
    path = f"{OUT}/{name}.webp"
    sheet.save(path, "WEBP", quality=88, alpha_quality=100, method=4)
    kb = os.path.getsize(path) // 1024
    print(f"  ✓ {name}.webp  {sheet.size[0]}x{sheet.size[1]}  {kb}KB")
    return path

def build_all_bosses():
    print("== 보스 시트 생성 ==")
    # [key, builder] — 12종
    specs = [
        ("bsw_guardian",  lambda: dragon_variant((8, 30, 1.12, 1.02))),     # 심연의 수호자 — 화룡(적)
        ("bsw_nidhog",    lambda: dragon_variant(None)),                     # 탐식의 드래곤 — 네이티브 녹색
        ("bsw_gram",      lambda: dragon_variant((38, 55, 1.15, 1.06))),     # 혈안의 문지기 가름 — 성황(금)
        ("bsw_fenrir",    lambda: dragon_variant((128, 150, 0.82, 1.05))),   # 탐욕의 늑대 — ?? (아래에서 늑대로 덮음)
        ("bsw_abudditos", lambda: dragon_variant((175, 205, 1.25, 0.55))),   # 종언의 마룡 — 보이드 퍼플
        ("bsw_vord",      lambda: dragon_variant((128, 152, 0.85, 1.10))),   # 재림 파수꾼 — 빙청
        ("bsw_jorm",      lambda: dragon_variant((95, 118, 1.0, 1.0))),      # 요르문간드 — 해록(청록)
        ("bsw_nagr",      lambda: dragon_variant((335, 360, 1.3, 0.6))),     # 재림 종언 — 진홍 암흑
        ("bsw_surt",      lambda: golem_variant()),                          # 화염의 거인 — 네이티브 용암
        ("bsw_abysslord", lambda: golem_variant((2, 48, 90, 168, 200, 1.15, 0.8))),  # 심연의 군주 — 암흑 퍼플
        ("bsw_behemoth",  None),                                             # 유령선 — ship.py에서 별도
        ("bsw_skoll",     lambda: wolf_variant((1.10, 0.93, 0.62))),         # 교만의 쌍랑 — 금양 늑대
        ("bsw_gram_wolf", lambda: wolf_variant((1.22, 0.55, 0.55))),         # (예비) 혈안 늑대
        ("bsw_fenrir_w",  lambda: wolf_variant((0.82, 0.94, 1.10))),         # 탐욕의 늑대 펜리르 — 서리 늑대
    ]
    frames = {}
    for name, fn in specs:
        if fn is None:
            continue
        sheet, cols = fn()
        save_sheet(sheet, name)
        frames[name] = cols
    return frames

if __name__ == "__main__":
    build_all_bosses()
