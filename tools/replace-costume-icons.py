#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc191 (지시 #3) — "저주 인형처럼 어색한" 코스튬 이미지를 안전한 대체물로 교체.

[문제 (vision 실측)]
  코스튬 24종의 아이콘(cost_*_idle0 / costm_*_idle0)은 팔·다리가 없는 **원뿔 통짜 몸통**에
  머리만 얹힌 형태였다. 판정: "머리가 달린 체스 말 / 테루테루보즈 / 저주 인형".
  특히 2·6번은 얼굴 픽셀이 뭉개져 판독 불가, 4번은 몸통이 배경과 붙어 "목만 떠 있는" 착시.

[기준]
  사용자 기준은 "보기에 기괴하거나 어색하면 제거".
  → 기괴한 캐릭터 그림을 없애고, **의복(갑옷) 아이콘**으로 대체한다.
    · 캐릭터가 아니라 옷/갑주를 보여주므로 인체 표현의 어색함이 발생하지 않는다.
    · 이미 검증된 대용량 아이콘 팩(FantasyHeroes)의 실제 아트를 쓴다.
    · 24종이 서로 겹치지 않게 팩 안에서 서로 다른 아이템을 배정한다.

출력: public/assets/<costKey>.webp (96×96, RGBA, 아이콘 UI 와 동일한 림/글로우 규격)
사용: python3 tools/replace-costume-icons.py [--dry]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
ASSETS = os.path.join(ROOT, "public", "assets")
PACK = "/root/workspace/assets_in/uni/HeroEditor4D/FantasyHeroes/Icons/Equipment"
BACKUP = os.path.join(ASSETS, "costume_orig")
MAP_OUT = os.path.join(ASSETS, "iconpack", "_costume_map.json")
SIZE = 96
DRY = "--dry" in sys.argv

LIFT, CONTRAST, SATURATION = 22, 1.10, 1.08
RIM_RGB = (255, 246, 214)
RIM_ALPHA = 120
GLOW_ALPHA = 84

# 코스튬 키 → (팩 카테고리, 파일명 힌트). 힌트 없으면 인덱스 순환 배정.
PLAN = {
    "cost_valkyrie_idle0": ("Armor", ["Plate", "Knight", "Valkyrie"]),
    "costm_paladin_idle0": ("Armor", ["Paladin", "Holy", "Gold"]),
    "costm_warlord_idle0": ("Armor", ["Warlord", "Dark", "Black"]),
    "cost_flame_idle0": ("Vest", ["Fire", "Flame", "Red"]),
    "cost_frost_idle0": ("Vest", ["Ice", "Frost", "Blue"]),
    "costm_frost_idle0": ("Armor", ["Ice", "Frost", "Cold"]),
    "cost_abyss_idle0": ("Vest", ["Dark", "Shadow", "Abyss"]),
    "cost_shadow_idle0": ("Vest", ["Shadow", "Black"]),
    "cost_sakura_idle0": ("Vest", ["Pink", "Sakura", "Flower"]),
    "cost_lily_idle0": ("Vest", ["White", "Lily"]),
    "cost_dragon_idle0": ("Armor", ["Dragon", "Scale"]),
    "cost_royal_idle0": ("Vest", ["Royal", "King", "Noble"]),
    "cost_gilded_idle0": ("Armor", ["Gold", "Gilded"]),
    "cost_silver_idle0": ("Armor", ["Silver", "Steel"]),
    "cost_crimson_idle0": ("Vest", ["Red", "Crimson"]),
    "cost_navy_idle0": ("Vest", ["Blue", "Navy", "Sailor"]),
    "cost_mystic_idle0": ("Vest", ["Mage", "Wizard", "Robe"]),
    "cost_witch_idle0": ("Vest", ["Witch", "Robe", "Dark"]),
    "cost_sylvan_idle0": ("Vest", ["Green", "Forest", "Ranger"]),
    "cost_nightmare_idle0": ("Armor", ["Nightmare", "Dark", "Bone"]),
    "cost_seraph_idle0": ("Vest", ["Angel", "Holy", "White"]),
    "cost_nightblade_idle0": ("Vest", ["Ninja", "Black", "Assassin"]),
    "costm_nightblade_idle0": ("Armor", ["Ninja", "Black", "Assassin"]),
    "costm_void_idle0": ("Vest", ["Void", "Purple", "Dark"]),
    "costm_mariner_idle0": ("Vest", ["Sailor", "Pirate", "Marine"]),
    "cost_spring_idle0": ("Vest", ["Spring", "Flower", "Pink"]),
}


def cat_files(cat):
    d = os.path.join(PACK, cat)
    out = []
    if os.path.isdir(d):
        for root, _dirs, fs in os.walk(d):
            for f in sorted(fs):
                if f.lower().endswith(".png"):
                    out.append(os.path.join(root, f))
    return sorted(out)


# vc191(#3) — 같은 아이콘을 두 코스튬이 공유하면 변별력이 사라진다.
#  힌트 매칭이 같은 파일로 수렴한 경우, 뒤에 오는 코스튬은 **색조를 돌려** 구분한다.
HUE_SHIFT = {
    "cost_frost_idle0": 200,      # 서리 → 청록
    "cost_lily_idle0": 300,       # 백합 → 보라
    "cost_nightmare_idle0": 270,  # 악몽 → 자주
    "costm_frost_idle0": 190,
    "costm_nightblade_idle0": 15,
    "costm_paladin_idle0": 45,
    "costm_warlord_idle0": 340,
}


