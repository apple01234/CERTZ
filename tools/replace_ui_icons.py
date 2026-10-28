#!/usr/bin/env python3
"""UI 아이콘 17종을 배급된 RPG Icons Pixel Art 팩으로 교체한다.

배경
----
기존 아이콘(Classic_RPG_GUI)은 한 세트 안에서도 스타일이 갈렸다 —
하트는 픽셀아트 + 흰 외곽선, 가방·해골은 부드러운 페인팅. 그래서 HUD 만
따로 노는 느낌이 있었다.

배급 팩(RPG Icons Pixel Art)은 32x32 픽셀아트 8,266장으로 스타일이 균일하고
외곽선 규칙도 같다. 64x64 로 2배 정수 확대해 기존 슬롯 크기를 유지한다.

매핑
----
  bag        → Chests_keys_treasure  (가방/보물)
  equip      → Helmets               (장비)
  fight      → Swords                (전투)
  honor      → Sigils                (문장)
  inventory  → Chests_keys_treasure
  menu       → Scrolls
  options    → Runes
  profession → Staffs
  quest      → Scrolls
  skull      → Undead Skills Icons
  boss       → Undead Skills Icons
  close      → Sigils
  greed      → Gems1
  need       → Potions
  runes      → Runes
  skills     → Books
  trade      → Gems1

사용
----
  python3 tools/replace_ui_icons.py --dry-run
  python3 tools/replace_ui_icons.py --apply
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets", "ui")
PACK = "/root/workspace/_assets_in/x2/RPG Icons Pixel Art"

# 아이콘 이름 → (팩 하위폴더, 후보 인덱스)
#  주의: 인덱스는 '의미'로 골랐다. 예전처럼 0번만 쓰면 bag/inventory 가 둘 다
#  상자, menu/quest 가 둘 다 두루마리가 되어 라벨과 그림이 어긋난다.
MAP = {
    "ui_bag":        ("Chests_keys_treasure", 0),   # 갈색 보물상자
    "ui_inventory":  ("Chests_keys_treasure", 6),   # 열린 상자
    "ui_equip":      ("Helmets", 0),                # 투구
    "ui_fight":      ("Swords", 0),                 # 검
    "ui_honor":      ("Sigils", 0),                 # 방패 문장
    "ui_menu":       ("Books", 0),                  # 닫힌 책 = 메뉴/저널
    "ui_options":    ("Minerals", 1),               # 광물(알파 자연)
    "ui_profession": ("Craft_materials2", 23),      # 제작 재료(알파 자연)
    "ui_quest":      ("Scrolls", 1),                # 두루마리
    "ui_skull":      ("Bones_sculls", 20),          # 해골(알파 자연)
    "ui_boss":       ("Demons Loot Icons", 5),      # 악마 전리품(알파 자연)
    "ui_close":      ("Runes", 25),                 # 룬(알파 자연)
    "ui_greed":      ("Gems1", 0),                  # 보석
    "ui_need":       ("Potions", 0),                # 물약
    "ui_runes":      ("Runes", 8),                  # 룬석
    "ui_skills":     ("Books", 0),                  # 스킬북
    "ui_trade":      ("Gems2", 37),                 # 보석(알파 자연)
}


def candidates(folder: str):
    """팩 폴더에서 투명 배경 PNG 목록 (정렬 고정).

    팩마다 PNG 가 `PNG/Transperent/`, `PNG/`, 또는 `PNG/Transperent/<소재>/`
    처럼 깊이가 달라서 재귀로 찾는다. Background 변형은 제외한다.
    """
    d = os.path.join(PACK, folder)
    fs = []
    for root, _dirs, files in os.walk(d):
        low = root.lower()
        if "background" in low:          # 배경 포함 변형은 쓰지 않는다
            continue
        for f in files:
            if f.endswith(".png"):
                fs.append(os.path.join(root, f))
    return sorted(fs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--size", type=int, default=64)
    args = ap.parse_args()

    if not os.path.isdir(PACK):
        raise SystemExit(f"팩 없음: {PACK}")

    print(f"{'아이콘':16s} {'소스':24s} {'원본':>6s} {'비율':>5s}")
    print("-" * 58)
    done = 0
    for name, (folder, idx) in MAP.items():
        fs = candidates(folder)
        if not fs:
            print(f"{name:16s} {folder:24s}  ✕ 없음")
            continue
        src = fs[idx % len(fs)]
        im = Image.open(src).convert("RGBA")
        a = np.array(im.getchannel("A"))
        ratio = float((a > 16).mean())
        im2 = im.resize((args.size, args.size), Image.NEAREST)
        print(f"{name:16s} {os.path.basename(src):24s} {im.width:4d}px {ratio:5.2f}")
        if args.apply:
            im2.save(os.path.join(ASSETS, name + ".webp"), "WEBP", quality=95, method=4)
            done += 1
    print("-" * 58)
    print(f"{'교체' if args.apply else '(--apply 로 기록)'} {done if args.apply else len(MAP)}종")


if __name__ == "__main__":
    sys.exit(main())
