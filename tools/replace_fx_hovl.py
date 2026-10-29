#!/usr/bin/env python3
"""Hovl Magic effects pack → SERTZ 이펙트 텍스처 교체.

발견한 문제
-----------
기존 vf_* 이펙트 8종(vf_slash, vf_flare_*, vf_ring, vf_star, vf_impact,
vf_lightning, vf_pentacle)은 **알파가 전부 255로 불투명**하다(실측 alpha.std=0.0).
알파가 없으면 원형·광선 이펙트가 회색 사각형으로 그려진다 — 이펙트가
"짜치다"는 체감의 직접 원인.

해법
----
Hovl Magic effects pack 의 알파 보유 텍스처로 교체한다.
 - 원본은 RGB(알파 없음)이 많으므로 **휘도를 알파로 추출**한다
   (밝은 부분만 남기고 검은 배경을 투명화 — 가산 합성과 동일한 결과).
 - 이미 알파가 있는 파일(Slash, FlashFree1~3, GlowFree1, Electro 등)은 그대로 쓴다.
 - 512px 초과는 512로 축소(모바일 텍스처 예산). 색은 보존.

사용
----
  python3 tools/replace_fx_hovl.py --dry-run
  python3 tools/replace_fx_hovl.py --apply
"""
import argparse
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
SRC = "/root/workspace/_assets_in/x2/Hovl Studio/Magic effects pack/Textures"

# SERTZ 키 → (Hovl 원본 파일, 목표 크기, 비고)
#  같은 Hovl 파일을 여러 키에 재사용하는 것은 의도적이다(원소별로 색을 틴트로 준다).
MAP = {
    # ── 근접 slash 계열
    "vf_slash":       ("Slash.png",           384),
    "vf_impact":      ("FlashFree1.png",      384),
    # ── 원소 flare (중심 폭발)
    "vf_flare_fire":  ("Flare.png",           384),
    "vf_flare_elec":  ("Electro.png",         384),
    "vf_flare_ice":   ("GlowFree1.png",       384),
    "vf_flare_dark":  ("SmokeFree1.png",      384),
    "vf_flare_nature": ("GlowFree1.png",      384),
    "vf_flare_void":  ("SmokeFree1.png",      384),
    "vf_flare_water": ("GlowFree1.png",       384),
    "vf_flare_earth": ("Crack.png",           384),
    # ── 링 / 마법진
    "vf_ring":        ("Gradient2.png",       384),
    "vf_ring_fire":   ("Gradient2.png",       384),
    "vf_ring_void":   ("Gradient2.png",       384),
    "vf_pentacle":    ("MagicCircle2.png",    512),
    "vf_penta_fire":  ("MagicCircle2.png",    512),
    "vf_penta_elec":  ("MagicCircle2.png",    512),
    "vf_penta_dark":  ("MagicCircle2.png",    512),
    "vf_penta_ice":   ("MagicCircle2.png",    512),
    # ── 기타
    "vf_star":        ("FlashFree3.png",      256),
    "vf_lightning":   ("Electro.png",         384),
    "vf_arrow":       ("Arrow1.png",          256),
    "vf_emb_fire":    ("GlowFree1.png",       192),
    "vf_emb_void":    ("GlowFree1.png",       192),
    "vf_emb_nature":  ("GlowFree1.png",       192),
    "vf_emb_sound":   ("GlowFree1.png",       192),
    # v1.4.32 에서 추가된 고해상도 임팩트(존재하는 키만)
    "fx_Circle2":     ("Gradient2.png",       256),
    "fx_FlashFree1":  ("FlashFree1.png",      512),
}


def lum_to_alpha(im: Image.Image) -> Image.Image:
    """RGB 이미지의 휘도를 알파로 옮긴다 (검은 배경 → 투명)."""
    im = im.convert("RGB")
    a = np.array(im).astype(np.float32)
    # 휘도(Rec.709) — 가산 이펙트의 밝기와 일치
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    alpha = np.clip(lum, 0, 255).astype(np.uint8)
    out = np.dstack([a.astype(np.uint8), alpha])
    return Image.fromarray(out, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if not os.path.isdir(SRC):
        print(f"원본 없음: {SRC}")
        return 1

    made, skipped, missing = 0, 0, []
    for key, (fn, size) in sorted(MAP.items()):
        sp = os.path.join(SRC, fn)
        if not os.path.exists(sp):
            missing.append(f"{key}←{fn}")
            continue
        dst = os.path.join(ASSETS, f"{key}.webp")
        im = Image.open(sp).convert("RGBA")
        arr = np.array(im)
        a = arr[..., 3]
        has_alpha = a.min() < 200 and a.std() > 1
        if not has_alpha:
            im = lum_to_alpha(im)
            note = "휘도→알파"
        else:
            note = "알파 유지"
        if max(im.size) > size:
            im = im.resize((size, size), Image.LANCZOS)
        if args.apply:
            if os.path.exists(dst):
                shutil.copy2(dst, dst + ".bak_hovl")
            im.save(dst, "WEBP", lossless=True, quality=100)
        print(f"  {key:<18}← {fn:<18}{note:<12}{im.size}")
        made += 1

    print(f"\n{'교체' if args.apply else '교체 예정'}: {made}종 / 원본없음: {len(missing)}")
    if missing:
        print("  없음:", ", ".join(missing))
    if not args.apply:
        print("(실제로 쓰려면 --apply)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
