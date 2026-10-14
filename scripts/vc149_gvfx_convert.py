#!/usr/bin/env python3
"""vc149 — 유저 제공 GameVFX 3D 팩(Unity)에서 2D 가용 파티클 텍스처 추출 → public/assets/vfx3/gv_*.webp
선별 기준: 가산 블렌드에 적합한 알파 텍스처, 최대 변 512px로 다운스케일, webp q80.
"""
import os
from PIL import Image

SRC = "/tmp/vfx_extract"
DST = "/home/z/my-project/public/assets/vfx3"
MAX_SIDE = 512
Q = 80

# (원본파일명, 출력키 접미) — 마법진(MagicCircle*) 제외하고는 gv_ 프리픽스. 마법사 전용 2종은 gv_rune_*
PICK = [
    # uni_* — 범용 고품질 파티클
    "uni_shockwave_fiery", "uni_exp_core", "uni_energybolts", "uni_energyweb",
    "uni_energynoise", "uni_flare_xo", "uni_specks", "uni_streaks_horizontal",
    "uni_tile_fiery", "uni_tile_spiky", "uni_tile_starry", "uni_trail_ghost",
    "uni_trail_wave", "uni_cone_long", "uni_circle_aggressive", "uni_circle_hazy",
    "uni_glow", "uni_spark", "uni_linelong", "uni_smoke",
    # cfxr_* — 근접/타격/해골/전기/물
    "cfxr sword trail mask light", "cfxr sword trail mask lines",
    "cfxr ring ice", "cfxr ring electric", "cfxr ring spikes revert",
    "cfxr hit triangle", "cfxr hit triangle dissolve",
    "cfxr skull 2", "cfxr magic star",
    "cfxr electric arc anim x4", "cfxr electric arcs x4",
    "cfxr water small splash stretch", "cfxr aura rays", "cfxr aura runic",
    "cfxr heart", "cfxr stretch ray blur", "cfxr stretch spike fade",
    "cfxr stretch sipkes x2", "cfxr flamme crisp",
    "cfxr smoke cloud x4 white", "cfxr star blurred",
    # Free 시리즈
    "FlashFree1", "FlashFree2", "FlashFree3", "GlowFree1",
    "CraterFree1", "CrystalFree1", "ProjectileFree1",
    # 전기/번개/스플랫
    "Electric_Splat_Hit_02", "Electro03", "lightning02_01_blue",
    # 글로우/플레어/헥사/별
    "glow_blue_01", "glow_yellow_01", "glowblurry", "flare02_white",
    "sprite_lensflare", "Hexagon_01", "star4", "Twinkle_b", "twink_01",
    # 연기/독/트레일
    "poison_smoke_pink", "smoke_pink2", "trail_pink", "WispySmoke03b_8x8",
    "Smoke26", "SmokeFree1",
    # 지형/잔해/기타
    "Crack", "Snowflake", "Circle", "Circle2", "Ring02", "Splat",
    "Star", "TechCircle2", "StylizedTrail03", "Gradient2",
    "cfxr fire circle drawn", "cfxr puddle", "cfxr ember blur",
    # 마법진은 마법사 전용 (gv_rune_* 프리픽스로 구분)
    ("MagicCircle", "gv_rune_big"), ("MagicCircle2", "gv_rune_glow"),
]

def sanitize(key: str) -> str:
    k = key.lower().strip()
    k = k.replace(" ", "_").replace("-", "_")
    while "__" in k:
        k = k.replace("__", "_")
    return k

os.makedirs(DST, exist_ok=True)
done, skipped = [], []
for entry in PICK:
    if isinstance(entry, tuple):
        src_name, out_key = entry
    else:
        src_name, out_key = entry, "gv_" + sanitize(entry)
    # 파일 탐색
    hit = None
    for root, _, files in os.walk(SRC):
        for f in files:
            if f.lower() == src_name.lower() + ".png":
                hit = os.path.join(root, f)
                break
        if hit:
            break
    if not hit:
        skipped.append(src_name)
        continue
    im = Image.open(hit).convert("RGBA")
    w, h = im.size
    if max(w, h) > MAX_SIDE:
        s = MAX_SIDE / max(w, h)
        im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    # 프리멀티 불필요(가산 블렌드 + WEBP 알파) — q80 저장
    out = os.path.join(DST, out_key + ".webp")
    im.save(out, "WEBP", quality=Q, method=4)
    done.append((out_key, im.size[0], im.size[1], os.path.getsize(out)))

print(f"변환 {len(done)}개 / 미발견 {len(skipped)}개: {skipped}")
total = sum(d[3] for d in done)
print(f"총 용량: {total:,}B ({total/1024:.0f}KB)")
for k, w, h, s in done:
    print(f"  {k:38s} {w}x{h} {s:>8,}B")
