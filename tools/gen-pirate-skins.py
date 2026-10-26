#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc187 (지시 #6 — "해적 전직시에 직업마다 있는 고유 모습 안보임") — 해적 계열 외형 생성.

진단(실측):
  jobf_*/jobm_* 직업 외형 시트가 8계열만 존재했다
  (archmage, assassin, berserker, guardian, sage, sniper, swashbuckler, windrunner).
  해적 계열(raider, corsair, stormcaptain, powdermaster, seaking, dreadnought)은
  남녀 모두 **파일이 0개**여서, 해적으로 전직해도 기본(모험가) 외형 그대로 보였다.

해결:
  8계열 시트는 96×64 · 28프레임 규격이 동일하다. 가장 중성적인 시트(swashbuckler —
  실제로 해적 계열과 같은 도적 뿌리)를 베이스로 삼아, 해적 계열 4종을
  계열별 팔레트로 리컬러해 생성한다. 신규 작화 없이 제공 에셋 규격을 그대로 쓴다.

출력: public/assets/job{f,m}_{raider,corsair,stormcaptain,powermaster...}_*.webp (28프레임)
"""
import os

import numpy as np
from PIL import Image

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
ASSETS = os.path.join(ROOT, "public", "assets")

FRAMES = [f"{p}{i}" for p in ("idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup") for i in range(4)]

# 계열별 목표 팔레트 — (어두운 옷, 중간 옷, 밝은 포인트)
#  해적 계열은 바다(청록) + 황동(금색) 조합으로 통일하되 단계별로 밝기를 올린다.
PALETTES = {
    # vc187 — 색상환을 넓게 분산해 실루엣만 봐도 계열이 구분되게 한다
    "raider":        {"cloth": (150, 116, 52),  "accent": (240, 200, 90)},   # 해적 — 황갈(사막 항해자)
    "corsair":       {"cloth": (40, 132, 128),  "accent": (236, 194, 92)},   # 해적 2차 — 청록
    "stormcaptain":  {"cloth": (44, 66, 150),   "accent": (250, 214, 110)},  # 폭풍선장 — 남청
    "powdermaster":  {"cloth": (156, 74, 40),   "accent": (255, 158, 74)},   # 화약대장 — 적갈/주황
    "seaking":       {"cloth": (28, 138, 176),  "accent": (168, 240, 255)},  # 해왕 — 심해 청
    "dreadnought":   {"cloth": (92, 48, 60),    "accent": (255, 110, 70)},   # 드레드노트 — 흑자주
}


def lum(px):
    return 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]


def recolor(src: Image.Image, cloth, accent) -> Image.Image:
    """옷(어두운 몸통)과 포인트(밝은 장식)를 계열 팔레트로 치환한다.

    피부/머리카락은 보존해야 캐릭터가 유지된다. 옷은 채도가 낮고 어두운 영역,
    포인트는 밝고 채도 높은 영역으로 판정한다.
    """
    a = np.array(src.convert("RGBA")).astype(np.int16)
    out = a.copy()
    h, w, _ = a.shape
    for y in range(h):
        for x in range(w):
            r, g, b, al = a[y, x]
            if al < 20:
                continue
            # 검정 외곽선/그림자는 유지
            if r < 26 and g < 26 and b < 26:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / mx if mx > 0 else 0
            L = lum((r, g, b))
            # 피부(따뜻한 밝은 톤) 보존 — R>G>B 이고 밝다
            if L > 150 and r > g > b and sat < 0.45:
                continue
            # 머리카락(갈색 계열, 중간 밝기) 보존
            if 60 < L < 150 and r > b + 18 and sat > 0.25 and not (g > r - 10):
                continue
            # vc187 — 상의(파란 옷) 판정: B가 R·G보다 크고 중간 밝기.
            #  원본 시트의 상의색은 (36,54,102)/(48,72,132) 두 톤이다.
            is_shirt = (b > r + 20) and (b > g + 12) and 30 < L < 150
            if is_shirt:
                # 상의는 계열색을 진하게 — 실루엣만 보여도 직업이 구분되게
                k = min(1.0, L / 130.0)
                out[y, x, 0] = min(255, int(cloth[0] * (0.78 + 0.5 * k)))
                out[y, x, 1] = min(255, int(cloth[1] * (0.78 + 0.5 * k)))
                out[y, x, 2] = min(255, int(cloth[2] * (0.78 + 0.5 * k)))
            elif L < 95 and sat < 0.6:
                # 어두운 옷 영역(바지) → cloth 어둡게
                k = L / 95.0
                out[y, x, 0] = min(255, int(cloth[0] * (0.55 + 0.5 * k)))
                out[y, x, 1] = min(255, int(cloth[1] * (0.55 + 0.5 * k)))
                out[y, x, 2] = min(255, int(cloth[2] * (0.55 + 0.5 * k)))
            elif L > 130 and sat > 0.35:
                # 밝은 장식 → accent
                k = min(1.0, L / 200.0)
                out[y, x, 0] = min(255, int(accent[0] * (0.72 + 0.42 * k)))
                out[y, x, 1] = min(255, int(accent[1] * (0.72 + 0.42 * k)))
                out[y, x, 2] = min(255, int(accent[2] * (0.72 + 0.42 * k)))
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def add_silhouette(im: Image.Image, job: str) -> Image.Image:
    """vc187 — 직업별 형태 차이. 실측 좌표 기반.

    이전 시도의 실패: 모자를 머리 '위'(y<15)에 그려 허공에 뜬 것처럼 보였고,
    대포를 얼굴 높이(y30)에 그려 얼굴을 가렸다.
    이번 원칙:
      · 모자류는 **머리 상단 픽셀을 덮어써서** 머리에 쓴 것처럼 만든다(y15~19 덮기).
      · 무기·장비는 몸통 옆/뒤(x<38 또는 x>60)에 두어 얼굴을 침범하지 않는다.
    """
    im = im.copy()
    a = im.load()
    W, H = im.width, im.height

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            a[x, y] = c + (255,)

    def filled(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                put(x, y, c)

    # 머리 상단 실루엣(원본): y15 x39~52, y16 x39~52, y17~18 x39~56
    if job == "raider":
        # 두건 — 머리 상단을 덮어쓴다 (y15~16 전 구간 + 옆으로 살짝)
        filled(38, 15, 57, 16, (150, 116, 52))
        for x in range(37, 59):
            put(x, 17, (128, 98, 44))
        filled(35, 17, 37, 21, (136, 104, 46))   # 뒤로 늘어지는 자락
    elif job == "corsair":
        # 삼각모자 — 머리 상단을 덮고 좌우로 챙이 나온다
        # 깊게 씌운다 (y15~18 덮기)
        filled(38, 15, 57, 18, (40, 132, 128))
        # 삼각 모자 — 앞/좌/우 세 귀퉁이가 위로 접힌 실루엣
        for dx, base in ((-1, 16), (0, 14), (1, 15)):
            put(42 + dx, base, (52, 152, 146))
            put(47 + dx, base, (52, 152, 146))
            put(52 + dx, base, (52, 152, 146))
        filled(40, 13, 43, 15, (58, 160, 154))   # 좌 귀퉁이
        filled(46, 12, 49, 14, (58, 160, 154))   # 앞 귀퉁이
        filled(52, 13, 55, 15, (58, 160, 154))   # 우 귀퉁이
        for x in range(33, 62):
            put(x, 19, (26, 92, 90))             # 넓은 챙
        for x in (34, 35, 59, 60):
            put(x, 20, (26, 92, 90))
    elif job == "stormcaptain":
        # 장교모자 — 납작한 통 + 금테 + 챙
        filled(40, 12, 55, 16, (44, 66, 150))    # 모자 통 (2px 더 높게)
        for x in range(39, 57):
            put(x, 17, (250, 214, 110))          # 금테
        for x in range(34, 61):
            put(x, 18, (30, 48, 110))            # 챙
        for x in (34, 35, 59, 60):
            put(x, 19, (30, 48, 110))
        put(47, 11, (250, 214, 110))             # 모표 (위로)
    elif job == "powdermaster":
        # 등 뒤 화약통 — 몸통 왼쪽 뒤 (얼굴 침범 없음)
        filled(28, 26, 36, 44, (120, 58, 30))
        for y in (28, 35, 42):
            for x in range(28, 37):
                put(x, y, (58, 32, 16))          # 통 테
        for x in range(28, 37):
            put(x, 25, (255, 158, 74))           # 뚜껑
        for y in range(27, 34):
            put(37, y, (86, 50, 30))             # 어깨끈
    elif job == "seaking":
        # 삼지창 — 오른쪽 옆, 손 높이(y34)에서 위로 뻗는다 (얼굴 x35~60 밖)
        filled(63, 8, 64, 40, (150, 220, 250))   # 창대 (2px)
        filled(61, 8, 66, 10, (168, 240, 255))   # 세 갈래 받침
        for x in (61, 63, 66):
            filled(x, 5, x, 7, (210, 250, 255))
        filled(62, 34, 65, 36, (120, 190, 230))  # 손잡이 강조
    elif job == "dreadnought":
        # 대포 — 어깨 뒤(y27~31)에서 오른쪽으로. 얼굴(y30~40)을 가리지 않게 위로 올린다
        filled(58, 27, 74, 31, (70, 70, 80))
        for x in range(58, 75):
            put(x, 31, (40, 40, 48))
        filled(74, 26, 77, 32, (52, 52, 60))     # 포구
        put(77, 28, (255, 110, 70))              # 화염
        put(78, 29, (255, 160, 90))
        filled(56, 32, 59, 34, (56, 56, 66))     # 어깨 받침
    return im


def build():
    made = 0
    miss = []
    for gender in ("m", "f"):
        base_prefix = f"job{gender}_swashbuckler"
        for job, pal in PALETTES.items():
            for fr in FRAMES:
                src_p = os.path.join(ASSETS, f"{base_prefix}_{fr}.webp")
                if not os.path.exists(src_p):
                    miss.append(f"{base_prefix}_{fr}")
                    continue
                dst_p = os.path.join(ASSETS, f"job{gender}_{job}_{fr}.webp")
                src = Image.open(src_p)
                out_im = add_silhouette(recolor(src, pal["cloth"], pal["accent"]), job)
                out_im.save(dst_p, "WEBP", lossless=True, method=6)
                made += 1
    print(f"해적 계열 외형 {made}개 생성 (6계열 × 2성별 × 28프레임)")
    if miss:
        print(f"베이스 누락 {len(miss)}건: {miss[:5]}")


if __name__ == "__main__":
    build()
