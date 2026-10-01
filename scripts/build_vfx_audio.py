#!/usr/bin/env python3
"""
SERTZ VFX/오디오 외부 에셋 베이크 — 절차 생성 전면 제거용
출처 (모두 CC0*):
  - Weapon Slash - Effect by Cethiel (CC0)        : 참격 애니
  - Kenney Particle Pack (CC0)                    : 충격파 링/글로우/구슬/스코치
  - Kenney Light Masks (CC0)                      : 빛기둥 콘
  - Kenney Roguelike/RPG pack (CC0)               : 화살표
  - Zelda-like by ArMM1998 (CC0)                  : "?" 말풍선
  - Animated Portal by varkalandar (CC-BY 4.0)    : 차원문 애니
  - Retro Game Music Pack by Juhani Junkala (CC0) : BGM
  - 80 CC0 RPG SFX / 80 CC0 creature SFX by Rubberduck (CC0): SFX
"""
import os, shutil, subprocess
from PIL import Image

SRC = "/home/z/my-project/scripts/asset-sources/assets-src"
OUT = "/home/z/my-project/public/assets"
AUD = f"{OUT}/audio"
os.makedirs(OUT, exist_ok=True)
os.makedirs(AUD, exist_ok=True)

def centered(im, cw, ch, scale):
    """원본 캔버스 배치 보존: 고정 캔버스 중앙 정렬 후 스케일"""
    im = im.convert("RGBA")
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(im, ((cw - im.width) // 2, (ch - im.height) // 2), im)
    if scale != 1.0:
        canvas = canvas.resize((round(cw * scale), round(ch * scale)), Image.NEAREST)
    return canvas

def save(name, im):
    im.save(f"{OUT}/{name}.png")
    print(f"  {name}.png {im.size}")

# ---------- 1. 참격 애니 (Cethiel Alternative 2 = 청색, 초승달 회전 스윕 구간) ----------
print("slash:")
pick = [2, 4, 6, 8, 10, 12]
for i, n in enumerate(pick):
    p = f"{SRC}/slash_pack/Alternative 2/{(n - 1) // 6 + 1}/Alternative_2_{n:02d}.png"
    save(f"slash{i}", centered(Image.open(p), 128, 152, 0.5))

# ---------- 2. 충격파 링 (Kenney circle_02) ----------
save("shock_ring", Image.open(f"{SRC}/kenney_pp/PNG (Transparent)/circle_02.png").convert("RGBA").resize((128, 128), Image.LANCZOS))

# ---------- 3. 보스 텔레그래프 링 (Kenney circle_03 — 실행시점 적색 틴트) ----------
save("ring", Image.open(f"{SRC}/kenney_pp/PNG (Transparent)/circle_03.png").convert("RGBA").resize((128, 128), Image.LANCZOS))

# ---------- 4. 글로우 (Kenney light_01) ----------
save("glow", Image.open(f"{SRC}/kenney_pp/PNG (Transparent)/light_01.png").convert("RGBA").resize((64, 64), Image.LANCZOS))

# ---------- 5. 구슬 투사체 (Kenney circle_05 소프트 볼 — 실행시점 보라 틴트) ----------
save("orb", Image.open(f"{SRC}/kenney_pp/PNG (Transparent)/circle_05.png").convert("RGBA").resize((16, 16), Image.LANCZOS))

# ---------- 6. 지면 스코치 (Kenney scorch_01) ----------
save("scorch", Image.open(f"{SRC}/kenney_pp/PNG (Transparent)/scorch_01.png").convert("RGBA").resize((64, 64), Image.LANCZOS))

import numpy as np

def luminance_alpha(im: Image.Image) -> Image.Image:
    """검은 배경 발광 소스 → 루미넌스 알파 (ADD 블렌드 전제, 배경 없음)"""
    im = im.convert("RGBA")
    a = np.asarray(im).astype(float)
    lum = a[:, :, :3].max(axis=2)
    a[:, :, 3] = lum
    return Image.fromarray(a.astype("uint8"), "RGBA")

# ---------- 7. 빛기둥 (Kenney cone_b_blur — 아래가 밝은 그레이디언트 마스크) ----------
cone = Image.open(f"{SRC}/lm/Default/cone_b_blur.png")
bbox = cone.getbbox()
cone = cone.crop(bbox)
g = np.asarray(cone.convert("L")).astype(float)
top, bot = g[: g.shape[0] // 4].mean(), g[-g.shape[0] // 4 :].mean()
if top > bot:
    cone = cone.transpose(Image.FLIP_TOP_BOTTOM)  # 아래가 밝은 빛기둥으로
beam = luminance_alpha(cone.resize((48, 256), Image.LANCZOS))
save("beam", beam)

# ---------- 8. 화살표 (Kenney roguelike (52,25) 흰색 펜타곤 — 실행시점 골드 틴트) ----------
KN = Image.open(f"{SRC}/kenney/Spritesheet/roguelikeSheet_transparent.png").convert("RGBA")
save("edge_arrow", KN.crop((52 * 17, 25 * 17, 52 * 17 + 16, 25 * 17 + 16)))

# ---------- 9. 퀘스트 "?" 말풍선 (Zelda objects (3,8)) ----------
OBJ = Image.open(f"{SRC}/zelda_gfx/gfx/objects.png").convert("RGBA")
save("quest_mark", OBJ.crop((3 * 16, 8 * 16, 3 * 16 + 16, 8 * 16 + 16)))

# ---------- 10. 차원문 애니 (varkalandar portal_8, 검은배경 → 루미넌스 알파) ----------
print("portal:")
pp = f"{SRC}/portal8/portal_8"
for i in range(8):
    n = i * 8 + 1
    f = Image.open(f"{pp}/portal{n:02d}.png")
    w, h = f.size                      # 400x300 → 중앙 300x300 크롭 → 64x64
    f = f.crop(((w - h) // 2, 0, (w - h) // 2 + h, h)).resize((64, 64), Image.LANCZOS)
    save(f"portal{i}", luminance_alpha(f))

# ---------- 11. 오디오 ----------
print("audio:")
WAV = f"{SRC}/chip"
BGM = {
    "bgm_title": f"{WAV}/Juhani Junkala [Retro Game Music Pack] Title Screen.wav",
    "bgm_field": f"{WAV}/Juhani Junkala [Retro Game Music Pack] Level 1.wav",
    "bgm_boss": f"{WAV}/Juhani Junkala [Retro Game Music Pack] Level 3.wav",
}
SFX = {
    "sfx_swing": f"{SRC}/sfx_rpg/blade_01.ogg",
    "sfx_hit": f"{SRC}/sfx_rpg/metal_02.ogg",
    "sfx_spin": f"{SRC}/sfx_rpg/blade_03.ogg",
    "sfx_dash": f"{SRC}/sfx_rpg/blade_02.ogg",
    "sfx_hurt": f"{SRC}/sfx_creature/hurt_01.ogg",
    "sfx_pickup": f"{SRC}/sfx_rpg/item_gem_01.ogg",
    "sfx_quest": f"{SRC}/sfx_rpg/item_gem_04.ogg",
    "sfx_levelup": f"{SRC}/sfx_rpg/spell_01.ogg",
    "sfx_portal": f"{SRC}/sfx_rpg/spell_02.ogg",
    "sfx_roar": f"{SRC}/sfx_creature/roar_01.ogg",
    "sfx_die": f"{SRC}/sfx_rpg/creature_die_01.ogg",
    "sfx_bossdie": f"{SRC}/sfx_creature/monster_06.ogg",
}
def dur(p):
    r = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()), 2)
    except Exception:
        return -1

for key, src in BGM.items():
    dst = f"{AUD}/{key}.ogg"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "2", "-ar", "44100", "-q:a", "4", dst], check=True)
    print(f"  {key}.ogg {dur(dst)}s  {os.path.getsize(dst)//1024}KB")
for key, src in SFX.items():
    dst = f"{AUD}/{key}.ogg"
    shutil.copy(src, dst)
    print(f"  {key}.ogg {dur(dst)}s")

print("DONE")
