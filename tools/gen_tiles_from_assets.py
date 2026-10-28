#!/usr/bin/env python3
"""SERTZ 타일맵 전면 교체 — 무료 에셋 팩 기반 재생성.

## 배경

기존 타일(tile_*.webp)은 절차 생성 256px 이었고, 사용자가 "타일 하나 깔아놓은 것 같다"고
지적했다. 이후 Kenney CC0 로 교체했으나 여전히 256px 절차 생성 계열이었다.

이번에는 실제 아트 에셋 팩(Fantasy Adventure Pack, Tiny RPG Forest)에서 **실제 그린
지면 텍스처**를 추출해 27종 테마 타일을 재구성한다.

## 핵심 구조 활용

게임은 `WorldScene` 에서 이렇게 렌더한다:

    const groundTs = this.add.tileSprite(0,0,stageW,stageH,groundTex);
    if (gTint) groundTs.setTint(gTint);

즉 **타일 자체는 중성 회색조**여야 하고, 챕터별 색은 `groundTint`가 입힌다.
따라서 고품질 회색조 타일 3~4종을 확보하면 27종 테마를 전부 커버할 수 있다.

## 산출물

- 원본 아트에서 추출한 지면 타일 → 256x256 으로 업스케일(니어레스트, 픽셀 보존)
- 테마별 타일은 회색조 베이스 + 팔레트 시프트로 생성하되, **픽셀 질감은 원본 유지**
- 기존 파일명(tile_*.webp)을 그대로 써서 `stages.ts`/`BootScene`/`TX_SET_OF` 수정을 최소화

사용:
  python3 tools/gen_tiles_from_assets.py --preview
  python3 tools/gen_tiles_from_assets.py --apply
"""
import argparse
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets"
SRC = Path("/root/workspace/_assets_in")

T = 32          # 원본 타일 크기
TARGET = 256     # 게임 타일 크기 (기존 규격 유지)

# 원본 아트에서 추출한 지면 타일 좌표.
#  Fantasy Adventure Pack Tileset2 는 플랫포머용이지만 지면 타일 질감이 좋다.
#  실측: (6,17) 미세자갈 중성회색 / (5,17) 중간자갈 / (4,17) 굵은자갈 / (4,15) 풀
BASES = {
    "fine":   ("x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset2.png", 6, 17),
    "mid":    ("x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset2.png", 5, 17),
    "coarse": ("x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset2.png", 4, 17),
    "grass":  ("x2/Fantasy Adventure Pack/Sprites/Environment Sprites/Tileset2.png", 4, 15),
}

# 액체/특수 타일은 자갈 질감을 쓰면 "돌바닥"처럼 보인다.
# 이들은 절차 생성으로 파형/노이즈를 만들어 질감을 따로 준다.
PROCEDURAL = {
    "water", "lava", "magma", "magma_path", "ice", "void", "starfield", "nebula",
}

