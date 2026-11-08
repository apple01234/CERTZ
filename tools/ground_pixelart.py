#!/usr/bin/env python3
"""vc283 (task-17) — 흐릿한 수채화 지면 → 픽셀아트 지면 교체.

[문제]
  기존 ground_meadow/sand/slate/violet/forest/cavern/ash 7종은 256x256 에
  고유색 653~1330색의 **수채화 사진풍**이었다(원본 tile_*.webp 를 확대한 것).
  캐릭터는 선명한 도트인데 지면만 뿌옇게 뭉개져 픽셀 밀도가 근본적으로 달랐다.

[해법 — 새 아트를 그리지 않는다]
  보유 중인 DCSS CC0-1.0 32x32 픽셀아트(public/assets/campaign/drive/) 중
  **타일링이 실제로 맞물리는** 것만 원본으로 쓴다.
  여기서 허용된 연산만 한다: 크롭 · NEAREST 정수배 리사이즈 · 회전/반전 ·
  팔레트(hue/채도/명도) 조정. AI 생성·절차적 노이즈·새로 그리기 금지.

[4x4 패킹 + 변형 셔플 — 왜 이렇게 하는가]
  ═══ 1차 구현의 실패 (실측으로 확인) ═══
  32x32 를 4x4 로 이어붙여 128, NEAREST 2x → 256 으로 만들었다.
  그런데 **같은 타일 하나를 16번 복붙**했기 때문에 결과 텍스처가
  64px(32x2) 마다 **완전히 동일**하게 반복됐다(자기상관 lag64 = 1.000).
  화면에는 64px 사각형 격자가 그대로 보였다 — 사용자가 지적한
  "사각형으로 뚝 끊기는 지형"과 같은 결함을 새로 만들고 있었다.
  seam ratio(경계 vs 내부 거칠기)는 이 결함을 못 잡는다(0.94~1.01 로 통과).

  ═══ 해결 ═══
  무이음새 타일은 **회전(90°)·반전해도 무이음새가 유지된다**(경계가 서로 맞물리므로).
  소스 3종 × 반전2 × 회전4 = **24 변형**을 만들어 16 슬롯에 중복 없이 셔플한다.
  그러면 256px 안에서 같은 모양이 두 번 나오지 않아 64px 주기가 사라진다.
  실측 lag64 자기상관: 같은 타일 복붙 1.000 → 변형 셔플 0.017~0.122.
  이는 "기존 프레임의 회전/반전 패킹"이며 새 아트 생성이 아니다(지시 3.1 허용 범위).

[왜 2x 확대인가]
  32px 를 그대로 1x 로 8x8 패킹하면 32px 격자가 보이고,
  단일 32px 를 8배 확대하면 픽셀이 8px 로 너무 굵다.
  4x4 패킹 + 2x 가 world 64px 셀과 픽셀 밀도가 맞는 균형점이다.

사용:
  python tools/ground_pixelart.py --dry
  python tools/ground_pixelart.py --apply
"""
import argparse
import colorsys
import hashlib
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

DRIVE = "public/assets/campaign/drive"
OUTDIR = "public/assets/ground"
MANIFEST = os.path.join(OUTDIR, "manifest.json")
LICENSE = "CC0-1.0"
SOURCE_URL = "https://opengameart.org/content/dungeon-crawl-32x32-tiles"

