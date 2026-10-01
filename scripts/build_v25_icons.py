#!/usr/bin/env python3
"""SERTZ v2.5 신규 아이템 아이콘 생성 — 기존 CC0 아이콘 색조 변형 (24x24 RGBA)"""
from PIL import Image

A = "/home/z/my-project/CERTZ/public/assets"

def hue_shift(src, dst, r_mul, g_mul, b_mul, bright=1.0):
    im = Image.open(f"{A}/{src}.png").convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nr = min(255, int(r * r_mul * bright))
            ng = min(255, int(g * g_mul * bright))
            nb = min(255, int(b * b_mul * bright))
            px[x, y] = (nr, ng, nb, a)
    im.save(f"{A}/{dst}.png")
    print(f"  {dst}.png <- {src}.png")

print("[v2.5 아이템 아이콘 생성]")
# 상위 무기 (심연의 대검 변형)
hue_shift("item_weapon_4", "item_weapon_5", 1.15, 0.95, 0.55, 1.05)   # 용인의 마검 — 금빛
hue_shift("item_weapon_4", "item_weapon_6", 0.75, 0.65, 1.25, 1.1)    # 심연룡의 절세검 — 보라빛
# 상위 방어구 (수호자의 갑옷 변형)
hue_shift("item_armor_4", "item_armor_5", 1.1, 0.9, 0.6)              # 용린 갑주 — 황동빛
hue_shift("item_armor_4", "item_armor_6", 0.65, 0.75, 1.3)            # 심연룡의 비늘갑옷 — 청보라빛
# 상급 물약 (기존 물약 변형)
hue_shift("item_potion_hp", "item_potion_hp2", 1.0, 1.25, 1.3, 1.12)  # 상급 HP — 청록빛 하이라이트
hue_shift("item_potion_mp", "item_potion_mp2", 1.2, 1.0, 1.15, 1.12)  # 상급 MP — 진한 남빛
# 상위 장신구 (힘의 반지 변형)
hue_shift("item_ring_power", "item_ring_crit", 1.3, 0.75, 0.75, 1.1)  # 매의 눈 반지 — 붉은빛
hue_shift("item_ring_vital", "item_ring_guard", 0.75, 1.2, 0.9, 1.08) # 수호 반지 — 연두빛
# 스크롤 (물약 실루엣 기반 양피지 톤)
hue_shift("item_potion_mp", "item_scroll_return", 1.35, 1.15, 0.7, 1.05) # 마을 귀환서 — 황금 양피지
hue_shift("item_potion_mp", "item_scroll_warp", 0.8, 0.7, 1.35, 1.1)     # 지역 이동 부적 — 보라 양피지
print("완료")
