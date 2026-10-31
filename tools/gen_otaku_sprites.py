"""SERTZ 오리지널 도트 초상화 생성기 v2 — 직업별 실루엣 차별화.

v1 문제(자체 검토 + 스크린샷 평가)
  · 4장 모두 불투명 픽셀이 13,632 로 **정확히 동일** → 색만 바꾼 팔레트 스왑
  · 앞머리가 눈을 덮어 표정을 못 읽음
  · 팔-몸통이 같은 색이라 붙어 보임, 손/발 경계 없음

v2 원칙
  1. **실루엣이 먼저 다르다** — 직업마다 모자/후드/망토/활/지팡이 등 실루엣 요소를
     넣어 불투명 픽셀 수가 서로 달라지게 한다(검증 지표로 쓴다).
  2. **눈을 항상 노출** — 앞머리는 눈 위에서 끊는다.
  3. **경계 분리** — 팔은 몸통보다 1단 밝게, 손/발은 외곽선으로 분리.
  4. 외부 이미지 입력 0장. 색은 SERTZ 자체 스프라이트 실측 팔레트.

출력: public/assets/gen/<job>_<skin>_portrait.png (192×256)
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("public/assets/gen")
W, H, SCALE = 48, 64, 4

SKIN = {
    0: {"base": "#f8e0c6", "shade": "#d9b394", "hi": "#fff0de"},
    1: {"base": "#e8c59f", "shade": "#bb7c47", "hi": "#fcd6ad"},
    2: {"base": "#c1ac8f", "shade": "#8e5e36", "hi": "#e8d3b8"},
}
HAIR = {
    "brown":  {"base": "#573a23", "shade": "#402717", "hi": "#8e5e36"},
    "black":  {"base": "#2a2b33", "shade": "#171820", "hi": "#4a4c58"},
    "blonde": {"base": "#d8ac54", "shade": "#a67b2e", "hi": "#f2d488"},
    "silver": {"base": "#b9c2d4", "shade": "#7f8aa0", "hi": "#e4ebf6"},
    "red":    {"base": "#a83a3a", "shade": "#732222", "hi": "#d4615c"},
}
# 키는 SERTZ classes.ts 의 FamilyKey 와 일치시킨다
#   "warrior" | "ranger" | "mage" | "thief" | "pirate"
CLOTH = {
    "warrior": {"base": "#2c65b5", "shade": "#1b3f75", "hi": "#5aa0f0"},
    "ranger":  {"base": "#2f7a4f", "shade": "#1c4e31", "hi": "#5fc48a"},
    "mage":    {"base": "#6a3fa0", "shade": "#452669", "hi": "#a97fe0"},
    "thief":   {"base": "#4a4458", "shade": "#2e2a38", "hi": "#8078a0"},
    "pirate":  {"base": "#a8562c", "shade": "#6f3418", "hi": "#d98a52"},
}
OUTLINE = "#0c0e19"


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def draw(job: str, skin_idx: int, hair_key: str) -> Image.Image:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(hash((job, skin_idx, hair_key)) & 0xFFFF)

    sk, hr, cl = SKIN[skin_idx], HAIR[hair_key], CLOTH[job]
    sb, ss, sh = rgb(sk["base"]), rgb(sk["shade"]), rgb(sk["hi"])
    hb, hs, hh = rgb(hr["base"]), rgb(hr["shade"]), rgb(hr["hi"])
    cb, cs, ch = rgb(cl["base"]), rgb(cl["shade"]), rgb(cl["hi"])
    out = rgb(OUTLINE)
    cx = W // 2

    # ── 직업별 뒷배경 실루엣 (가장 큰 차별화 요소) ──────────────────
    if job == "pirate":
        # 후광
        d.ellipse([cx - 11, 3, cx + 10, 13], outline=ch, width=1)
    if job == "mage":
        # 마법진 (발밑)
        d.ellipse([cx - 12, 52, cx + 11, 61], outline=ch, width=1)
    if job == "warrior":
        # 등 뒤 검
        d.line([cx + 9, 20, cx + 12, 44], fill=ch, width=2)
    if job == "ranger":
        # 등 뒤 활
        d.arc([cx + 8, 24, cx + 17, 48], 300, 60, fill=ch, width=1)

    # ── 다리 ──
    leg_top = 46
    for side in (-1, 1):
        x0 = cx + side * 4 - 2
        d.rectangle([x0, leg_top, x0 + 3, 58], fill=cs, outline=out)
    # 부츠 — 클래스별 형태
    for side in (-1, 1):
        x0 = cx + side * 4 - 2
        if job == "thief":
            d.rectangle([x0, 52, x0 + 3, 59], fill=out)      # 긴 부츠
            d.line([x0, 53, x0 + 3, 53], fill=ch)
        else:
            d.rectangle([x0, 56, x0 + 3, 59], fill=out)
            d.rectangle([x0, 56, x0 + 3, 56], fill=cb)

    # ── 망토/스커트 (직업별) ──
    if job in ("mage", "priest"):
        d.polygon([(cx - 9, 30), (cx + 8, 30), (cx + 11, 52), (cx - 12, 52)], fill=cs, outline=out)
    if job == "thief":
        d.polygon([(cx - 8, 40), (cx + 7, 40), (cx + 9, 50), (cx - 10, 50)], fill=cs, outline=out)

    # ── 몸통 ──
    body_top, body_bot = 30, 47
    d.rectangle([cx - 7, body_top, cx + 6, body_bot], fill=cb, outline=out)
    d.rectangle([cx - 6, body_top + 1, cx - 3, body_bot - 1], fill=cs)   # 음영
    d.line([cx - 5, body_top + 4, cx + 4, body_top + 4], fill=ch)        # 장식선

    # ── 팔 (몸통보다 밝게 → 경계 분리) ──
    d.rectangle([cx - 10, body_top + 1, cx - 7, body_top + 13], fill=ch, outline=out)
    d.rectangle([cx + 7, body_top + 1, cx + 10, body_top + 13], fill=ch, outline=out)
    # 손 — 외곽선으로 분리
    d.rectangle([cx - 10, body_top + 14, cx - 7, body_top + 17], fill=sb, outline=out)
    d.rectangle([cx + 7, body_top + 14, cx + 10, body_top + 17], fill=sb, outline=out)

    # ── 어깨 견갑 (warrior만 크게) ──
    if job == "warrior":
        d.rectangle([cx - 11, body_top - 1, cx - 6, body_top + 3], fill=ch, outline=out)
        d.rectangle([cx + 6, body_top - 1, cx + 11, body_top + 3], fill=ch, outline=out)
    else:
        d.rectangle([cx - 9, body_top, cx - 7, body_top + 2], fill=ch, outline=out)
        d.rectangle([cx + 7, body_top, cx + 9, body_top + 2], fill=ch, outline=out)

    # ── 목 ──
    d.rectangle([cx - 2, 27, cx + 2, 30], fill=ss)

    # ── 머리 ──
    hx0, hy0, hx1, hy1 = cx - 8, 8, cx + 7, 28
    d.ellipse([hx0, hy0, hx1, hy1], fill=sb, outline=out)
    d.arc([hx0 + 1, hy0 + 3, hx1 - 1, hy1], 100, 250, fill=ss)

    # ── 눈 — 항상 노출 (앞머리보다 먼저 그려 위에 덮이지 않게 좌표 고정) ──
    eye_y = 18
    for side in (-1, 1):
        ex = cx + side * 4
        d.rectangle([ex - 1, eye_y, ex, eye_y + 2], fill=out)
        d.point((ex, eye_y), fill=(255, 255, 255, 255))
    d.line([cx - 1, 23, cx, 23], fill=ss)   # 입

    # ── 헤어: 직업별로 높이/볼륨을 다르게 ──
    cap_top = hy0 - (3 if job == "warrior" else 2)
    d.pieslice([hx0 - 1, cap_top, hx1 + 1, hy0 + 14], 180, 360, fill=hb, outline=out)
    d.arc([hx0 + 1, cap_top + 1, hx1 - 1, hy0 + 10], 200, 300, fill=hh)
    # 앞머리 — 눈(eye_y=18) **위에서 끊는다**
    for i in range(3):
        fx = cx - 6 + i * 4
        d.line([fx, hy0 + 4, fx + rng.randint(-1, 1), 15], fill=hs)
    # 옆머리 — 직업별 길이
    side_len = {"warrior": 20, "mage": 26, "ranger": 18, "pirate": 24, "thief": 15}[job]
    d.rectangle([hx0 - 1, hy0 + 6, hx0 + 1, side_len], fill=hs, outline=out)
    d.rectangle([hx1 - 1, hy0 + 6, hx1 + 1, side_len], fill=hb, outline=out)

    # ── 직업별 머리 장식 (실루엣 상단 차별화) ──
    if job == "warrior":
        d.polygon([(cx - 6, cap_top + 2), (cx + 5, cap_top + 2), (cx, cap_top - 5)], fill=ch, outline=out)
    if job == "mage":
        d.polygon([(cx - 8, cap_top + 1), (cx + 7, cap_top + 1), (cx, cap_top - 8)], fill=cb, outline=out)
    if job == "ranger":
        d.rectangle([cx - 8, cap_top + 1, cx + 7, cap_top + 3], fill=cs, outline=out)
    if job == "pirate":
        im_pts = [(cx, cap_top - 4), (cx - 2, cap_top + 2), (cx + 2, cap_top + 2)]
        d.polygon(im_pts, fill=hh, outline=out)
    if job == "thief":
        d.rectangle([cx - 9, cap_top + 2, cx + 8, cap_top + 5], fill=cs, outline=out)  # 후드

    return im


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    hairs = list(HAIR)
    n = 0
    for ji, job in enumerate(CLOTH):
        for si in (0, 1, 2):
            hair = hairs[(ji * 2 + si) % len(hairs)]
            im = draw(job, si, hair)
            big = im.resize((W * SCALE, H * SCALE), Image.NEAREST)
            p = OUT / f"{job}_{si}_portrait.png"
            big.save(p)
            a = im.getchannel("A")
            opaque = sum(1 for v in a.get_flattened_data() if v > 0)
            print(f"  {job:8s} skin{si} {hair:7s}  불투명 {opaque:>5}px")
            n += 1
    print(f"\n생성 {n}장 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
