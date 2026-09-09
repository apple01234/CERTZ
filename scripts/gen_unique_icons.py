#!/usr/bin/env python3
# SERTZ 중복 아이콘 해소 — 고유 아이콘 자동 생성 (v1.0.2, 유저 지시 Phase 3)
# 규칙: 서로 다른 아이템은 동일 아이콘 금지. 베이스 아이콘에 고유 색조(hue) 변환 +
#       등급 젬 배지를 얹어 i_<key>.webp 로 생성. 32x32 유지.
from PIL import Image, ImageDraw
import colorsys, os

A = "public/assets"
def base(name): return Image.open(f"{A}/{name}.webp").convert("RGBA")

def hue_shift(img, deg, sat=1.0, val=1.0):
    """RGBA 이미지에 hue 회전(도) + 채도/명도 배율 적용 (알파 보존)"""
    img = img.copy(); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
            h = (h + deg/360.0) % 1.0
            s = max(0.0, min(1.0, s * sat))
            l = max(0.0, min(1.0, l * val))
            r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
            px[x, y] = (int(r2*255), int(g2*255), int(b2*255), a)
    return img

def gem(img, rgb, corner="tr"):
    """우상단(기본)에 3px 젬 배지 — 그룹 내 항목 구별용"""
    img = img.copy(); d = ImageDraw.Draw(img)
    x, y = 26, 3 if corner == "tr" else 26
    d.ellipse([x, y, x+5, y+5], fill=rgb + (255,), outline=(20,20,28,255))
    d.point([x+2, y-1], fill=(255,255,255,220))
    return img

def tier_frame(img, rgb):
    """티어 색 1px 테두리"""
    img = img.copy(); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 31, 31], outline=rgb + (255,))
    return img

TIER = {"common": (200,207,216), "rare": (111,242,216), "epic": (210,157,255), "legend": (255,215,106)}

