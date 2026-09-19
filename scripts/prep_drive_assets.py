#!/usr/bin/env python3
"""v1.3.0 — Drive 에셋(Unity VFX 팩 3종)을 웹 게임용으로 변환·경량화.
 - 텍스처: 다운스케일 + PNG 저장 → public/assets/vfx2/, public/assets/map/
 - 사운드: WAV → OGG(q4) 변환 → public/assets/audio/sfx/
출력은 전부 게임에서 tint/blend로 재활용 가능한 흑백/알파 중심.
"""
import os, subprocess, sys
from PIL import Image

F1 = "/home/z/my-project/upload/drive_extracted/file1"
F2 = "/home/z/my-project/upload/drive_extracted/file2"
F3 = "/home/z/my-project/upload/drive_extracted/file3"
VFX = "/home/z/my-project/public/assets/vfx2"
MAP = "/home/z/my-project/public/assets/map"
SFX = "/home/z/my-project/public/assets/audio/sfx"
for d in (VFX, MAP, SFX):
    os.makedirs(d, exist_ok=True)

# (src, dst, max_size) — max_size: 가로/세로 큰 쪽 상한(None=원본 유지)
TEX = [
    # Matthew Guz Slash Effects FREE — 근접 타격감
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Slash.png",        "vfx_slash",      128),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Slash M.png",      "vfx_slash_m",    160),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Slash turn.png",   "vfx_slash_turn", 128),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Crit_2.png",       "vfx_crit",       160),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-explosion.png",    "vfx_explosion",  160),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Shockwave 2.png",  "vfx_shock",      160),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Fire.png",         "vfx_fire",       128),
    (f"{F3}/Matthew Guz/Slash Effects FREE/Textures/5-Spark.png",        "vfx_spark",      128),
    # GameVFX Buff Collection — 오라/버프/번개
    (f"{F1}/GameVFX Buff Collection/Textures/Electro03.png",             "vfx_bolt",       128),
    (f"{F1}/GameVFX Buff Collection/Textures/lightning02_01_blue.png",   "vfx_bolt2",      128),
    (f"{F1}/GameVFX Buff Collection/Textures/Flare21.png",               "vfx_flare",      160),
    (f"{F1}/GameVFX Buff Collection/Textures/Twinkle_b.png",             "vfx_twinkle",     64),
    (f"{F1}/GameVFX Buff Collection/Textures/star4.png",                 "vfx_star4",      128),
    (f"{F1}/GameVFX Buff Collection/Textures/ring02_00.png",             "vfx_ring",       160),
    (f"{F1}/GameVFX Buff Collection/Textures/Ring02.png",                "vfx_arc",        128),
    (f"{F1}/GameVFX Buff Collection/Textures/Hexagon_01.png",            "vfx_hex",        128),
    (f"{F1}/GameVFX Buff Collection/Textures/glow_blue_01.png",          "vfx_glowb",      128),
    (f"{F1}/GameVFX Buff Collection/Textures/glow_yellow_01.png",        "vfx_glowy",      128),
    (f"{F1}/GameVFX Buff Collection/Textures/Furnace_Buff.png",          "vfx_furnace",    128),
    # Vefects Anime Stylized VFX — 스킬 임팩트/파티클
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Impact_01.png",   "vfx_ist",   160),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Impact_02.png",   "vfx_is2",   160),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_01.png","vfx_ltn1",  128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_02.png","vfx_ltn2",  128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Lightning_03.png","vfx_ltn3",  128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Cloud_01.png",    "vfx_cl1",   128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Cloud_02.png",    "vfx_cl2",   128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Cloud_03.png",    "vfx_cl3",   128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_01.png",     "vfx_pt1",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_02.png",     "vfx_pt2",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_03.png",     "vfx_pt3",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_04.png",     "vfx_pt4",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_05.png",     "vfx_pt5",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_06.png",     "vfx_pt6",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_07.png",     "vfx_pt7",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Part_08.png",     "vfx_pt8",    64),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Ring_01.png",     "vfx_ring1", 128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Ring_03.png",     "vfx_ring3", 128),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Flower_01.png",   "vfx_flower", 96),
    (f"{F2}/Vefects/Anime Stylized VFX/Shared/Textures/T_VFX_Arrow_01.png",    "vfx_arrowp", 96),
    # Hovl Studio Magic effects — 마법진/투사체/속성
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/MagicCircle2.png",   "vfx_magic",      512),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/TechCircle2.png",    "vfx_magic2",     512),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/Snowflake.png",      "vfx_snow",       128),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/Splat.png",          "vfx_splat",      128),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/Heart.png",          "vfx_heal_heart",  96),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/CrystalFree1.png",   "vfx_crystal",    128),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/ProjectileFree1.png","vfx_proj",       128),
    (f"{F3}/Hovl Studio/Magic effects pack/Textures/FlashFree1.png",     "vfx_flash",      128),
    # UNI VFX Missiles & Explosions — 폭발/별
    (f"{F1}/UNI VFX/Missiles & Explosions/Textures/uni_tile_starry.png",       "vfx_starry", 512),
    (f"{F1}/UNI VFX/Missiles & Explosions/Textures/uni_shockwave_fiery.png",   "vfx_shockf", 512),
    (f"{F1}/UNI VFX/Missiles & Explosions/Textures/uni_exp_core.png",          "vfx_expc",   256),
    (f"{F1}/UNI VFX/Common/Textures/WispySmoke03b_8x8.png",                    "vfx_wisp",   512),
    # CartoonVFX9X Fireworks — 축하연출(레벨업/랭킹)
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Heart.png",       "vfx_fw_heart", 96),
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Moon.png",        "vfx_fw_moon",  96),
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Star_Blue.png",   "vfx_fw_star_b", 96),
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Star_Yellow.png", "vfx_fw_star_y", 96),
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Triangle.png",    "vfx_fw_tri",   96),
    (f"{F1}/CartoonVFX9X/FireworksEffect2D/Textures/Smile_Face.png",  "vfx_fw_smile", 96),
    # Cherry Petals — 마을 벚꽃
    (f"{F3}/Petal Particles - Cherry Petals/Particle/Textures/CherryPetal.png", "vfx_petal", 32),
]

