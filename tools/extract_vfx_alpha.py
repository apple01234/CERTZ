#!/usr/bin/env python3
"""가산광 텍스처 알파 추출 (v1.4.41).

문제
----
UNI VFX 계열 중 일부는 **RGB만 있고 알파가 없다**(모서리 α=255, 중앙 검정).
이 상태로 Phaser `BlendModes.ADD` 에 넣으면 검정이 그대로 더해져 **아무 일도 안 하고**,
`NORMAL` 로 넣으면 **흰/검 사각형**이 그려진다.

해법
----
가산광 이펙트는 "밝을수록 불투명"이 정답이므로 **휘도→알파**로 변환한다.
  alpha = max(r,g,b)  (또는 휘도)  →  색은 그대로 유지(premultiplied 느낌)
이렇게 하면 검정 배경이 완전 투명이 되고, ADD 에서는 밝기 그대로 빛나며,
NORMAL 에서도 자연스럽다.

대상은 **알파가 사실상 없는 파일만** 자동 감지해 처리한다(이미 알파가 있는 파일은 건드리지 않는다).

  python3 tools/extract_vfx_alpha.py --dry-run
  python3 tools/extract_vfx_alpha.py --apply
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")

# 이번에 이관한 팩 텍스처만 대상 (기존 게임 이펙트는 손대지 않는다 — 회귀 방지)
TARGETS = [f[:-5] for f in sorted(os.listdir(ASSETS)) if f.startswith(("gvb_", "gvu_")) and f.endswith(".webp")]


def alpha_is_flat(im: Image.Image) -> bool:
    """알파가 전부 255(또는 거의)인가 — 즉 사실상 없는가"""
    a = np.array(im.convert("RGBA"))[:, :, 3]
    return float(a.min()) > 250


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        ap.print_help()
        return 1

    changed = 0
    for key in TARGETS:
        p = os.path.join(ASSETS, f"{key}.webp")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        if not alpha_is_flat(im):
            continue  # 이미 알파가 살아 있음 — 그대로 둔다
        arr = np.array(im).astype(np.float32)
        rgb = arr[:, :, :3]
        # 휘도(max 채널) → 알파. 순수 검정만 0 이 되고 밝은 코어는 완전 불투명.
        lum = rgb.max(axis=2)
        # 저역 노이즈 제거: 8 미만은 0 (압축 잔여물이 흰 테두리로 보이는 것 방지)
        a = np.clip((lum - 8.0) / (255.0 - 8.0) * 255.0, 0, 255)
        # 색은 유지하되 알파가 낮은 곳은 색도 함께 줄여 fringe 를 없앤다
        k = (a / 255.0)[:, :, None]
        arr[:, :, :3] = np.clip(rgb * np.where(k > 0.02, 1.0, 0.0), 0, 255)
        arr[:, :, 3] = a
        out = Image.fromarray(arr.astype(np.uint8), "RGBA")
        if args.apply:
            out.save(p, "WEBP", quality=94, method=6)
        changed += 1
        opaque = float((a > 16).mean() * 100)
        print(f"  {key:<22} 알파 추출 (불투명 {opaque:5.1f}%)")

    print(f"\n{'APPLY' if args.apply else 'DRY-RUN'} — {changed}장 변환 / 대상 {len(TARGETS)}장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