# 테마별 (베이스, 색조 RGB, 채도, 밝기) — tint 없이도 개성이 보이게 색을 입힌다.
#   groundTint 가 추가로 곱해지므로 너무 진하게 넣지 않는다(0.5~0.85 범위).
THEMES = {
    # ── 9왕국 ──────────────────────────────────────────────
    "tile_forest":       ("grass",  (110, 185, 105), 0.55, 0.98),
    "tile_grass":        ("grass",  (130, 195, 100), 0.55, 1.02),
    "tile_grass2":       ("grass",  (155, 200, 120), 0.45, 1.06),
    "tile_grass_flower": ("grass",  (165, 215, 150), 0.45, 1.08),
    "tile_garden":       ("fine",   (150, 190, 120), 0.45, 1.05),
    "tile_lava":         ("coarse", (230, 110,  40), 0.80, 1.05),
    "tile_magma":        ("coarse", (210,  80,  30), 0.85, 0.95),
    "tile_magma_path":   ("mid",    (220, 120,  50), 0.70, 1.00),
    "tile_snow":         ("fine",   (225, 240, 255), 0.20, 1.25),
    "tile_snow_deep":    ("fine",   (205, 225, 250), 0.18, 1.15),
    "tile_ice":          ("fine",   (170, 220, 245), 0.45, 1.12),
    "tile_frost":        ("mid",    (195, 225, 240), 0.30, 1.10),
    "tile_cave":         ("coarse", (120, 100,  85), 0.45, 0.85),
    "tile_cave_wet":     ("mid",    (100, 110, 120), 0.40, 0.80),
    "tile_stone":        ("coarse", (150, 145, 140), 0.15, 1.00),
    "tile_ruin":         ("coarse", (140, 130, 110), 0.30, 0.95),
    "tile_ash":          ("fine",   (120, 115, 110), 0.10, 0.90),
    "tile_hel":          ("coarse", ( 90,  70, 110), 0.50, 0.80),
    "tile_abyss":        ("fine",   ( 70,  60, 100), 0.55, 0.70),
    "tile_morgue":       ("mid",    ( 80,  75,  95), 0.35, 0.75),
    "tile_deep":         ("fine",   ( 60,  70, 100), 0.50, 0.65),
    # ── 경로/보조 ──────────────────────────────────────────
    "tile_path":         ("mid",    (170, 155, 130), 0.30, 1.05),
    "tile_path_dark":    ("mid",    (110, 100,  90), 0.25, 0.85),
    "tile_dark":         ("fine",   ( 70,  65,  75), 0.25, 0.70),
    # ── DLC 행성 ───────────────────────────────────────────
    "tile_basalt":       ("coarse", ( 90,  90, 100), 0.20, 0.85),
    "tile_blood":        ("mid",    (170,  50,  60), 0.70, 0.95),
    "tile_bone":         ("coarse", (200, 190, 165), 0.20, 1.10),
    "tile_brick":        ("coarse", (160, 110,  90), 0.35, 1.00),
    "tile_cobble":       ("coarse", (140, 140, 150), 0.15, 1.00),
    "tile_concrete":     ("fine",   (150, 150, 155), 0.08, 1.00),
    "tile_desert":       ("fine",   (215, 190, 140), 0.40, 1.10),
    "tile_dirt":         ("mid",    (140, 110,  85), 0.40, 0.95),
    "tile_divine":       ("fine",   (240, 230, 180), 0.30, 1.20),
    "tile_gold":         ("fine",   (225, 185,  90), 0.55, 1.15),
    "tile_marble":       ("fine",   (230, 228, 235), 0.10, 1.18),
    "tile_metal":        ("fine",   (160, 165, 175), 0.12, 1.05),
    "tile_moss":         ("grass",  (110, 160,  90), 0.50, 0.95),
    "tile_mushroom":     ("grass",  (160, 140, 190), 0.45, 1.00),
    "tile_nebula":       ("fine",   (120, 100, 190), 0.60, 0.95),
    "tile_rust":         ("coarse", (170, 100,  60), 0.50, 0.95),
    "tile_sand":         ("fine",   (225, 205, 155), 0.35, 1.12),
    "tile_starfield":    ("fine",   ( 80,  85, 150), 0.55, 0.80),
    "tile_tech":         ("fine",   (120, 160, 190), 0.35, 1.00),
    "tile_void":         ("fine",   ( 45,  40,  70), 0.45, 0.60),
    "tile_vault":        ("fine",   (180, 170, 140), 0.25, 1.00),
    "tile_amber":        ("fine",   (230, 175,  90), 0.45, 1.10),
    "tile_water":        ("fine",   ( 90, 150, 200), 0.55, 1.00),
}

