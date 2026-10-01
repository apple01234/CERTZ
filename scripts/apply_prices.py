#!/usr/bin/env python3
# 0 르쯔 제거 — BM 아이템 47종 + 시작 장비에 골드 기준가(price) 부여 (Phase 4)
# price는 "가치 표시/판매가 계산"용 — bmOnly라 골드 구매는 여전히 차단됨
import re, sys

PRICES = {
  # 물약 (티어 스케일)
  "potion_hp6": 8000, "potion_hp7": 12000, "potion_hp8": 18000, "potion_hp9": 26000, "potion_hp10": 38000,
  "potion_mp6": 6500, "potion_mp7": 10000, "potion_mp8": 15000, "potion_mp9": 22000, "potion_mp10": 32000,
  # 큐브/성장
  "eert_cube": 12000, "tier_cube": 22000, "exp_book": 5000, "buff_king": 15000,
  # 고가 장신구/펫/치장 (BM 단품)
  "ring_bless": 60000, "pet_atlas": 45000, "cos_aurora": 30000,
  "ring_fortune": 30000, "ring_dragon": 65000, "ring_titan": 50000, "ring_phantom": 75000, "ring_ancient": 140000,
  "pendant_moon": 40000, "pendant_sage": 55000, "pendant_star": 110000,
  # 상자 (가챠)
  "chest_iron": 8000, "chest_silver": 20000, "chest_gold": 42000, "chest_legend": 80000,
  # 펫 6종
  "pet_wisp": 45000, "pet_ember": 55000, "pet_frost": 65000, "pet_golem": 80000, "pet_unicorn": 100000, "pet_reaper": 140000,
  # 치장 오라 6종
  "cos_frost": 30000, "cos_flame": 30000, "cos_shadow": 38000, "cos_holy": 38000, "cos_storm": 45000, "cos_rainbow": 60000,
  # 패키지 6종
  "pack_starter": 14000, "pack_growth": 30000, "pack_premium": 60000, "pack_ultimate": 120000, "pack_daily": 9000, "pack_weekly": 46000,
  # 시작 장비 (무료 지급이지만 가치 표시)
  "weapon_1": 10, "armor_1": 8,
}

path = "src/game/data.ts"
src = open(path, encoding="utf8").read()
changed = 0
for key, price in PRICES.items():
    pat = re.compile(rf'(^\s*{key}:\s*\{{[^}}]*?)price:\s*0,', re.M)
    if pat.search(src):
        src = pat.sub(rf'\g<1>price: {price},', src, count=1); changed += 1
        continue
    # price 필드가 아예 없는 경우 — tier 앞에 삽입
    pat2 = re.compile(rf'(^\s*{key}:\s*\{{[^}}]*?)tier:\s*"', re.M)
    m = pat2.search(src)
    if m:
        src = pat2.sub(rf'\g<1>price: {price}, tier: "', src, count=1); changed += 1
    else:
        print(f"MISS {key}")
open(path, "w", encoding="utf8").write(src)
print(f"price 부여 {changed}종")
