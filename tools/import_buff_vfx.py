#!/usr/bin/env python3
"""GameVFX Buff Collection → 게임 이펙트 텍스처 이관 (v1.4.41).

배경
----
`assets_in/uni/GameVFX Buff Collection` 은 Unity 파티클 프리팹 10종이다.
프리팹(.prefab)은 Unity 직렬화 형식이라 그대로 못 쓰지만, **프리팹이 참조하는
텍스처는 1024×1024 PNG/TGA**이고 팩에 `Additive.shader` 가 들어 있다.
즉 Phaser 의 `BlendModes.ADD` 로 **동일한 가산광 연출**이 그대로 재현된다.
(알파 채널도 살아 있어 마스크 이펙트로 바로 쓸 수 있다 — 실측 40개 중 27개 알파 보유)

이 스크립트가 하는 일
--------------------
프리팹별로 **주 텍스처 1~2장**을 골라 `public/assets/gvb_*.webp` 로 이관한다.
이름 접두어 `gvb_` = GameVFX Buff. 원본 화풍을 유지하려고 리사이즈·색보정은 하지 않는다
(1024² 는 모바일에서 무거우므로 **긴 변 512 로만** 줄인다 — 퀄리티 손실 최소).

  python3 tools/import_buff_vfx.py --dry-run
  python3 tools/import_buff_vfx.py --apply
"""
import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "assets_in", "uni", "GameVFX Buff Collection", "Textures")
DST = os.path.join(ROOT, "public", "assets")

# 프리팹 이름 → (게임 키, 주 텍스처, 보조 텍스처)
#  매핑 근거: 각 .prefab 이 참조하는 .mat → .mat 이 쓰는 텍스처를 guid 로 역추적한 실측 결과.
#  게임 키는 "무엇에 쓰는지"로 짓는다(프리팹 원어명은 검색용 주석으로만 남긴다).
IMPORT = [
    # EnergyShield → Hexagon 방패. 5차 오라·보호막에 사용
    ("gvb_shield_hex", "Hexagon_01.png", "ring02_00.png"),
    # HexagonShield → 이중 방패(안쪽 육각 + 바깥 원)
    ("gvb_shield_double", "Hexagon_01.png", "ring_02.png"),
    # Lightningball → 전격구. 마법사 계열 궁극기에 사용
    ("gvb_lightning_ball", "Electric_Splat_Hit_02.png", "lightning02_01_blue.png"),
    # Air → 상승 기류(버프). 5차 각성 상승 광주
    ("gvb_air_rise", "Furnace_Buff.png", "grad01_13.png"),
    # ColorLine → 색 궤적. 궁극기 궤도 링
    ("gvb_color_trail", "StylizedTrail03.png", "Twinkle_b.png"),
    # GoldStar → 황금 별. 레벨업·보상 연출
    ("gvb_gold_star", "M_Glow_01A.tga", "star4.png"),
    # GreenStar → 생기 별. 회복·버프
    ("gvb_green_star", "sl-g01g_1R.png", "twink_01.png"),
    # Feather → 깃털 흩날림. 이동·회피 잔상
    ("gvb_feather", "particle_sprite_shard2.png", "sprite_lensflare.png"),
    # MagicAir → 마법 기류. 마법진 상승
    ("gvb_magic_air", "glowblurry.png", "smoke_pink2.png"),
    # WindBall → 바람 구체. 궁수·질풍 계열
    ("gvb_wind_ball", "glow_blue_01.png", "ring02_00.png"),
]

MAX_SIDE = 512  # 모바일 메모리 — 1024² 그대로 두면 10장이 40MB 를 넘는다


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.apply and not a.dry_run:
        ap.print_help()
        return 1

    if not os.path.isdir(SRC):
        print(f"소스 없음: {SRC}")
        return 2

    made = 0
    for key, main_tex, sub_tex in IMPORT:
        for suffix, tex in (("", main_tex), ("_b", sub_tex)):
            sp = os.path.join(SRC, tex)
            if not os.path.exists(sp):
                print(f"  SKIP {key}{suffix} — {tex} 없음")
                continue
            dp = os.path.join(DST, f"{key}{suffix}.webp")
            im = Image.open(sp).convert("RGBA")
            w, h = im.size
            if max(w, h) > MAX_SIDE:
                k = MAX_SIDE / max(w, h)
                im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
            if a.apply:
                im.save(dp, "WEBP", quality=94, method=6)
            made += 1
            print(f"  {key}{suffix:<4} ← {tex:28s} {w}x{h} → {im.size[0]}x{im.size[1]}")

    print(f"\n{'APPLY' if a.apply else 'DRY-RUN'} — {made}장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