# 테마별 대비 배율. 저대비로 뭉개지는 타일은 높이고, 이미 강한 타일은 낮춘다.
CONTRAST = {
    # 어두운 테마는 대비를 더 줘야 질감이 보인다
    "tile_abyss": 2.1, "tile_deep": 2.1, "tile_void": 2.3, "tile_dark": 2.0,
    "tile_hel": 1.9, "tile_morgue": 1.9, "tile_starfield": 2.0, "tile_nebula": 1.8,
    # 회색 석재는 서로 구분되도록 대비를 다르게
    "tile_ash": 1.5, "tile_basalt": 1.9, "tile_cave": 1.7, "tile_concrete": 1.5,
    "tile_metal": 1.4, "tile_stone": 1.8, "tile_cobble": 1.8, "tile_path_dark": 2.0,
    "tile_brick": 1.9, "tile_ruin": 1.8,
    # 밝은 바닥은 과하지 않게
    "tile_snow": 1.4, "tile_snow_deep": 1.5, "tile_marble": 1.3, "tile_divine": 1.4,
    "tile_bone": 1.5, "tile_ice": 1.5, "tile_frost": 1.5,
    # 물/기타
    "tile_water": 1.6, "tile_lava": 1.5, "tile_magma": 1.5,
}


def load_base(name):
    rel, r, c = BASES[name]
    p = SRC / rel
    if not p.exists():
        raise SystemExit(f"원본 없음: {p}")
    im = Image.open(p).convert("RGBA")
    cell = im.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))
    return cell


def to_target(cell):
    """32px 원본을 256px 로 픽셀 보존 업스케일."""
    return cell.resize((TARGET, TARGET), Image.NEAREST)


