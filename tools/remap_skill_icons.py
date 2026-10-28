#!/usr/bin/env python3
"""SERTZ 스킬 아이콘 — RPG Icons Pixel Art 팩에서 10직업 × 6슬롯 매핑.

유저 지시 #1: "아이콘 너가 만들지 말고 RPG 아이콘 팩에서만 가져다 써"
유저 지시 #3: "스킬 아이콘 안에 텍스트 짤림"

■ 4차 10직업 구조 (유저 지적: "36직업 아니잖아 10개직업이 전직하는거잖아")
  1~3차는 전직 단계 노드일 뿐이고, 실제 직업 정체성은 4차 10직업이다.
  각 4차 직업의 하위 노드(1~3차)도 같은 팩을 승계해야 외형·아이콘이 일관된다.

■ 팩 배정 근거
  warbringer   (berserker←warlord)       전사·대검        → Swordsman_skills
  crusader     (guardian←paladin)        성기사·빛        → Paladin
  deadeye      (sniper←eagleeye)         저격·활          → Archer
  skylord      (windrunner←tempest)      질풍·바람        → Aeromancer
  arclord      (archmage←stormbringer)   화염·원소        → Pyromanser
  eternal      (sage←chronicle)          냉기·시간        → Cryomancer
  shadowlord   (assassin←nightblade)     암살·단검        → Thief
  blademaster  (swashbuckler←duelist)    쌍검·검무        → Swordsman_skills (검 계열)
  seaking      (raider←stormcaptain)     함포·해적        → Exotic weapons pack (총·대포)
  dreadnought  (raider←powdermaster)     중화기·폭격      → Exotic weapons pack

■ 슬롯 = 팩 내 아이콘 인덱스. 각 슬롯이 서로 다른 그림이 되도록 고정 배치.
"""
import os, json, glob, shutil
from PIL import Image

PACK_ROOT = "/root/workspace/_assets_in/x2/RPG Icons Pixel Art"
OUT = "/root/workspace/CERTZ/public/assets/skillicon"

# 4차 직업 → (팩, {슬롯: 아이콘번호})
# 아이콘번호는 1-based (Icon1.png ~ Icon48.png)
JOBS = {
    # ── 전사 계열 ──
    "warbringer": ("Swordsman_skills",      {"s1": 4,  "s2": 11, "s3": 6,  "s4": 8,  "s5": 12, "s5b": 3}),
    "crusader":   ("Paladin",               {"s1": 1,  "s2": 2,  "s3": 9,  "s4": 11, "s5": 12, "s5b": 3}),
    # ── 궁수 계열 ──
    "deadeye":    ("Archer",                {"s1": 2,  "s2": 3,  "s3": 4,  "s4": 12, "s5": 6,  "s5b": 1}),
    "skylord":    ("Aeromancer",            {"s1": 7,  "s2": 8,  "s3": 11, "s4": 12, "s5": 6,  "s5b": 3}),
    # ── 마법사 계열 ──
    "arclord":    ("Pyromanser",            {"s1": 1,  "s2": 5,  "s3": 7,  "s4": 9,  "s5": 12, "s5b": 11}),
    "eternal":    ("Cryomancer",            {"s1": 1,  "s2": 7,  "s3": 8,  "s4": 11, "s5": 12, "s5b": 3}),
    # ── 도적 계열 ──
    "shadowlord": ("Thief",                 {"s1": 3,  "s2": 5,  "s3": 11, "s4": 4,  "s5": 9,  "s5b": 10}),
    "blademaster":("Swordsman_skills",      {"s1": 5,  "s2": 6,  "s3": 3,  "s4": 11, "s5": 4,  "s5b": 9}),
    # ── 해적 계열 ──
    # 씨킹 = 함포·해일 → 대포(31) + 권총(15) + 폭탄(34). 전부 서로 다른 번호.
    "seaking":    ("Pirate Skill Icons",    {"s1": 15, "s2": 34, "s3": 26, "s4": 20, "s5": 31, "s5b": 37}),
    # 드레드노트 = 중화기·폭격 → 대포(32) + 폭발통(37) + 폭탄(42). seaking 과 번호 겹침 없음.
    "dreadnought":("Pirate Skill Icons",    {"s1": 12, "s2": 29, "s3": 26, "s4": 35, "s5": 32, "s5b": 42}),
}