MAP_TEX = [
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX Tileset Ground.png",  "map_ground", None),
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX Village Props.png",   "map_props",  None),
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX Chest Animation.png", "map_chest",  None),
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX FX Flame.png",        "map_flame",  None),
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX FX Torch Flame.png",  "map_torch",  None),
    (f"{F1}/Cainos/Interactive Pixel Water/Texture/TX FX Water Bubble.png",              "map_bubble", None),
    (f"{F1}/Cainos/Pixel Art Platformer - Village Props/Texture/TX Tileset Ground.png",  "map_ground", None),
]

# WAV → OGG 사운드 매핑 (dst는 sfx_ 접두)
SOUNDS = {
    "SFX_BasicAttack.wav":  "sfx_hit_basic",
    "SFX_Arrow_Shot_Cast.wav": "sfx_arrow_cast",
    "SFX_Arrow_Shot_Hit.wav":  "sfx_arrow_hit",
    "SFX_Bomb_Cast.wav":    "sfx_bomb_cast",
    "SFX_Bomb_Explosion.wav": "sfx_bomb_exp",
    "SFX_FireBall_Cast.wav": "sfx_fire_cast",
    "SFX_FireBall_Hit.wav":  "sfx_fire_hit",
    "SFX_Lightning_Cast.wav": "sfx_bolt_cast",
    "SFX_Lightning_Hit.wav":  "sfx_bolt_hit",
    "SFX_Heal_Cast.wav":    "sfx_heal_cast",
    "SFX_Buff_Cast.wav":    "sfx_buff_cast",
    "SFX_Debuff_Cast.wav":  "sfx_debuff_cast",
    "SFX_Dash.wav":         "sfx_dash",
    "SFX_Pick_Up.wav":      "sfx_pickup",
    "SFX_Explosion.wav":    "sfx_explosion",
    "SFX_Explosion_Ice.wav": "sfx_explosion_ice",
    "SFX_Vefects_Stylized_AoE_Fire_Area_Cast_01.wav":  "sfx_aoe_fire_cast",
    "SFX_Vefects_Stylized_AoE_Fire_Burst_01.wav":      "sfx_aoe_fire_burst",
    "SFX_Vefects_Stylized_AoE_Ice_Area_Cast_01.wav":   "sfx_aoe_ice_cast",
    "SFX_Vefects_Stylized_AoE_Ice_Burst_01.wav":       "sfx_aoe_ice_burst",
    "SFX_Vefects_Stylized_AoE_Light_Area_Cast_01.wav": "sfx_aoe_light_cast",
    "SFX_Vefects_Stylized_AoE_Light_Burst_01.wav":     "sfx_aoe_light_burst",
    "SFX_Vefects_Stylized_AoE_Dark_Area_Cast_01.wav":  "sfx_aoe_dark_cast",
    "SFX_Vefects_Stylized_AoE_Dark_Burst_01.wav":      "sfx_aoe_dark_burst",
    "SFX_Vefects_Stylized_AoE_Electric_Area_Cast_01.wav": "sfx_aoe_elec_cast",
    "SFX_Vefects_Stylized_AoE_Electric_Burst_01.wav":     "sfx_aoe_elec_burst",
    "SFX_Vefects_Stylized_AoE_Earth_Area_Cast_01.wav": "sfx_aoe_earth_cast",
    "SFX_Vefects_Stylized_AoE_Earth_Burst_01.wav":     "sfx_aoe_earth_burst",
    "SFX_Vefects_Stylized_AoE_Water_Area_Cast_01.wav": "sfx_aoe_water_cast",
    "SFX_Vefects_Stylized_AoE_Water_Burst_01.wav":     "sfx_aoe_water_burst",
    "SFX_Vefects_Stylized_AoE_Poison_Area_Cast_01.wav": "sfx_aoe_poison_cast",
    "SFX_Vefects_Stylized_AoE_Poison_Burst_01.wav":     "sfx_aoe_poison_burst",
    "SFX_Vefects_Stylized_AoE_Void_Area_Cast_01.wav":  "sfx_aoe_void_cast",
    "SFX_Vefects_Stylized_AoE_Void_Burst_01.wav":      "sfx_aoe_void_burst",
    "SFX_Vefects_Stylized_AoE_Heal_Area_Cast_01.wav":  "sfx_aoe_heal_cast",
    "SFX_Vefects_Stylized_AoE_Heal_Burst_01.wav":      "sfx_aoe_heal_burst",
    "SFX_Vefects_Stylized_AoE_Nature_Area_Cast_01.wav": "sfx_aoe_nature_cast",
    "SFX_Vefects_Stylized_AoE_Nature_Burst_01.wav":     "sfx_aoe_nature_burst",
    "SFX_Vefects_Stylized_AoE_Magma_Burst_01.wav":     "sfx_aoe_magma_burst",
    "SFX_Vefects_Stylized_AoE_Crystal_Burst_01.wav":   "sfx_aoe_crystal_burst",
    "SFX_Vefects_Stylized_AoE_Blood_Burst_01.wav":     "sfx_aoe_blood_burst",
    "SFX_Vefects_Stylized_AoE_Air_Burst_01.wav":       "sfx_aoe_air_burst",
    "SFX_Smoke_Bombs_Fire_Storm.wav":   "sfx_smoke_fire",
    "SFX_Smoke_Bombs_Snow_Storm.wav":   "sfx_smoke_snow",
    "SFX_Smoke_Bombs_Thunder_Storm.wav": "sfx_smoke_thunder",
    "SFX_Smoke_Bombs_Toxic.wav":        "sfx_smoke_toxic",
    "SFX_Smoke_Bombs_Golden_Sand_Storm.wav": "sfx_smoke_gold",
    "SFX_Smoke_Bombs_Darkness.wav":     "sfx_smoke_dark",
}

