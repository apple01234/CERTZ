#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc191 (지시 #8) — 대용량 RPG ICON PACK 을 장비 아이콘에 적용.

[배경]
사용자 지적: "내가 이전에 제공한 대용량 RPG ICON PACK 이 현재 프로젝트에서 안 보인다."
실측: 프로젝트 안에 팩이 없었다(public/assets 의 item_* 는 32×32 도트 334~412바이트).
      팩 원본은 /root/workspace/assets_in/uni/HeroEditor4D/FantasyHeroes/Icons/Equipment 에
      **1,129개 PNG / 82 카테고리**(MeleeWeapon1H 135, Armor 92, Vest 92, Bracers 92,
      Helmet 89, Leggings 88, MeleeWeapon2H 85, Bow 31, Shield 29, Supplies 290 …)로 존재한다.

[하는 일]
  · 게임 데이터의 장비 아이콘 키(item_weapon_1, i_sfw_forest, i_sfa_abyss …)를
    이름/등급/계열 의미에 따라 팩의 실제 아이콘에 매핑한다.
  · 192×192 원본을 64×64 로 다운스케일(투명 여백 자동 크롭 + 리샘플)해 webp 로 저장.
  · 매핑 결과를 public/assets/iconpack/_map.json 에 남겨 추적 가능하게 한다.

출력: public/assets/<iconKey>.webp  (64×64, RGBA, 여백 정규화)
사용: python3 tools/apply-icon-pack.py [--dry]
"""
import json
import os
import sys

from PIL import Image

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
PACK = "/root/workspace/assets_in/uni/HeroEditor4D/FantasyHeroes/Icons/Equipment"
OUT = os.path.join(ROOT, "public", "assets")
MAP_OUT = os.path.join(OUT, "iconpack", "_map.json")
SIZE = 64
DRY = "--dry" in sys.argv


def load_pack():
    """카테고리 → 파일 목록 (정렬 고정: 결과 재현성)"""
    pack = {}
    for cat in sorted(os.listdir(PACK)):
        d = os.path.join(PACK, cat)
        if not os.path.isdir(d):
            continue
        files = []
        for root, _dirs, fs in os.walk(d):
            for f in sorted(fs):
                if f.lower().endswith(".png"):
                    files.append(os.path.join(root, f))
        if files:
            pack[cat] = sorted(files)
    return pack


def pick(pack, cat, idx=0):
    """카테고리에서 idx 번째 아이콘 (없으면 None)"""
    arr = pack.get(cat) or []
    if not arr:
        return None
    return arr[idx % len(arr)]


def by_name(pack, cat, *words):
    """카테고리 안에서 파일명에 단어가 포함된 첫 아이콘"""
    arr = pack.get(cat) or []
    for w in words:
        wl = w.lower()
        for p in arr:
            if wl in os.path.basename(p).lower():
                return p
    return None


def normalize(src, dst, size=SIZE):
    """투명 여백 크롭 → 정사각 패딩 → 리샘플 → webp 저장"""
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((size, size), Image.LANCZOS)
    if not DRY:
        canvas.save(dst, "WEBP", quality=92, method=6)
    return canvas


def main():
    pack = load_pack()
    print(f"팩 카테고리 {len(pack)}종 / 파일 {sum(len(v) for v in pack.values())}개")

    # (아이콘 키, 카테고리, 인덱스 또는 이름힌트)
    #  계열/등급이 올라갈수록 팩 안에서 더 화려한 아이콘을 고른다.
    plan = []

    # ── 기본 무기 (전사 검 계열) ──
    plan += [
        ("item_weapon_1", "MeleeWeapon1H", 0),
        ("item_weapon_2", "MeleeWeapon1H", 12),
        ("item_weapon_3", "MeleeWeapon2H", 4),
        ("item_weapon_4", "MeleeWeapon2H", 20),
        ("item_weapon_5", "MeleeWeapon2H", 40),
        ("item_weapon_6", "MeleeWeapon2H", 60),
        ("item_mythic_weapon", "MeleeWeapon2H", 80),
        ("i_gm_sword", "MeleeWeapon2H", 5),
    ]
    # ── 기본 방어구 ──
    for i in range(1, 7):
        plan.append((f"item_armor_{i}", "Armor", (i - 1) * 14))
    plan.append(("i_gm_armor", "Armor", 30))

    # ── 챕터 세트 장비 (무기/방어구/장신구) ──
    chapters = ["forest", "kingdom", "alfheim", "muspelheim", "niflheim", "cave", "nidavellir", "hel", "abyss"]
    for ci, ch in enumerate(chapters):
        plan.append((f"i_sfw_{ch}", "MeleeWeapon2H", 8 + ci * 8))   # 세트 무기
        plan.append((f"i_sfa_{ch}", "Armor", 6 + ci * 9))            # 세트 방어구
        plan.append((f"i_sfr_{ch}", "Earrings", ci % 3))             # 세트 반지(장신구)

    # ── 계열 전용 무기 (도적/마법사/궁수/해적) ──
    plan += [
        ("dagger_icon", "MeleeWeapon1H", 3),
        ("bow_icon", "Bow", 2),
        ("staff_icon", "MeleeWeapon2H", 30),
        ("gun_icon", "Firearm2H", 0),
    ]

    written, skipped, mapping = 0, [], {}
    for key, cat, idx in plan:
        src = pick(pack, cat, idx)
        if not src:
            skipped.append((key, cat, "카테고리 없음"))
            continue
        dst = os.path.join(OUT, f"{key}.webp")
        normalize(src, dst)
        mapping[key] = os.path.relpath(src, PACK)
        written += 1

    if not DRY:
        os.makedirs(os.path.dirname(MAP_OUT), exist_ok=True)
        with open(MAP_OUT, "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False, indent=1)

    print(f"적용 {written}개 · 건너뜀 {len(skipped)}개")
    for s in skipped:
        print("  skip:", s)
    print("매핑표:", MAP_OUT)


if __name__ == "__main__":
    main()