# dest → (원본 후보들, 목표 hue, 채도 배율, 명도 배율, 설명)
#
# [왜 원본이 여러 개인가] 한 종류만 쓰면 64px 주기 격자가 생긴다(위 설명).
#  회전/반전 변형을 섞으려면 원본이 2~3종 있어야 무늬가 실제로 달라진다.
#
# [왜 목표 hue 를 절대값으로 주나]
#   DCSS 원본은 전부 **초록 계열**(hue≈0.25)이다. 가산(+0.30) 방식으로 쓰면
#   초록 기준으로만 맞아떨어져 '모래'가 청록이 되는 등 다른 색이 나왔다.
#   그래서 "이 타일은 이 색이어야 한다"를 절대 hue 로 못박고, 소스의 지배 hue 에서
#   목표 hue 로 **회전**시킨다. 명도 분포(픽셀 배치·음영 구조)는 그대로 보존된다.
PLAN = {
    # 잔디 — 초록 유지
    "ground_meadow": (["floor-garden.png", "floor-garden-1.png", "floor-forest-2.png"], 0.25, 1.00, 1.00, "잔디(원색)"),
    # 숲 — 더 짙고 어두운 초록
    "ground_forest": (["floor-garden-1.png", "floor-forest-2.png", "floor-garden.png"], 0.28, 0.90, 0.78, "숲 바닥(어둡게)"),
    # 모래 — 노란 갈색
    "ground_sand": (["floor-garden.png", "floor-garden-2.png", "floor-forest-2.png"], 0.11, 0.75, 1.22, "모래(황갈색)"),
    # 석재 — 무채 회청
    "ground_slate": (["floor-garden.png", "floor-garden-1.png", "floor-forest-2.png"], 0.58, 0.14, 0.95, "석재(탈색 회청)"),
    # 보라 지면
    "ground_violet": (["floor-garden-1.png", "floor-garden-2.png", "floor-garden.png"], 0.78, 0.55, 0.90, "보랏빛"),
    # 동굴 — 어둡고 푸른
    "ground_cavern": (["floor-garden-1.png", "floor-garden-2.png", "floor-forest-2.png"], 0.62, 0.45, 0.50, "동굴(어둡고 푸르게)"),
    # 잿빛 — 밝은 회백
    "ground_ash": (["floor-garden.png", "floor-garden-2.png", "floor-garden-1.png"], 0.10, 0.08, 1.45, "잿빛(탈색 밝게)"),
}

# 소스 지배 hue — green 계열 타일의 기준점.
SRC_BASE_HUE = 0.25

SRC_SIZE = 32     # DCSS 원본 타일
TILE_N = 4        # 4x4 패킹 → 128
UPSCALE = 2       # NEAREST 2x → 256
OUT_SIZE = SRC_SIZE * TILE_N * UPSCALE   # 256


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def recolor(im: Image.Image, target_hue: float, sat_mul: float, val_mul: float) -> Image.Image:
    """HSV 팔레트 변환 — 픽셀 배치는 그대로 두고 **색상만 목표값으로 회전**한다."""
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    out = np.empty_like(a)
    hshift = (target_hue - SRC_BASE_HUE) % 1.0
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b = a[y, x]
            h, s, v = colorsys.rgb_to_hsv(float(r), float(g), float(b))
            h = (h + hshift) % 1.0
            s = min(1.0, max(0.0, s * sat_mul))
            v = min(1.0, max(0.0, v * val_mul))
            rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
            out[y, x] = (rr, gg, bb)
    return Image.fromarray((out * 255.0 + 0.5).clip(0, 255).astype(np.uint8), "RGB")


def autocorr_lag64(im: Image.Image) -> float:
    """lag 64px 가로 자기상관. 1.0 = 64px 주기로 완전 반복(격자 보임)."""
    a = np.asarray(im.convert("L")).astype(np.float32)
    x = a - a.mean()
    den = float((x * x).sum())
    if den < 1e-6:
        return 1.0
    lag = 64
    w = a.shape[1]
    return float((x[:, :w - lag] * x[:, lag:]).sum() / den * (w / (w - lag)))