def find_sound(name: str) -> str | None:
    for root in (F2, F1, F3):
        for dp, _, fns in os.walk(root):
            if name in fns:
                return os.path.join(dp, name)
    return None

def conv_tex(src, dst, maxpx, outdir):
    if not os.path.exists(src):
        return f"MISS {src}"
    im = Image.open(src).convert("RGBA")
    if maxpx and max(im.size) > maxpx:
        im.thumbnail((maxpx, maxpx), Image.LANCZOS)
    im.save(f"{outdir}/{dst}.png", optimize=True)
    return f"{dst}.png {im.size[0]}x{im.size[1]}"

def main():
    n_ok = 0
    for src, dst, maxpx in TEX + MAP_TEX:
        outdir = MAP if dst.startswith("map_") else VFX
        r = conv_tex(src, dst, maxpx, outdir)
        if not r.startswith("MISS"):
            n_ok += 1
        else:
            print(r)
    print(f"textures: {n_ok}/{len(TEX) + len(MAP_TEX)}")
    n_s = 0
    for wav, dst in SOUNDS.items():
        src = find_sound(wav)
        if not src:
            print(f"SND MISS {wav}")
            continue
        out = f"{SFX}/{dst}.ogg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:a", "libvorbis", "-q:a", "4", out], check=True)
        n_s += 1
    print(f"sounds: {n_s}/{len(SOUNDS)}")

if __name__ == "__main__":
    main()