# (신규파일, 베이스, hue도, 채도, 명도, 젬색(rgb), 티어)
JOBS = [
  # ── BM 물약 hp7~10 / mp7~10 (엘릭서 아이콘 잘못 공유 — 전부 신규)
  ("i_potion_hp7",  "item_potion_elixir", 8,   1.15, 1.05, (255,112,67),  "rare"),
  ("i_potion_hp8",  "item_potion_elixir", 20,  1.2,  1.0,  (244,81,30),   "epic"),
  ("i_potion_hp9",  "item_potion_elixir", 32,  1.25, 0.95, (229,57,53),   "epic"),
  ("i_potion_hp10", "item_potion_elixir", 44,  1.3,  0.88, (183,28,28),   "legend"),
  ("i_potion_mp7",  "item_potion_elixir", 200, 1.15, 1.05, (79,195,247),  "rare"),
  ("i_potion_mp8",  "item_potion_elixir", 215, 1.2,  1.0,  (41,182,246),  "epic"),
  ("i_potion_mp9",  "item_potion_elixir", 230, 1.25, 0.95, (92,107,192),  "epic"),
  ("i_potion_mp10", "item_potion_elixir", 245, 1.3,  0.88, (49,27,146),   "legend"),
  # ── 상급 물약 티어 구별 (hp3~6 / mp3~6)
  ("i_potion_hp3", "item_potion_hp2", 14, 1.1, 1.05, (255,183,77), "rare"),
  ("i_potion_hp4", "item_potion_hp2", 28, 1.15, 1.0, (255,138,101), "rare"),
  ("i_potion_hp5", "item_potion_hp2", 42, 1.2, 0.95, (239,83,80),  "epic"),
  ("i_potion_hp6", "item_potion_hp2", 56, 1.25, 0.9, (198,40,40),  "epic"),
  ("i_potion_mp3", "item_potion_mp2", 14, 1.1, 1.05, (129,212,250), "rare"),
  ("i_potion_mp4", "item_potion_mp2", 28, 1.15, 1.0, (41,182,246),  "rare"),
  ("i_potion_mp5", "item_potion_mp2", 42, 1.2, 0.95, (30,136,229),  "epic"),
  ("i_potion_mp6", "item_potion_mp2", 56, 1.25, 0.9, (12,97,232),   "epic"),
  # ── 반지 (item_ring_crit 계열)
  ("i_bd_fenrir",    "item_ring_crit", 120, 1.3, 1.0, (255,215,106), "legend"),
  ("i_ring_swift",   "item_ring_crit", 150, 1.2, 1.1, (111,242,216), "rare"),
  ("i_ring_fortune", "item_ring_crit", 170, 1.25, 1.05,(255,215,106), "epic"),
  ("i_ring_phantom", "item_ring_crit", 190, 1.15, 0.85,(168,85,247),  "epic"),
  ("i_sfr_alfheim",  "item_ring_crit", 100, 1.2, 1.05,(129,199,132), "rare"),
  ("i_sfr_cave",     "item_ring_crit", 80,  1.1, 0.9, (141,110,99),  "rare"),
  ("i_sfr_abyss",    "item_ring_crit", 220, 1.2, 0.8, (94,53,177),   "epic"),
  # ── 반지 (item_ring_power 계열)
  ("i_bd_nidhog",        "item_ring_power", 90,  1.3, 1.0,  (255,213,79), "legend"),
  ("i_bd_surt",          "item_ring_power", 20,  1.3, 0.95, (255,87,34),  "legend"),
  ("i_ring_might",       "item_ring_power", 140, 1.25, 1.05,(239,83,80),  "epic"),
  ("i_sfr_kingdom",      "item_ring_power", 160, 1.2, 1.05, (100,181,246),"rare"),
  ("i_sfr_muspelheim",   "item_ring_power", 35,  1.25, 1.0,  (255,112,67),"rare"),
  ("i_sfr_hel",          "item_ring_power", 210, 1.2, 0.85, (121,134,203),"rare"),
  # ── 반지 (item_ring_guard 계열)
  ("i_bd_guardian",   "item_ring_guard", 130, 1.3, 1.0,  (255,215,106), "legend"),
  ("i_bd_gram",       "item_ring_guard", 150, 1.25,0.95, (129,255,192), "legend"),
  ("i_ring_titan",    "item_ring_guard", 100, 1.2, 1.1,  (255,171,145), "epic"),
  ("i_sfr_niflheim",  "item_ring_guard", 180, 1.1, 1.05, (79,195,247),  "rare"),
  ("i_sfr_nidavellir","item_ring_guard", 60,  1.15,1.0,  (255,202,40),  "rare"),
  # ── 반지 (item_ring_vital 계열)
  ("i_bd_behemoth", "item_ring_vital", 130, 1.3, 1.0,  (255,215,106), "legend"),
  ("i_sfr_forest",  "item_ring_vital", 120, 1.15,1.05, (129,199,132), "rare"),
  # ── 목걸이 (item_pendant_arcane 계열)
  ("i_bd_skoll",      "item_pendant_arcane", 130, 1.3, 1.0,  (255,215,106), "legend"),
  ("i_bd_abysslord",  "item_pendant_arcane", 220, 1.25,0.8,  (156,39,176),  "legend"),
  ("i_bd_abudditos",  "item_pendant_arcane", 0,   1.35,0.9,  (244,67,54),   "legend"),
  ("i_pendant_moon",  "item_pendant_arcane", 190, 1.15,1.1,  (144,202,249), "epic"),
  ("i_pendant_sage",  "item_pendant_arcane", 160, 1.2, 1.05, (129,199,132), "epic"),
  ("i_pendant_star",  "item_pendant_arcane", 45,  1.2, 1.1,  (255,213,79),  "epic"),
  # ── 목걸이 (item_pendant_vital 계열)
  ("i_pendant_ward",  "item_pendant_vital", 140, 1.15,1.1,  (100,181,246), "rare"),
  ("i_pendant_blood", "item_pendant_vital", 20,  1.25,0.95, (229,57,53),   "epic"),
  # ── 큐브/상자 (item_eert_cube 공유 → 전부 분리)
  ("i_tier_cube",   "item_eert_cube", 120, 1.25, 1.1, (105,240,174), "epic"),
  ("i_chest_iron",  "item_eert_cube", 200, 0.5,  0.75,(144,164,174), "common"),
  ("i_chest_silver","item_eert_cube", 190, 0.9,  1.05,(207,216,220), "rare"),
  ("i_chest_gold",  "item_eert_cube", 40,  1.3,  1.1, (255,202,40),  "epic"),
  ("i_chest_legend","item_eert_cube", 260, 1.3, 0.95,(171,71,188),  "legend"),
  # ── 패키지 (item_coin 공유 → 전부 분리)
  ("i_pack_starter","item_coin", 140, 1.2, 1.1, (105,240,174), "rare"),
  ("i_pack_growth", "item_coin", 90,  1.25,1.05,(255,183,77),  "epic"),
  ("i_pack_premium","item_coin", 260, 1.25,1.0, (171,71,188),  "legend"),
  ("i_pack_ultimate","item_coin", 20, 1.3, 0.95,(244,67,54),   "legend"),
  ("i_pack_daily",  "item_coin", 200, 1.15,1.05,(79,195,247),  "rare"),
  ("i_pack_weekly", "item_coin", 160, 1.2, 1.0, (129,212,250), "epic"),
  # ── 펫
  ("i_pet_wisp",    "pet_pixie", 190, 1.1, 1.15, (79,195,247),  "rare"),
  ("i_pet_ember",   "pet_pixie", 25,  1.3, 0.95, (255,138,101), "epic"),
  ("i_pet_unicorn", "pet_pixie", 290, 1.2, 1.1,  (206,147,216), "legend"),
  ("i_pet_frost",   "pet_slime", 190, 1.15,1.1,  (79,195,247),  "epic"),
  ("i_pet_golem",   "pet_slime", 30,  0.8, 0.8,  (161,136,127), "epic"),
  ("i_pet_reaper",  "pet_atlas", 220, 1.15,0.75, (117,117,117), "legend"),
  # ── 책/버프 (item_scroll_star 공유)
  ("i_buff_luck", "item_scroll_star", 45,  1.25,1.1,  (255,213,79),  "rare"),
  ("i_exp_book",  "item_scroll_star", 200, 1.1, 1.05, (129,212,250), "rare"),
  ("i_buff_crit", "item_buff_atk",    140, 1.2, 1.05, (105,240,174), "rare"),
  # ── 챕터 무기 (shop weapon_2~6 공유 → 9종 분리)
  ("i_sfw_forest",     "item_weapon_2", 120, 1.15,1.05, (129,199,132), "rare"),
  ("i_sfw_kingdom",    "item_weapon_3", 160, 1.2, 1.05, (100,181,246), "rare"),
  ("i_sfw_alfheim",    "item_weapon_3", 90,  1.2, 1.1,  (255,213,79),  "rare"),
  ("i_sfw_muspelheim", "item_weapon_4", 25,  1.3, 0.95, (255,87,34),   "epic"),
  ("i_sfw_niflheim",   "item_weapon_4", 190, 1.1, 1.05, (79,195,247),  "epic"),
  ("i_sfw_cave",       "item_weapon_5", 80,  1.1, 0.9,  (141,110,99),  "rare"),
  ("i_sfw_nidavellir", "item_weapon_5", 50,  1.25,1.05, (255,202,40),  "epic"),
  ("i_sfw_hel",        "item_weapon_6", 210, 1.15,0.85, (121,134,203), "epic"),
  ("i_sfw_abyss",      "item_weapon_6", 230, 1.2, 0.8,  (94,53,177),   "legend"),
  # ── 챕터 방어구 (armor 2~6 공유 → 9종 분리)
  ("i_sfa_forest",     "item_armor_2", 120, 1.15,1.05, (129,199,132), "rare"),
  ("i_sfa_kingdom",    "item_armor_3", 160, 1.2, 1.05, (100,181,246), "rare"),
  ("i_sfa_alfheim",    "item_armor_3", 90,  1.2, 1.1,  (255,213,79),  "rare"),
  ("i_sfa_muspelheim", "item_armor_4", 25,  1.3, 0.95, (255,87,34),   "epic"),
  ("i_sfa_niflheim",   "item_armor_4", 190, 1.1, 1.05, (79,195,247),  "epic"),
  ("i_sfa_cave",       "item_armor_5", 80,  1.1, 0.9,  (141,110,99),  "rare"),
  ("i_sfa_nidavellir", "item_armor_5", 50,  1.25,1.05, (255,202,40),  "epic"),
  ("i_sfa_hel",        "item_armor_6", 210, 1.15,0.85, (121,134,203), "epic"),
  ("i_sfa_abyss",      "item_armor_6", 230, 1.2, 0.8,  (94,53,177),   "legend"),
  # ── 반지 (ring_bless 공유)
  ("i_ring_dragon",  "ring_bless", 25,  1.3, 0.95, (255,87,34),  "epic"),
  ("i_ring_ancient", "ring_bless", 45,  1.25,1.1,  (255,213,79), "legend"),
  # ── 치장 (2종씩 공유 → 분리)
  ("i_cos_frost",   "cos_aurora", 190, 1.1, 1.1,  (79,195,247),  "epic"),
  ("i_cos_storm",   "cos_aurora", 220, 1.2, 0.95, (121,134,203), "epic"),
  ("i_cos_holy",    "cos_dawn",   45,  1.15,1.1,  (255,213,79),  "epic"),
  ("i_cos_flame",   "cos_gold",   25,  1.3, 1.0,  (255,87,34),   "epic"),
  ("i_cos_shadow",  "cos_abyss",  250, 1.2, 0.7,  (84,110,122),  "epic"),
  ("i_cos_rainbow", "cos_wings",  140, 1.3, 1.1,  (240,98,146),  "legend"),
]

made = 0
for name, b, deg, sat, val, gemrgb, tier in JOBS:
    out = f"{A}/{name}.webp"
    if os.path.exists(out):
        print(f"skip {name} (exists)"); continue
    img = hue_shift(base(b), deg, sat, val)
    img = gem(img, gemrgb)
    img = tier_frame(img, TIER[tier])
    img.save(out, "WEBP", lossless=True)
    made += 1
print(f"생성 {made}종 / 스킵 {len(JOBS)-made}종")
