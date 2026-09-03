#!/usr/bin/env python3
"""SERTZ 타일 전환 타일 생성 — 지형 경계가 자로 잰 듯한 직선이라 부자연스러운 문제 개선.

생성물 (스테이지 세트별, 64x64 RGBA):
  tx_{set}_edge_{dn,up,lt,rt}.png : 지면 타일 + 길 텍스처 불규칙 블롭 (길이 지면으로 뻗어나간 가장자리)
  tx_{set}_bite_{dn,up}.png       : 길 타일 + 지면 불규칙 블롭 (길 안쪽 침식)
  tx_{set}_gvar{1,2}.png          : 지면 명도 변형 (반복 패턴 깨기)
  tx_{set}_pvar.png               : 길 명도 변형

세트: gp(마을/숲 grass+path) dp(알프헤임 dark+path) cp(동굴 cave+path_dark)
      si(니플헤임 snow+ice) ap(왕좌 abyss+path_dark)
모든 블롭은 고정 시드(결정적) — 재실행해도 동일 결과.
"""
import random
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ASSETS = "/home/z/my-project/public/assets"
T = 64

SETS = {
    "gp": ("tile_grass", "tile_path"),
    "dp": ("tile_dark", "tile_path"),
    "cp": ("tile_cave", "tile_path_dark"),
    "si": ("tile_snow", "tile_ice"),
    "ap": ("tile_abyss", "tile_path_dark"),
}


def blob_mask(side: str, seed: int, depth: tuple = (14, 26)) -> Image.Image:
    """한 방향에서 자라는 불규칙 블롭 마스크 (L 모드).
    side: 블롭이 붙는 변 — dn(아래에 붙어 위로), up(위에 붙어 아래로), lt, rt"""
    rng = random.Random(seed)
    m = Image.new("L", (T, T), 0)
    d = ImageDraw.Draw(m)
    # 원 9~14개를 경계 근처에 흩어 겹치기 — 덩어리진 불규칙 가장자리
    for _ in range(rng.randint(9, 14)):
        r = rng.uniform(5, 13)
        along = rng.uniform(-8, T + 8)  # 경계선 따라 위치
        out = rng.uniform(depth[0] * 0.25, depth[1])  # 경계에서 안쪽 깊이
        if side == "dn":  # 아래 변에 붙어 위로 솟음
            cx, cy = along, T - out
        elif side == "up":
            cx, cy = along, out
        elif side == "lt":
            cx, cy = out, along
        else:  # rt
            cx, cy = T - out, along
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    return m


def make_edge(ground: Image.Image, path: Image.Image, side: str, seed: int) -> Image.Image:
    """지면 타일 위에 길 텍스처 블롭 합성 — 길 가장자리가 지면으로 뻗은 타일"""
    base = ground.copy()
    base.paste(path.copy(), (0, 0), blob_mask(side, seed))
    return base


def make_bite(path: Image.Image, ground: Image.Image, side: str, seed: int) -> Image.Image:
    """길 타일 위에 지면 블롭 합성 — 길 안쪽이 침식된 타일"""
    base = path.copy()
    base.paste(ground.copy(), (0, 0), blob_mask(side, seed + 977, depth=(10, 20)))
    return base


def make_var(img: Image.Image, factor: float) -> Image.Image:
    return ImageEnhance.Brightness(img).enhance(factor)


def main() -> None:
    made = 0
    for set_name, (g_name, p_name) in SETS.items():
        ground = Image.open(f"{ASSETS}/{g_name}.png").convert("RGBA")
        path = Image.open(f"{ASSETS}/{p_name}.png").convert("RGBA")
        # 방향별 시드 (세트마다 다르게 — 결정적)
        seeds = {"dn": 101, "up": 202, "lt": 303, "rt": 404}
        for side, sd in seeds.items():
            out = make_edge(ground, path, side, sd + hash(set_name) % 1000)
            out.save(f"{ASSETS}/tx_{set_name}_edge_{side}.png")
            made += 1
        for side, sd in (("dn", 505), ("up", 606)):
            out = make_bite(path, ground, side, sd + hash(set_name) % 1000)
            out.save(f"{ASSETS}/tx_{set_name}_bite_{side}.png")
            made += 1
        make_var(ground, 0.95).save(f"{ASSETS}/tx_{set_name}_gvar1.png")
        make_var(ground, 1.045).save(f"{ASSETS}/tx_{set_name}_gvar2.png")
        make_var(path, 0.9).save(f"{ASSETS}/tx_{set_name}_pvar.png")
        made += 3
    print(f"generated {made} transition tiles")


if __name__ == "__main__":
    main()