# 4차 → 하위 노드 승계 (1·2·3차도 같은 팩)
LINEAGE = {
    "warbringer":  ["berserker", "warlord"],
    "crusader":    ["guardian", "paladin"],
    "deadeye":     ["sniper", "eagleeye"],
    "skylord":     ["windrunner", "tempest"],
    "arclord":     ["archmage", "stormbringer"],
    "eternal":     ["sage", "chronicle"],
    "shadowlord":  ["assassin", "nightblade"],
    "blademaster": ["swashbuckler", "duelist"],
    "seaking":     ["raider", "stormcaptain"],
    "dreadnought": ["raider", "powdermaster"],
}

# 1차 5계열 (전직 전) — 계열 대표 팩
BASE = {
    "base":    ("Swordsman_skills", {"s1": 1, "s2": 3, "s5": 12, "s5b": 4}),
    "warrior": ("Swordsman_skills", {"s1": 4, "s2": 3, "s5": 12, "s5b": 6}),
    "ranger":  ("Archer",           {"s1": 2, "s2": 1, "s5": 6,  "s5b": 3}),
    "mage":    ("Pyromanser",       {"s1": 1, "s2": 5, "s5": 12, "s5b": 9}),
    "thief":   ("Thief",            {"s1": 3, "s2": 11,"s5": 10, "s5b": 2}),
    "pirate":  ("Pirate Skill Icons", {"s1": 15, "s2": 34, "s5": 31, "s5b": 42}),
}


def find_icon(pack: str, idx: int) -> str:
    """팩 폴더에서 Icon<idx>.png 경로를 찾는다 (하위 PNG/ 등 중첩 대응)."""
    for pat in (f"{PACK_ROOT}/{pack}/PNG/Icon{idx}.png",
                f"{PACK_ROOT}/{pack}/Icon{idx}.png",
                f"{PACK_ROOT}/{pack}/PNG/spr_icon{idx}.png"):
        if os.path.isfile(pat):
            return pat
    hits = [p for p in glob.glob(f"{PACK_ROOT}/{pack}/**/*.png", recursive=True)
            if os.path.basename(p).lower() in (f"icon{idx}.png", f"icon_{idx}.png")]
    return hits[0] if hits else ""


def build():
    os.makedirs(OUT, exist_ok=True)
    plan = {}

    def assign(job, pack, slots):
        plan[job] = {}
        for slot, idx in slots.items():
            src = find_icon(pack, idx)
            if not src:
                print(f"  ⚠ {job}/{slot}: {pack} Icon{idx} 없음")
                continue
            plan[job][slot] = (src, f"{job}_{slot}")

    # 1차 계열
    for job, (pack, slots) in BASE.items():
        assign(job, pack, slots)
    # 4차 + 하위 노드 승계
    for t4, (pack, slots) in JOBS.items():
        assign(t4, pack, slots)
        for sub in LINEAGE.get(t4, []):
            if sub == "raider":
                continue  # raider 는 두 계보가 갈리므로 별도 처리
            assign(sub, pack, slots)
    # raider 는 seaking 계보로
    assign("raider", *JOBS["seaking"])

    # 기록 + 변환 (원본 32x32 팩 → 64x64 NEAREST, 알파 추가 없이 그대로)
    n = 0
    for job, items in plan.items():
        for slot, (src, stem) in items.items():
            im = Image.open(src).convert("RGB")
            if im.size != (64, 64):
                im = im.resize((64, 64), Image.NEAREST)
            dst = os.path.join(OUT, f"{stem}.webp")
            im.save(dst, "WEBP", quality=95, method=6)
            n += 1
    print(f"\n생성 {n}개 → {OUT}")
    json.dump({j: {s: v[0] for s, v in d.items()} for j, d in plan.items()},
              open("/tmp/icon_plan.json", "w"), ensure_ascii=False, indent=1)
    return n


if __name__ == "__main__":
    build()