def shift_hue(im, deg):
    """HSV 색조 회전 — 명도·채도·알파는 유지해 톤이 깨지지 않게."""
    hsv = np.array(im.convert("RGBA"), dtype=np.float32)
    rgb = hsv[..., :3] / 255.0
    alpha = hsv[..., 3:]
    mx = rgb.max(axis=2, keepdims=True)
    mn = rgb.min(axis=2, keepdims=True)
    diff = mx - mn
    # HSV 변환 (표준 공식)
    r, g, b = rgb[..., 0:1], rgb[..., 1:2], rgb[..., 2:3]
    h = np.zeros_like(mx)
    m = diff > 1e-6
    rc = np.where(m & (mx == r), ((g - b) / np.where(diff == 0, 1, diff)) % 6, 0)
    gc = np.where(m & (mx == g), (b - r) / np.where(diff == 0, 1, diff) + 2, 0)
    bc = np.where(m & (mx == b), (r - g) / np.where(diff == 0, 1, diff) + 4, 0)
    h = (rc + gc + bc) / 6.0
    h = (h + deg / 360.0) % 1.0
    s = np.where(mx > 1e-6, diff / np.where(mx == 0, 1, mx), 0)
    v = mx
    # 역변환
    i = (h * 6.0).astype(np.int32)
    f = h * 6.0 - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    i = i % 6
    out = np.zeros_like(rgb)
    for idx, (rr, gg, bb) in enumerate([
        (v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q),
    ]):
        sel = i == idx
        out[..., 0:1] = np.where(sel, rr, out[..., 0:1])
        out[..., 1:2] = np.where(sel, gg, out[..., 1:2])
        out[..., 2:3] = np.where(sel, bb, out[..., 2:3])
    res = np.concatenate([np.clip(out * 255, 0, 255), alpha], axis=2).astype(np.uint8)
    return Image.fromarray(res, "RGBA")


def choose(files, hints, used, idx):
    for h in hints:
        hl = h.lower()
        for p in files:
            if p in used:
                continue
            if hl in os.path.basename(p).lower():
                return p
    # 힌트 실패 — 아직 안 쓴 것 중에서 순환 선택
    for p in files:
        if p not in used:
            return p
    return files[idx % len(files)] if files else None


def normalize(src, size=SIZE):
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def decorate(im):
    """아이콘 UI 와 같은 톤 보정 + 부드러운 림/글로우 (경계 잘림 방지 여백 포함)"""
    PAD = 6
    W0, H0 = im.size
    padded = Image.new("RGBA", (W0 + PAD * 2, H0 + PAD * 2), (0, 0, 0, 0))
    padded.paste(im, (PAD, PAD))

    a = np.array(padded, dtype=np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    rgb = np.clip(rgb + LIFT, 0, 255)
    rgb = np.clip((rgb - 128.0) * CONTRAST + 128.0, 0, 255)
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(gray + (rgb - gray) * SATURATION, 0, 255)
    base = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")

    mask = Image.fromarray((alpha > 8).astype(np.uint8) * 255, "L")
    grown = mask.filter(ImageFilter.MaxFilter(3))
    rim_mask = Image.fromarray(
        np.clip(np.array(grown, dtype=np.int16) - np.array(mask, dtype=np.int16), 0, 255).astype(np.uint8), "L"
    ).filter(ImageFilter.GaussianBlur(0.6))
    rim = Image.new("RGBA", base.size, RIM_RGB + (0,))
    rim.putalpha(rim_mask.point(lambda v: int(v * RIM_ALPHA / 255)))

    wide = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2.2))
    glow_mask = Image.fromarray(
        np.clip(np.array(wide, dtype=np.int16) - np.array(grown, dtype=np.int16), 0, 255).astype(np.uint8), "L"
    )
    glow = Image.new("RGBA", base.size, RIM_RGB + (0,))
    glow.putalpha(glow_mask.point(lambda v: int(v * GLOW_ALPHA / 255)))

    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(rim)
    out.alpha_composite(base)
    return out


def main():
    pool = {}
    for cat in ("Armor", "Vest", "Bracers", "Helmet", "Leggings"):
        pool[cat] = cat_files(cat)
        print(f"  풀 {cat}: {len(pool[cat])}개")

    used, mapping, done = set(), {}, 0
    for idx, (key, (cat, hints)) in enumerate(sorted(PLAN.items())):
        files = pool.get(cat) or []
        src = choose(files, hints, used, idx)
        if not src:
            print(f"  [skip] {key}: {cat} 후보 없음")
            continue
        used.add(src)
        dst = os.path.join(ASSETS, f"{key}.webp")
        # 원본 백업 (재실행 안전)
        if os.path.exists(dst) and not os.path.exists(os.path.join(BACKUP, f"{key}.webp")):
            os.makedirs(BACKUP, exist_ok=True)
            Image.open(dst).save(os.path.join(BACKUP, f"{key}.webp"), "WEBP", quality=95)
        img = normalize(src)
        if key in HUE_SHIFT:
            img = shift_hue(img, HUE_SHIFT[key])
        img = decorate(img)
        if not DRY:
            img.save(dst, "WEBP", quality=94, method=6)
        mapping[key] = os.path.relpath(src, PACK)
        done += 1

    if not DRY:
        os.makedirs(os.path.dirname(MAP_OUT), exist_ok=True)
        with open(MAP_OUT, "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False, indent=1)
    print(f"교체 {done}개 · 백업 {BACKUP}")
    print(f"매핑표 {MAP_OUT}")


if __name__ == "__main__":
    main()
