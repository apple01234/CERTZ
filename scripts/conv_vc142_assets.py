#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc142 — 유저 제공 에셋팩(UNI VFX / Hovl Studio / JMO Cartoon FX / GameVFX) 3차 통합 변환기
원칙: AI 생성 금지 — 유저가 직접 제공한 원본에서 필요한 프레임만 크롭·리사이즈.
출력: public/assets/vx_*.webp (+ 기존 public/assets 단일 스프라이트)
"""
from PIL import Image
import os, sys

BASE = "/home/z/my-project/download/gdrive_vfx/extracted"
OUT = "/home/z/my-project/public/assets"
os.makedirs(OUT, exist_ok=True)

def crop_grid(im, cols, rows):
    """그리드 슬라이스 → 프레임 리스트 (POT 스냅은 호출부에서)"""
    W, H = im.size
    fw, fh = W // cols, H // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            frames.append(im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)))
    return frames

def trim_canvas(frames, cell=None):
    """프레임들을 cell 크기로 정규화"""
    out = []
    for f in frames:
        if cell:
            f = f.resize((cell, cell), Image.LANCZOS)
        out.append(f)
    return out

def save_sheet(name, frames, cols, cell=None, quality=82):
    """프레임 시트를 webp로 저장. 반환: (cols, rows, fw, fh)"""
    if cell:
        frames = trim_canvas(frames, cell)
    fw, fh = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % cols) * fw, (i // cols) * fh))
    p = os.path.join(OUT, f"{name}.webp")
    sheet.save(p, "WEBP", quality=quality, method=4)
    kb = os.path.getsize(p) // 1024
    print(f"  [sheet] {name}.webp {sheet.size[0]}x{sheet.size[1]} {cols}x{rows} {kb}KB")
    return (cols, rows, fw, fh)

def save_single(name, im, cell=None, quality=82):
    if cell:
        im = im.resize((cell, cell), Image.LANCZOS)
    p = os.path.join(OUT, f"{name}.webp")
    im.save(p, "WEBP", quality=quality, method=4)
    print(f"  [single] {name}.webp {im.size[0]}x{im.size[1]} {os.path.getsize(p)//1024}KB")

def L(rel):
    return Image.open(os.path.join(BASE, rel)).convert("RGBA")

print("== vc142 asset conversion ==")

# ---------- 플립북 애니메이션 ----------
print("- flipbooks")
# 1) 유니 위스피 스모크 8x8 → 64프레임 중 8프레임 샘플 (2x2 시트 128px)
sm = L("UNI VFX/Common/Textures/WispySmoke03b_8x8.png")
fr = crop_grid(sm, 8, 8)
pick = [fr[i] for i in (0, 9, 18, 27, 36, 45, 54, 63)]
save_sheet("vx_smoke", pick, 4, cell=128)

# 2) 폭발 코어 2x2 → 4프레임 256px
ec = L("UNI VFX/Missiles & Explosions/Textures/uni_exp_core.png")
save_sheet("vx_expcore", crop_grid(ec, 2, 2), 2, cell=256)

# 3) 카툰 파이어 3x3 → 9프레임 128px
fs = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr fire small anim.png")
save_sheet("vx_fire", crop_grid(fs, 3, 3), 3, cell=128)

# 4) 전기 아크 7x2 → 14프레임 (292x256 → 128px)
el = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr electric small anim2 7x2.png")
save_sheet("vx_elec", crop_grid(el, 7, 2), 7, cell=128)

# 5) 번개 볼트 4x2 → 8프레임 128px
bo = L("UNI VFX/Missiles & Explosions/Textures/uni_energybolts.png")
save_sheet("vx_bolt", crop_grid(bo, 4, 2), 4, cell=128)

# 6) 스모크 클라우드 2x2 → 4프레임 192px
sc = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr smoke cloud x4 second color.png")
save_sheet("vx_smokecloud", crop_grid(sc, 2, 2), 2, cell=192)

# 7) 꽃잎 2x2 → 4프레임 192px (자연/독 테마)
pt = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr petal pink x4.png")
save_sheet("vx_petal", crop_grid(pt, 2, 2), 2, cell=192)

# 8) 파리 광점 2x2 → 4프레임 96px
fly = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr fly anim x4.png")
save_sheet("vx_fly", crop_grid(fly, 2, 2), 2, cell=96)

# 9) 잔해 3x3 → 9프레임 128px
db = L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr debris flat unlit 3x3.png")
save_sheet("vx_debris", crop_grid(db, 3, 3), 3, cell=128)

# ---------- 단일 스프라이트 ----------
print("- singles")
save_single("vx_slash", L("Hovl Studio/Magic effects pack/Textures/Slash.png"), cell=256)
save_single("vx_magiccircle", L("Hovl Studio/Magic effects pack/Textures/MagicCircle2.png"), cell=256)
save_single("vx_techcircle", L("Hovl Studio/Magic effects pack/Textures/TechCircle2.png"), cell=256)
save_single("vx_crystal", L("Hovl Studio/Magic effects pack/Textures/CrystalFree1.png").crop((0, 0, 256, 256)), cell=256)
save_single("vx_snow", L("Hovl Studio/Magic effects pack/Textures/Snowflake.png"))
save_single("vx_star", L("Hovl Studio/Magic effects pack/Textures/Star.png"), cell=256)
save_single("vx_splat", L("Hovl Studio/Magic effects pack/Textures/Splat.png"), cell=256)
save_single("vx_crack", L("Hovl Studio/Magic effects pack/Textures/Crack.png"), cell=256)
save_single("vx_flash", L("Hovl Studio/Magic effects pack/Textures/FlashFree2.png"), cell=256)
save_single("vx_flare", L("Hovl Studio/Magic effects pack/Textures/Flare.png"), cell=256)
save_single("vx_glowh", L("Hovl Studio/Magic effects pack/Textures/GlowFree1.png"), cell=256)
save_single("vx_ring", L("GameVFX Buff Collection/Textures/ring_02.png"), cell=256)
save_single("vx_hex", L("GameVFX Buff Collection/Textures/Hexagon_01.png"), cell=256)
save_single("vx_twinkle", L("GameVFX Buff Collection/Textures/star4.png"))
save_single("vx_glowball", L("GameVFX Buff Collection/Textures/glow_00001.png"), cell=256)
save_single("vx_lensflare", L("GameVFX Buff Collection/Textures/sprite_lensflare.png"), cell=256)
save_single("vx_aura", L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr aura runic.png"), cell=256)
save_single("vx_firecircle", L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr fire circle plain.png"), cell=256)
save_single("vx_puddle", L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr puddle.png"), cell=256)
save_single("vx_spikes", L("JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics/cfxr stretch spike fade.png").crop((0, 0, 256, 256)), cell=256)
save_single("vx_shockwave", L("UNI VFX/Missiles & Explosions/Textures/uni_shockwave_fiery.png").crop((0, 0, 512, 512)), cell=256)
save_single("vx_circlehazy", L("UNI VFX/Missiles & Explosions/Textures/uni_circle_hazy.png"), cell=256)
save_single("vx_flarexo", L("UNI VFX/Missiles & Explosions/Textures/uni_flare_xo.png"), cell=256)
save_single("vx_trailghost", L("UNI VFX/Missiles & Explosions/Textures/uni_trail_ghost.png").crop((0, 0, 512, 512)), cell=256)

print("done.")
