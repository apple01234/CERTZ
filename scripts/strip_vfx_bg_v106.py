#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.0.6 (지시 #6) — vfx2 팩 이펙트 이미지의 검은 네모 배경 제거 (지시 원문:
"검은 네모안에 이펙트가 있으면 배경 제거하고 이펙트만 남겨서 적용해")

대상:
  1) public/assets/vfx2/*.png 중 불투명 배경(모서리 알파=255)인 단일 이미지
  2) public/assets/vfx2_*.webp 스프라이트시트 중 검은 배경(elec/tri/cfx1/blood)·흰 배경(boom)

방법 — 루미넌스 키(발광 FX 표준 처리):
  · 검은 배경 이미지: alpha = max(R,G,B) (어두울수록 투명, 밝을수록 불투명)
    - 완전 검정(≤8)은 알파 0 강제, 임계 하한(thr) 아래는 스케일링으로 부드럽게 소멸
    - 색상은 원본 유지(ADD 블렌드에서 색감 보존) + 저휘도 픽셀은 감마로 정리
  · 흰 배경(boom): 반전 후 동일 처리(흰 배경이 사라지고 이펙트만 남음)
  · 이미 알파가 있는 이미지는 건드리지 않는다
"""
from PIL import Image
import numpy as np
import os, sys

ROOT = "/home/z/my-project/public/assets"
VFX2 = os.path.join(ROOT, "vfx2")

def needs_bg_removal(im: Image.Image) -> bool:
    """모서리 픽셀이 불투명하면 배경 있는 파일로 판정"""
    w, h = im.size
    corners = [im.getpixel((0, 0)), im.getpixel((w - 1, 0)), im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1))]
    return any(len(c) >= 4 and c[3] > 200 for c in corners)

def luminance_key(im: Image.Image, thr: int = 14, invert: bool = False) -> Image.Image:
    """빛나는 FX 표준 처리 — 휘도→알파. invert=True면 흰 배경용(반전 후 처리)."""
    rgba = np.array(im.convert("RGBA")).astype(np.float32)
    rgb = rgba[:, :, :3]
    if invert:
        rgb = 255.0 - rgb
    lum = rgb.max(axis=2)  # max 채널 = 발광 강도
    # 임계 이하 완전 투명, 이상은 부드러운 램프 + 감마로 약한 먼지 정리
    a = np.clip((lum - thr) / (200.0 - thr), 0.0, 1.0)
    a = np.power(a, 0.85)
    # 기존 알파가 있으면 곱한다(부분 투명 보존)
    if rgba.shape[2] == 4:
        a = a * (rgba[:, :, 3] / 255.0)
    out = np.dstack([rgb, a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def process_png(name: str) -> str:
    p = os.path.join(VFX2, name)
    im = Image.open(p)
    if not needs_bg_removal(im):
        return f"skip(투명) {name}"
    im = luminance_key(im)
    im.save(p)
    return f"done  {name}"

def process_sheet(key: str) -> str:
    """vfx2_*.webp 시트 — 검은 배경은 루미넌스, 흰 배경(boom)은 반전 루미넌스"""
    p = os.path.join(ROOT, f"{key}.webp")
    png = os.path.join(ROOT, f"{key}.png")
    im = Image.open(p)
    w, h = im.size
    corner = im.getpixel((0, 0))
    if len(corner) >= 4 and corner[3] <= 8:
        return f"skip(투명) {key}.webp"
    white = bool(corner[0] > 200 and corner[1] > 200 and corner[2] > 200)
    im2 = luminance_key(im, invert=white)
    im2.save(p, "WEBP", quality=92)
    # 동명 png 원본도 함께 갱신 (재생성 파이프라인 대비)
    if os.path.exists(png):
        im2.save(png)
    return f"done  {key}.webp ({'white-bg 반전' if white else 'black-bg'})"

def main():
    only = set(sys.argv[1:])
    print("== vfx2 단일 PNG ==")
    for f in sorted(os.listdir(VFX2)):
        if not f.endswith(".png"):
            continue
        if only and f not in only:
            continue
        try:
            print(process_png(f))
        except Exception as e:
            print(f"FAIL {f}: {e}")
    print("== vfx2_*.webp 시트 ==")
    for key in ["vfx2_elec", "vfx2_tri", "vfx2_cfx1", "vfx2_boom", "vfx2_blood"]:
        if only and f"{key}.webp" not in only:
            continue
        try:
            print(process_sheet(key))
        except Exception as e:
            print(f"FAIL {key}: {e}")

if __name__ == "__main__":
    main()
