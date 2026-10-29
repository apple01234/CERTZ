#!/usr/bin/env python3
"""Unity VFX 팩 2종 → 게임 이펙트 텍스처 이관 (v1.4.41).

유저 지적: "왜 그대로 못씀?? WebGL로 쓸수 있잖아" / "UNI VFX 여기도 많음"

전제 정정
--------
프리팹(.prefab)은 Unity 직렬화 형식이라 그대로는 못 쓴다. **하지만 그 안의 텍스처는
1024×1024 PNG/TGA 이고, 팩에 Additive.shader 가 동봉돼 있다.** Phaser 의
`BlendModes.ADD` 가 정확히 같은 가산광이라 연출 재현에는 아무 손실이 없다.
(실측: GameVFX Buff 40장 중 알파 보유 27장, UNI VFX 20장)

무엇을 가져오나
--------------
프리팹 이름이 곧 용도다. 원본 화풍을 유지하려고 색보정하지 않고 **긴 변 512 로만** 줄인다
(1024² 10장이면 모바일 메모리 40MB↑). 알파 없는 가산광 마스크는 그대로 두는 게 맞다 —
ADD 블렌드에서 검정이 투명으로 작동한다.

  python3 tools/import_vfx_packs.py --dry-run
  python3 tools/import_vfx_packs.py --apply
"""
import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNI = os.path.join(ROOT, "..", "assets_in", "uni")
BUFF_TEX = os.path.join(UNI, "GameVFX Buff Collection", "Textures")
UNI_TEX = os.path.join(UNI, "UNI VFX", "Missiles & Explosions", "Textures")
UNI_COMMON = os.path.join(UNI, "UNI VFX", "Common", "Textures")
DST = os.path.join(ROOT, "public", "assets")

MAX_SIDE = 512

# 게임 키 → (소스 디렉터리, 파일명)
#  키 이름은 "게임에서 무엇으로 쓰는지"로 짓는다. 프리팹 원어명은 주석에 남긴다.
IMPORT = [
    # ── GameVFX Buff Collection (버프/보호막/성장) ──
    # FX_Buff_EnergyShield / FX_Buff_HexagonShield — 5차 보호막·각성 오라
    ("gvb_shield_hex", BUFF_TEX, "Hexagon_01.png"),
    ("gvb_ring_soft", BUFF_TEX, "ring02_00.png"),
    # FX_Buff_Lightningball — 전격구
    ("gvb_electric_splat", BUFF_TEX, "Electric_Splat_Hit_02.png"),
    ("gvb_lightning_blue", BUFF_TEX, "lightning02_01_blue.png"),
    # FX_Buff_Air — 상승 기류(각성 광주)
    ("gvb_buff_air", BUFF_TEX, "Furnace_Buff.png"),
    ("gvb_grad_soft", BUFF_TEX, "grad01_13.png"),
    # FX_Buff_ColorLine — 색 궤적(궤도 링)
    ("gvb_trail_stylized", BUFF_TEX, "StylizedTrail03.png"),
    ("gvb_twinkle", BUFF_TEX, "Twinkle_b.png"),
    # FX_Buff_GoldStar / GreenStar — 레벨업·회복
    ("gvb_glow_white", BUFF_TEX, "M_Glow_01A.tga"),
    ("gvb_star4", BUFF_TEX, "star4.png"),
    ("gvb_star_green", BUFF_TEX, "sl-g01g_1R.png"),
    ("gvb_twink_01", BUFF_TEX, "twink_01.png"),
    # FX_Buff_Feather — 잔상 파편
    ("gvb_shard", BUFF_TEX, "particle_sprite_shard2.png"),
    ("gvb_lensflare", BUFF_TEX, "sprite_lensflare.png"),
    # FX_Buff_MagicAir — 마법 기류
    ("gvb_glow_blurry", BUFF_TEX, "glowblurry.png"),
    ("gvb_smoke_pink", BUFF_TEX, "smoke_pink2.png"),
    # FX_Buff_WindBall — 바람 구체
    ("gvb_glow_blue", BUFF_TEX, "glow_blue_01.png"),

    # ── UNI VFX (투사체·폭발 — 궁극기 핵심) ──
    # Outburst — 폭발 코어
    ("gvu_exp_core", UNI_TEX, "uni_exp_core.png"),
    ("gvu_circle_aggr", UNI_TEX, "uni_circle_aggressive.png"),
    # Sweeping Wave — 충격파
    ("gvu_shockwave_fiery", UNI_TEX, "uni_shockwave_fiery.png"),
    ("gvu_trail_wave", UNI_TEX, "uni_trail_wave.png"),
    # Lightning Spear — 전격창
    ("gvu_energybolts", UNI_TEX, "uni_energybolts.png"),
    ("gvu_linelong", UNI_TEX, "uni_linelong.png"),
    # Onslaught — 에너지 그물
    ("gvu_energyweb", UNI_TEX, "uni_energyweb.png"),
    ("gvu_energynoise", UNI_TEX, "uni_energynoise.png"),
    # Mark of Death — 낙인(마법진)
    ("gvu_mask_ommi", UNI_TEX, "uni_mask_ommi.png"),
    ("gvu_mask_razor", UNI_TEX, "uni_mask_razor.png"),
    # Comet — 혜성 꼬리
    ("gvu_trail_ghost", UNI_TEX, "uni_trail_ghost.png"),
    ("gvu_streaks", UNI_TEX, "uni_streaks_horizontal.png"),
    # Strafe — 확산 파편
    ("gvu_specks", UNI_TEX, "uni_specks.png"),
    ("gvu_flare_xo", UNI_TEX, "uni_flare_xo.png"),
    # 공통
    ("gvu_glow", UNI_COMMON, "uni_glow.png"),
    ("gvu_spark", UNI_COMMON, "uni_spark.png"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.apply and not a.dry_run:
        ap.print_help()
        return 1

    made, skipped = 0, 0
    for key, srcdir, fname in IMPORT:
        sp = os.path.join(srcdir, fname)
        if not os.path.exists(sp):
            print(f"  SKIP {key} — {fname} 없음")
            skipped += 1
            continue
        im = Image.open(sp).convert("RGBA")
        w, h = im.size
        if max(w, h) > MAX_SIDE:
            k = MAX_SIDE / max(w, h)
            im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        dp = os.path.join(DST, f"{key}.webp")
        if a.apply:
            im.save(dp, "WEBP", quality=94, method=6)
        made += 1
        print(f"  {key:<22} ← {fname:28s} {w}x{h} → {im.size[0]}x{im.size[1]}")

    print(f"\n{'APPLY' if a.apply else 'DRY-RUN'} — {made}장 이관 / {skipped}장 건너뜀")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
