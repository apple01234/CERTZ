#!/usr/bin/env python3
"""vc275 (task-17) — 흐릿한 수채화 지면 → 픽셀아트 지면 교체.

[문제]
  기존 ground_meadow/sand/slate/violet/forest/cavern/ash 7종은 256x256 에
  고유색 653~1330색의 **수채화 사진풍**이었다(원본 tile_*.webp 를 확대한 것).
  캐릭터는 선명한 도트인데 지면만 뿌옇게 뭉개져 픽셀 밀도가 근본적으로 달랐다.

[해법 — 새 아트를 그리지 않는다]
  보유 중인 DCSS CC0-1.0 32x32 픽셀아트(public/assets/campaign/drive/) 중
  **타일링이 실제로 맞물리는(seam ≤ 내부 거칠기) 5종**만 원본으로 쓴다.
  여기서 허용된 연산만 한다: 크롭 · NEAREST 정수배 리사이즈 · 팔레트(hue/채도/명도) 조정.
  AI 생성·절차적 노이즈·새로 그리기 금지.

[왜 4x4 패킹인가]
  32x32 를 4x4 로 이어붙여 128x128 을 만들고 NEAREST 2x → 256x256.
  ⇒ 한 소스 픽셀이 2x2 블록이 되어 **world 64px 셀과 정확히 일치**한다.
  단일 32px 를 8배 확대하면 픽셀이 8px 로 너무 굵어지고,
  반대로 1x 로 8x8 패킹하면 32px 격자가 그대로 보인다. 2x/4x4 가 유일한 균형점.

[무이음새]
  원본이 맞물리면 패킹·정수배 확대는 위상만 보존하므로 결과도 맞물린다.
  생성 후 좌우/상하 경계 diff 를 실측해 보고한다(0 에 가까울수록 좋다).

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

# dest → (원본 타일, 목표 색상(hue 0..1), 채도 배율, 명도 배율, 설명)
#
# [왜 목표 hue 를 절대값으로 주나]
#   DCSS 원본은 전부 **초록 계열**(hue≈0.25)이다. 가산(+0.30) 방식으로 쓰면
#   초록 기준으로만 맞아떨어져 '모래'가 청록이 되는 등 다른 색이 나왔다.
#   그래서 "이 타일은 이 색이어야 한다"를 절대 hue 로 못박고, 소스의 지배 hue 에서
#   목표 hue 로 **회전**시킨다. 명도 분포(픽셀 배치·음영 구조)는 그대로 보존된다.
PLAN = {
    # 잔디 — 초록 유지
    "ground_meadow": ("floor-garden.png", 0.25, 1.00, 1.00, "잔디(원색)"),
    # 숲 — 더 짙고 어두운 초록
    "ground_forest": ("floor-forest-2.png", 0.28, 0.90, 0.78, "숲 바닥(어둡게)"),
    # 모래 — 노란 갈색
    "ground_sand": ("floor-garden.png", 0.11, 0.75, 1.22, "모래(황갈색)"),
    # 석재 — 무채 회청
    "ground_slate": ("floor-garden.png", 0.58, 0.14, 0.95, "석재(탈색 회청)"),
    # 보라 지면
    "ground_violet": ("floor-garden-1.png", 0.78, 0.55, 0.90, "보랏빛"),
    # 동굴 — 어둡고 푸른
    "ground_cavern": ("floor-garden-1.png", 0.62, 0.45, 0.50, "동굴(어둡고 푸르게)"),
    # 잿빛 — 밝은 회백
    "ground_ash": ("floor-garden.png", 0.10, 0.08, 1.45, "잿빛(탈색 밝게)"),
}

# 소스 지배 hue — green 계열 타일의 기준점. 필요하면 자동 검출값으로 덮어쓴다.
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
    """HSV 팔레트 변환 — 픽셀 배치는 그대로 두고 **색상만 목표값으로 회전**한다.

    소스의 지배 hue(SRC_BASE_HUE)를 target_hue 로 옮기는 회전량을 모든 픽셀에 적용한다.
    채도가 낮은 픽셀은 색상 정보가 거의 없으므로 회전 영향이 작아 명암 구조가 유지된다.
    """
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


def edge_diff(im: Image.Image):
    """wrap 경계 diff 와 내부 인접 diff.

    [주의] 256px 결과에서 그대로 재면 안 된다 — NEAREST 2x 는 같은 소스 픽셀을
    두 칸으로 복제하므로 인접 열의 절반이 **차이 0** 이 되어 내부 기준선이 반으로
    줄어든다. 그러면 멀쩡한 타일도 'seam' 으로 오판된다.
    그래서 판정은 **소스 타일(32px)에서** 한다 — 반복 시 이음새를 결정하는 것은
    32px 격자의 wrap 이고, 패킹·정수배 확대는 위상을 그대로 보존한다.
    """
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    lr = float(np.abs(a[:, 0, :] - a[:, -1, :]).mean())
    tb = float(np.abs(a[0, :, :] - a[-1, :, :]).mean())
    ilr = float(np.abs(a[:, 1:, :] - a[:, :-1, :]).mean())
    itb = float(np.abs(a[1:, :, :] - a[:-1, :, :]).mean())
    return lr, tb, ilr, itb


def count_colors(im: Image.Image) -> int:
    a = np.asarray(im.convert("RGB")).reshape(-1, 3)
    return len(np.unique(a, axis=0))


def build(src_path: str, target_hue: float, sat: float, val: float) -> Image.Image:
    src = Image.open(src_path).convert("RGB")
    if src.size != (SRC_SIZE, SRC_SIZE):
        raise SystemExit(f"{src_path}: expected {SRC_SIZE}x{SRC_SIZE}, got {src.size}")
    tile = recolor(src, target_hue, sat, val)
    # 4x4 패킹 (무이음새 보존) → NEAREST 2x
    packed = Image.new("RGB", (SRC_SIZE * TILE_N, SRC_SIZE * TILE_N))
    for gy in range(TILE_N):
        for gx in range(TILE_N):
            packed.paste(tile, (gx * SRC_SIZE, gy * SRC_SIZE))
    assert packed.size == (OUT_SIZE // UPSCALE, OUT_SIZE // UPSCALE)
    return packed.resize((OUT_SIZE, OUT_SIZE), Image.NEAREST)


def build_tile(src_path: str, target_hue: float, sat: float, val: float) -> Image.Image:
    """판정용 — 확대 전 32px 원본 타일(색보정 후)."""
    src = Image.open(src_path).convert("RGB")
    return recolor(src, target_hue, sat, val)


def main(apply: bool):
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"{'dest':16} {'source':22} {'colors':>13} {'seamLR':>8} {'seamTB':>8} {'innerLR':>8}  verdict")
    print("-" * 100)
    rows = []
    for dest, (srcfile, hue, sat, val, note) in PLAN.items():
        src_path = os.path.join(DRIVE, srcfile)
        if not os.path.exists(src_path):
            print(f"{dest:16} MISSING {srcfile}")
            continue
        before = Image.open(os.path.join(OUTDIR, dest + ".png")) if os.path.exists(
            os.path.join(OUTDIR, dest + ".png")) else None
        before_colors = count_colors(before) if before else -1

        out = build(src_path, hue, sat, val)
        c = count_colors(out)
        # 판정은 확대 전 32px 타일에서 (위상 보존이므로 결과도 동일).
        lr, tb, ilr, itb = edge_diff(build_tile(src_path, hue, sat, val))
        # 판정: 경계 diff 가 내부 거칠기 이하면 이음새 없음
        ok = (lr <= ilr * 1.2) and (tb <= itb * 1.2)
        verdict = "SEAMLESS" if ok else "seam!"
        rows.append((dest, srcfile, before_colors, c, lr, tb, verdict))
        print(f"{dest:16} {srcfile:22} {before_colors:5}->{c:<6} {lr:8.2f} {tb:8.2f} {ilr:8.2f}  {verdict}")

        if apply:
            out.save(os.path.join(OUTDIR, dest + ".png"))
            manifest[dest] = {
                "source": f"{DRIVE}/{srcfile}",
                "sourceSha256": sha256(src_path),
                "crop": [0, 0, SRC_SIZE, SRC_SIZE],
                "integerScale": UPSCALE,
                "pack": f"DCSS 32x32 ({srcfile}) → {TILE_N}x{TILE_N} pack → NEAREST {UPSCALE}x",
                "license": LICENSE,
                "licenseUrl": SOURCE_URL,
                "tint": {"hue": hue, "sat": sat, "val": val},
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
