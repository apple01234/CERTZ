#!/usr/bin/env python3
"""3·4차 직업 전용 외형 시트 생성 (jobm_/jobf_).

배경
----
2차 8직업 시트(jobm_*/jobf_*, 28프레임)는 **모두 같은 실루엣에 색조만 다른** 것을
실측으로 확인했다(알파 마스크 8직업 완전 동일, RGB만 차이). 그런데 3·4차 20직업은
전용 시트가 없어 `tier2RootOf()` 가 2차 외형을 그대로 승계 → "전직해도 모습이 안 바뀐다".

해법
----
2차 시트와 **완전히 같은 방식**(같은 실루엣 + 색조 회전)으로 3·4차 시트를 만든다.
그래야 화풍이 100% 일치하고, 448장과 같은 규격(96x64, 28프레임)을 유지한다.

색조는 각 직업의 `hex`(classes.ts)에서 뽑아 쓴다 — 3차는 2차 색을 밝게,
4차는 더 밝고 채도 높게(계보가 올라갈수록 강해 보이도록).

사용
----
  python3 tools/gen_tier34_bodies.py --dry-run
  python3 tools/gen_tier34_bodies.py --apply
"""
import argparse
import colorsys
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")

# 3·4차 20직업: (직업키, base 2차 직업, hex)
TIER34 = [
    # 3차
    ("warlord",       "berserker",   0xff5c3c),
    ("paladin",       "guardian",    0xffd29a),
    ("eagleeye",      "sniper",      0x3cff7a),
    ("tempest",       "windrunner",  0xb9ffe0),
    ("stormbringer",  "archmage",    0x6f8cff),
    ("chronicle",     "sage",        0xe2e8ff),
    ("nightblade",    "assassin",    0xc08aff),
    ("duelist",       "swashbuckler", 0xffd8ff),
    ("stormcaptain",  "corsair",     0x8fe8ff),
    ("powdermaster",  "raider",      0xff9a5c),
    # 4차
    ("warbringer",    "berserker",   0xff3c1c),
    ("crusader",      "guardian",    0xffe29a),
    ("deadeye",       "sniper",      0x1cff5c),
    ("skylord",       "windrunner",  0xccffe8),
    ("arclord",       "archmage",    0x5c7cff),
    ("eternal",       "sage",        0xffffff),
    ("shadowlord",    "assassin",    0xa86aff),
    ("blademaster",   "swashbuckler", 0xffaaff),
    ("seaking",       "corsair",     0x5fd4ff),
    ("dreadnought",   "raider",      0xff6a3d),
]

# v1.4.38 (#4 "해적류 직업 전직시 외형 안바뀜") —
#  원본 배급 팩에 해적 2차 시트(corsair/raider/pirate)가 **아예 없었다**(실측 0장).
#  그래서 해적 계열은 2차 전직에서도 외형이 안 바뀌고, 3·4차도 berserker 를 베이스로
#  만들 수밖에 없었다. 여기서 해적 2차 3종을 먼저 만들고, 위 TIER34 가 그것을
#  베이스로 쓰게 한다 — 그래야 해적 계열 전체가 일관된 실루엣을 갖는다.
#  베이스는 swashbuckler(검을 든 날렵한 실루엣) — 해적의 커틀러스/사브르와 가장 가깝다.
TIER2_PIRATE = [
    ("pirate",   "swashbuckler", 0xffd76a),   # 1차 해적 계열 색
    ("raider",   "swashbuckler", 0xffb347),   # 2차 — 포격형(주황)
    ("corsair",  "swashbuckler", 0x64e0c8),   # 2차 — 커틀러스형(청록)
]

# 2차 시트의 28프레임 (7상태 x 4)
#  v1.4.36 후속 — walkside 누락 수리. BODY_FRAME_NAMES(textures.ts)는 28프레임을 요구하는데
#  종전 STATES 에 walkside 가 없어 24프레임만 생성됐고, 좌우 이동 시
#  jobm_<3·4차>_walkside*.webp 가 404 → __MISSING 텍스처로 떨어졌다(실측: HTTP 404).
STATES = ["idle", "walk", "walkside", "walkup", "atk", "atkup", "atkdown", "die"]


def hex_to_hls(h):
    r = ((h >> 16) & 255) / 255.0
    g = ((h >> 8) & 255) / 255.0
    b = (h & 255) / 255.0
    return colorsys.rgb_to_hls(r, g, b)


def recolor(arr, target_hex, strength=0.72):
    """알파 유지 · RGB 를 target hue 로 회전.

    원본의 명도 구조(L)는 그대로 두고 색상(H)·채도(S)만 목표로 민다.
    strength 는 원본 색 잔존 비율(1.0=원본 유지, 0.0=완전 교체).
    """
    th, tl, ts = hex_to_hls(target_hex)
    out = arr.copy()
    rgb = arr[:, :, :3].astype(np.float32) / 255.0
    mask = arr[:, :, 3] > 0

    hh = np.zeros_like(rgb)
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        r, g, b = rgb[y, x]
        h, l, s = colorsys.rgb_to_hls(float(r), float(g), float(b))
        # 목표 hue 로 수렴 (원본 대비 최단 경로)
        dh = th - h
        if dh > 0.5:
            dh -= 1.0
        elif dh < -0.5:
            dh += 1.0
        h2 = (h + dh * strength) % 1.0
        # 채도는 목표에 가깝게, 명도는 원본 유지(질감 보존)
        s2 = s * (1 - strength) + max(s, ts) * strength
        r2, g2, b2 = colorsys.hls_to_rgb(h2, l, min(1.0, s2))
        hh[y, x] = (r2, g2, b2)

    out[:, :, :3] = np.clip(hh * 255, 0, 255).astype(np.uint8)
    out[:, :, 3] = arr[:, :, 3]  # 알파 보존
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.apply and not args.dry_run:
        ap.print_help()
        return 1

    made = skipped = 0
    # v1.4.38 (#4) — 해적 2차를 **먼저** 만든다. TIER34 의 해적 3·4차가
    #  corsair/raider 를 베이스로 참조하므로 순서가 중요하다.
    for group in (TIER2_PIRATE, TIER34):
        for key, base, hexc in group:
            for gender in ("m", "f"):
                src_pref = f"job{gender}_{base}"
                dst_pref = f"job{gender}_{key}"
                # 이미 있으면 건너뛴다(멱등)
                probe = os.path.join(ASSETS, f"{dst_pref}_idle0.webp")
                if os.path.exists(probe):
                    skipped += 1
                    continue
                # 베이스 시트가 없으면 건너뛴다(조용한 __MISSING 방지)
                if not os.path.exists(os.path.join(ASSETS, f"{src_pref}_idle0.webp")):
                    print(f"  SKIP {dst_pref} — 베이스 {src_pref} 없음")
                    skipped += 1
                    continue
                n = 0
                for st in STATES:
                    for i in range(4):
                        sp = os.path.join(ASSETS, f"{src_pref}_{st}{i}.webp")
                        if not os.path.exists(sp):
                            continue
                        src = np.array(Image.open(sp).convert("RGBA"))
                        out = recolor(src, hexc)
                        dp = os.path.join(ASSETS, f"{dst_pref}_{st}{i}.webp")
                        if args.apply:
                            Image.fromarray(out, "RGBA").save(dp, "WEBP", quality=95, method=6)
                        n += 1
                made += 1
                print(f"  {dst_pref:26s} ← {src_pref:24s} {n}프레임  hex=#{hexc:06x}")

    print(f"\n생성 {made}종 / 건너뜀 {skipped}종 / 모드={'APPLY' if args.apply else 'DRY-RUN'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