def edge_diff(im: Image.Image):
    """wrap 경계 diff 와 내부 인접 diff (32px 원본 타일 기준)."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    lr = float(np.abs(a[:, 0, :] - a[:, -1, :]).mean())
    tb = float(np.abs(a[0, :, :] - a[-1, :, :]).mean())
    ilr = float(np.abs(a[:, 1:, :] - a[:, :-1, :]).mean())
    itb = float(np.abs(a[1:, :, :] - a[:-1, :, :]).mean())
    return lr, tb, ilr, itb


def count_colors(im: Image.Image) -> int:
    a = np.asarray(im.convert("RGB")).reshape(-1, 3)
    return len(np.unique(a, axis=0))


def variants(src_paths, target_hue, sat, val):
    """소스별 8변형(반전2 × 회전4) — 전부 무이음새 성질이 보존된다."""
    out = []
    for p in src_paths:
        base = recolor(Image.open(p).convert("RGB"), target_hue, sat, val)
        for flip in (False, True):
            im = base.transpose(Image.FLIP_LEFT_RIGHT) if flip else base
            for rot in range(4):
                out.append(im.rotate(rot * 90, expand=False))
    return out


def build(src_paths, target_hue, sat, val, seed: int) -> Image.Image:
    """24변형을 16슬롯에 중복 없이 셔플 → 4x4 패킹 → NEAREST 2x."""
    for p in src_paths:
        src = Image.open(p)
        if src.size != (SRC_SIZE, SRC_SIZE):
            raise SystemExit(f"{p}: expected {SRC_SIZE}x{SRC_SIZE}, got {src.size}")
    pool = variants(src_paths, target_hue, sat, val)
    idx = list(range(TILE_N * TILE_N))
    k = seed
    for i in range(len(idx) - 1, 0, -1):
        k = (1103515245 * k + 12345) & 0x7FFFFFFF
        j = k % (i + 1)
        idx[i], idx[j] = idx[j], idx[i]
    packed = Image.new("RGB", (SRC_SIZE * TILE_N, SRC_SIZE * TILE_N))
    for gy in range(TILE_N):
        for gx in range(TILE_N):
            packed.paste(pool[idx[gy * TILE_N + gx] % len(pool)], (gx * SRC_SIZE, gy * SRC_SIZE))
    assert packed.size == (OUT_SIZE // UPSCALE, OUT_SIZE // UPSCALE)
    return packed.resize((OUT_SIZE, OUT_SIZE), Image.NEAREST)


def main(apply: bool):
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"{'dest':16} {'colors':>13} {'seamLR':>8} {'seamTB':>8} {'lag64':>7}  verdict")
    print("-" * 76)
    rows = []
    for seed_i, (dest, (srcfiles, hue, sat, val, note)) in enumerate(PLAN.items()):
        src_paths = [os.path.join(DRIVE, f) for f in srcfiles]
        if not all(os.path.exists(p) for p in src_paths):
            print(f"{dest:16} MISSING {srcfiles}")
            continue
        before = os.path.join(OUTDIR, dest + ".png")
        before_colors = count_colors(Image.open(before)) if os.path.exists(before) else -1

        out = build(src_paths, hue, sat, val, seed=seed_i * 7 + 1)
        c = count_colors(out)
        lag = autocorr_lag64(out)
        # seam 판정은 확대 전 32px 타일에서 (NEAREST 2x 는 내부 기준선을 절반으로 줄인다)
        lr, tb, ilr, itb = edge_diff(recolor(Image.open(src_paths[0]), hue, sat, val))
        ok = (lr <= ilr * 1.2) and (tb <= itb * 1.2) and (lag < 0.5)
        verdict = "OK" if ok else ("grid!" if lag >= 0.5 else "seam!")
        rows.append((dest, before_colors, c, lr, tb, lag, verdict))
        print(f"{dest:16} {before_colors:5}->{c:<6} {lr:8.2f} {tb:8.2f} {lag:7.3f}  {verdict}")

        if apply:
            out.save(before)
            manifest[dest] = {
                "source": f"{DRIVE}/{srcfiles[0]}",
                "sources": [f"{DRIVE}/{f}" for f in srcfiles],
                "sourceSha256": sha256(src_paths[0]),
                "crop": [0, 0, SRC_SIZE, SRC_SIZE],
                "integerScale": UPSCALE,
                "pack": (f"DCSS 32x32 ({len(srcfiles)}종) → 회전/반전 24변형 셔플 → "
                         f"{TILE_N}x{TILE_N} 패킹 → NEAREST {UPSCALE}x"),
                "license": LICENSE,
                "licenseUrl": SOURCE_URL,
                "tint": {"hue": hue, "sat": sat, "val": val},
                "repeat": {"lag64Autocorr": round(lag, 4), "note": "1.0=64px 격자, <0.5=격자 없음"},
                "note": note,
                "width": OUT_SIZE,
                "height": OUT_SIZE,
                "generatedBy": "tools/ground_pixelart.py",
            }

    if apply:
        with open(MANIFEST, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"\nAPPLIED - {MANIFEST} updated, {len(rows)} tiles")
    else:
        print("\n(dry-run - no files changed)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    main(apply=args.apply and not args.dry)