def build_liquid(key, rgb_at, rgb_bt, turbulence=3.0, seed=0):
    """물/용암/성운 같은 액체·특수 지면을 절차 생성한다.

    자갈 텍스처를 tint 하면 "색칠한 돌바닥"이 되므로, 사인파를 겹쳐
    흐르는 파형을 만든다. 타일 경계에서 위상이 2π 배수로 맞아떨어져
    이음새 없이 반복된다.
    """
    rng = np.random.default_rng(seed)
    N = TARGET
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    u = x / N
    v = y / N

    # 기본 흐름 파형 (정수 주기라 타일링 시 이음새 없음)
    f = (np.sin(2 * np.pi * (2 * u + 1.0 * v)) * 0.5
         + np.sin(2 * np.pi * (1.0 * u - 2.0 * v)) * 0.35
         + np.sin(2 * np.pi * (3.0 * u + 2.0 * v)) * 0.20)

    # 난류(작은 소용돌이) — 정수 주기 격자에서 보간해 경계 연속성 유지
    G = 8
    noise = rng.random((G, G)).astype(np.float32)
    noise = np.vstack([noise, noise[:1]])
    noise = np.hstack([noise, noise[:, :1]])
    zi = np.linspace(0, G, N, endpoint=False)
    yi, xi = np.meshgrid(zi, zi, indexing="ij")
    y0 = yi.astype(int); x0 = xi.astype(int)
    fy = (yi - y0); fx = (xi - x0)
    n = (noise[y0, x0] * (1 - fx) * (1 - fy)
         + noise[y0, x0 + 1] * fx * (1 - fy)
         + noise[y0 + 1, x0] * (1 - fx) * fy
         + noise[y0 + 1, x0 + 1] * fx * fy)

    f = f * 0.75 + (n - 0.5) * turbulence * 0.25
    m = np.clip((f + 1.0) / 2.0, 0.0, 1.0)[..., None]

    a_rgb = np.array(rgb_at, dtype=np.float32) / 255.0
    b_rgb = np.array(rgb_bt, dtype=np.float32) / 255.0
    out = a_rgb * (1 - m) + b_rgb * m

    # 하이라이트 (파형 마루)
    crest = np.clip((m[..., 0] - 0.72) / 0.28, 0, 1)[..., None]
    out = out + crest * 0.22

    rgba = np.zeros((N, N, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(out * 255.0, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = 255
    return Image.fromarray(rgba, "RGBA")


# 액체 테마별 (어두운색, 밝은색, 난류, 시드)
LIQUIDS = {
    "tile_water":      ((28, 74, 120), (120, 190, 235), 3.2, 11),
    "tile_lava":       ((120, 26, 8),  (255, 170, 40),  4.2, 21),
    "tile_magma":      ((80, 16, 10),  (240, 110, 25),  4.6, 31),
    "tile_magma_path": ((105, 32, 12), (250, 150, 55),  3.8, 41),
    "tile_ice":        ((120, 175, 210), (225, 248, 255), 2.6, 51),
    "tile_void":       ((10, 8, 22),   (58, 44, 96),    3.0, 61),
    "tile_starfield":  ((8, 10, 28),   (70, 78, 150),   2.8, 71),
    "tile_nebula":     ((30, 14, 58),  (150, 110, 215), 3.4, 81),
}


def tint_tile(cell, rgb, sat, bright, contrast=1.0):
    """회색조 타일에 색을 입힌다.

    원본 픽셀의 명암 구조(질감)는 유지하고 색상만 이동시킨다.
    휘도를 곱하는 방식이라 하이라이트/그림자 관계가 깨지지 않는다.

    contrast: 원본 휘도의 대비를 증폭한다. 에셋 원본이 저대비라
    그대로 쓰면 256px 업스케일에서 질감이 뭉개지므로 1.4~2.2 로 올린다.
    """
    a = np.array(cell).astype(np.float32)
    lum = a[:, :, :3].mean(axis=2, keepdims=True) / 255.0

    # 대비 증폭 (중간값 0.5 기준)
    lum = np.clip((lum - 0.5) * contrast + 0.5, 0.0, 1.0)

    target = np.array(rgb, dtype=np.float32).reshape(1, 1, 3) / 255.0

    # 채도를 낮춘 회색조와 목표색을 섞은 뒤, 휘도를 곱해 명암을 살린다
    shade = 0.35 + 1.15 * lum                      # 0.35 ~ 1.50
    out = target * shade * bright

    # 원본 회색조와 블렌드 (질감 보존)
    orig = a[:, :, :3] / 255.0
    orig = np.clip((orig - 0.5) * contrast + 0.5, 0.0, 1.0)
    out = out * (0.80 + 0.20 * (1 - sat))
    out = out + orig * (0.30 * sat)

    a[:, :, :3] = np.clip(out * 255.0, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def build_theme(key, preview_dir=None):
    short = key.replace("tile_", "")

    # 액체·특수 지면은 자갈 베이스 대신 절차 파형으로 만든다
    if key in LIQUIDS:
        dark, light, turb, seed = LIQUIDS[key]
        im = build_liquid(key, dark, light, turb, seed)
        if preview_dir:
            preview_dir.mkdir(parents=True, exist_ok=True)
            im.save(preview_dir / f"{key}.png")
        return im

    base_name, rgb, sat, bright = THEMES[key]
    contrast = CONTRAST.get(key, 1.6)
    cell = load_base(base_name)
    big = to_target(cell)
    tinted = tint_tile(big, rgb, sat, bright, contrast)
    if preview_dir:
        preview_dir.mkdir(parents=True, exist_ok=True)
        tinted.save(preview_dir / f"{key}.png")
    return tinted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--only", nargs="*")
    args = ap.parse_args()

    keys = args.only or list(THEMES)
    prev = ROOT / "tmp" / "tile_preview" if args.preview else None
    ok = 0
    for k in keys:
        if k not in THEMES:
            print(f"  {k}: 정의 없음")
            continue
        try:
            im = build_theme(k, prev)
        except SystemExit as e:
            print(f"  {k}: {e}")
            continue
        if args.apply:
            im.save(OUT / f"{k}.webp", "WEBP", lossless=False, quality=94, method=6)
        ok += 1
        b, rgb, s, br = THEMES[k]
        print(f"  {k:20s} base={b:7s} rgb={rgb} sat={s} → "
              f"{'저장' if args.apply else '미리보기'}")

    print(f"\n처리 {ok}/{len(keys)}")
    if args.preview:
        print(f"미리보기 → {prev}")
    if not args.apply:
        print("(--apply 로 실제 기록)")


if __name__ == "__main__":
    main()
