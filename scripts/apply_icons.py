#!/usr/bin/env python3
# data.ts 아이템 icon 필드 갱신 — 중복 해소용 신규 아이콘으로 교체 (Phase 3)
import re

KEYS = """potion_hp7 potion_hp8 potion_hp9 potion_hp10 potion_mp7 potion_mp8 potion_mp9 potion_mp10
potion_hp3 potion_hp4 potion_hp5 potion_hp6 potion_mp3 potion_mp4 potion_mp5 potion_mp6
bd_fenrir ring_swift ring_fortune ring_phantom sfr_alfheim sfr_cave sfr_abyss
bd_nidhog bd_surt ring_might sfr_kingdom sfr_muspelheim sfr_hel
bd_guardian bd_gram ring_titan sfr_niflheim sfr_nidavellir
bd_behemoth sfr_forest
bd_skoll bd_abysslord bd_abudditos pendant_moon pendant_sage pendant_star
pendant_ward pendant_blood
tier_cube chest_iron chest_silver chest_gold chest_legend
pack_starter pack_growth pack_premium pack_ultimate pack_daily pack_weekly
pet_wisp pet_ember pet_unicorn pet_frost pet_golem pet_reaper
buff_luck exp_book buff_crit
sfw_forest sfw_kingdom sfw_alfheim sfw_muspelheim sfw_niflheim sfw_cave sfw_nidavellir sfw_hel sfw_abyss
sfa_forest sfa_kingdom sfa_alfheim sfa_muspelheim sfa_niflheim sfa_cave sfa_nidavellir sfa_hel sfa_abyss
ring_dragon ring_ancient
cos_frost cos_storm cos_holy cos_flame cos_shadow cos_rainbow""".split()

path = "src/game/data.ts"
src = open(path, encoding="utf8").read()
changed = 0
for key in KEYS:
    # 아이템 정의 줄: `  <key>: { key: "<key>", ... icon: "<old>" ... }`
    pat = re.compile(rf'(^\s*{key}:\s*\{{[^}}]*?icon:\s*")([^"]+)(")', re.M)
    m = pat.search(src)
    if not m:
        print(f"MISS {key}"); continue
    if m.group(2) == f"i_{key}":
        continue
    src = pat.sub(rf'\g<1>i_{key}\g<3>', src, count=1)
    changed += 1
# 치장(COSMETIC_DEFS) 별도 처리: cos_* 는 icon이 기존 cos_* 파일명 — 위 키 리스트와 동일 매핑
open(path, "w", encoding="utf8").write(src)
print(f"icon 갱신 {changed}종")
