#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.3.0 아이템 스프라이트 생성기 (유저 지시 #3 망토 + #4 NPC급 코스튬 세트)

[#3 망토] acc_cape_crimson / acc_cape_royal — 등에 흐르는 천 망토 (40x34)
  · 어깨에서 아래로 넓어지는 사다괴형 천 + 세로 주름 하이라이트 + 금 스팽글 테두리
  · 렌더 규칙: 뒷모습에서 플레이어 앞(depth +0.25), 정면/측면에선 뒤에 숨음 (WorldScene #3)

[#4 NPC급 프리미엄 코스튬 3세트] — 기존 chf/chm(=예쁜여캠/남캠 시트)을 세트 팔레트로 완전 재착장
  · outfit_flame  화염무사 세트 — 진홍 갑주 + 금 트림 + 백금 머리
  · outfit_frost  서리기사 세트 — 백은 판금 + 빙하 청 + 은발
  · outfit_mystic 신비술사 세트 — 칠흑 로브 + 제비꽃 + 금성 문양
  NPC처럼 "완성된 한 벌"로 보이게: 옷 클러스터 상단에 1px 금 트림(카라/금장),
  옷 세로 그라데이션(위 밝게/아래 어둡게), 머리 광택 밴드를 세트색으로 재적용
"""
import os
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/public/assets"

# hero_* 원본 고정 팔레트 (gen_char_system.py 계승 — 기존 생성기와 동일)
H  = (87, 58, 35, 255)    # 머리 메인
hS = (64, 39, 23, 255)    # 머리 그늘
SK = (172, 123, 93, 255)  # 피부
SK2= (193, 172, 143, 255) # 피부 밝은
CT = (164, 168, 181, 255) # 셔츠
Ct = (120, 126, 151, 255) # 셔츠 그늘
Cu = (219, 210, 199, 255) # 셔츠 하이라이트
P  = (44, 101, 181, 255)  # 바지
Pp = (29, 67, 138, 255)   # 바지 그늘
Pd = (13, 32, 94, 255)    # 바지 짙은
EY = (33, 17, 13, 255)    # 눈

BASE_COLORS = {H, hS, SK, SK2, CT, Ct, Cu, P, Pp, Pd, EY}

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append((pre, i))

def rgba(c, a=255):
    return (c[0], c[1], c[2], a)

def remap_palette(px, w, h, mapping):
    """hero 팔레트 → 세트 팔레트 전체 치환"""
    hits = []
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p in mapping:
                px[x, y] = mapping[p]
                hits.append((x, y))
    return hits

def gold_trim_cloth(px, w, h, cloth_s, gold=(232, 190, 92, 255), deep=(140, 96, 34, 255)):
    """옷(Ct=그늘색) 클러스터의 최상단 1행을 금 트림으로 — 카라/금장 인상 (NPC 갑주 느낌 핵심)"""
    cloth_pts = [(x, y) for y in range(h) for x in range(w) if px[x, y] == cloth_s]
    if not cloth_pts:
        return
    # 클러스터별(좌/우 분리 대비 — x갭>4) 최상단 픽셀 찾기
    xs = sorted({x for x, _ in cloth_pts})
    clusters = [[xs[0]]]
    for x in xs[1:]:
        if x - clusters[-1][-1] > 4:
            clusters.append([x])
        else:
            clusters[-1].append(x)
    for cl in clusters:
        for x in cl:
            ys = [y for (xx, y) in cloth_pts if xx == x]
            if ys:
                top = min(ys)
                px[x, top] = gold
                if top + 1 < h and px[x, top + 1] == cloth_s:
                    px[x, top + 1] = deep  # 트림 바로 아래 그늘 1px — 입체감

def shade_gradient_cloth(px, w, h, cloth, cloth_s, cloth_l):
    """옷 클러스터 세로 그라데이션 — 위 y 최상단 기준 위쪽 60%는 원색, 아래 40%는 살짝 어둡게 (한 벌 옷의 깊이)"""
    cloth_pts = [(x, y) for y in range(h) for x in range(w) if px[x, y] == cloth]
    if not cloth_pts:
        return
    ys = sorted({y for _, y in cloth_pts})
    mid = ys[0] + int((ys[-1] - ys[0]) * 0.6)
    dark = tuple(max(0, int(v * 0.82)) for v in cloth[:3]) + (255,)
    for (x, y) in cloth_pts:
        if y > mid:
            px[x, y] = dark

def gen_cape(path, main, dark, light, gold):
    """망토 40x34 — 어깨 폭 26px에서 아래로 38px로 퍼지는 사다괴 + 주름 + 금 테두리"""
    im = Image.new("RGBA", (40, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 목 부분(위 중앙 좁게) → 아래로 퍼짐
    top_w, bot_w = 22, 34
    cx = 20
    for i in range(30):
        t = i / 29.0
        w = int(top_w + (bot_w - top_w) * t)
        y = 2 + i
        # 세로 그라데이션 (위 밝게 → 아래 어둡게)
        f = 1.0 - 0.34 * t
        col = tuple(min(255, int(c * f)) for c in main[:3]) + (255,)
        d.line([(cx - w // 2, y), (cx + w // 2, y)], fill=col)
    # 좌우 외곽선
    for i in range(30):
        t = i / 29.0
        w = int(top_w + (bot_w - top_w) * t)
        y = 2 + i
        d.point((cx - w // 2, y), fill=dark)
        d.point((cx + w // 2, y), fill=dark)
    # 세로 주름 3줄 (어두운 1px — 천 결)
    for fx in (-6, 0, 6):
        for i in range(6, 30):
            t = i / 29.0
            w = int(top_w + (bot_w - top_w) * t)
            xx = cx + int(fx * (0.55 + 0.45 * t))
            if abs(xx - cx) < w // 2 - 1:
                col = tuple(max(0, int(c * 0.78)) for c in main[:3]) + (255,)
                d.point((xx, 2 + i), fill=col)
    # 하이라이트 밴드 (어깨 아래 빛)
    for i in range(3, 7):
        t = (i - 2) / 29.0
        w = int(top_w + (bot_w - top_w) * t)
        d.line([(cx - w // 2 + 2, i), (cx + w // 2 - 2, i)], fill=light)
    # 하단 금 스팽글 테두리
    for i in range(29, 31):
        t = i / 29.0
        w = int(top_w + (bot_w - top_w) * t)
        d.line([(cx - w // 2, 2 + i), (cx + w // 2, 2 + i)], fill=gold)
    # 목 고리 (금)
    d.rectangle([cx - 4, 0, cx + 3, 3], fill=gold)
    im.save(path)
    print("cape saved:", path)

# ---------- [#4] 세트 팔레트 (성별 분리 — chf는 드레스=leg가 몸 대부분, chm은 상의=cloth가 얼굴 옷)
#  female: leg(드레스)=세트 주색 · cloth(블라우스)=보조 밝은톤
#  male:   cloth(상의 갑주)=세트 주색 · leg(바지)=어두운 보색
SETS = {
    "flame": {
        "hair": (238, 232, 224, 255), "hairS": (198, 188, 182, 255),  # 백금 머리
        "eye": (240, 120, 60, 255),                                    # 주홍 눈
        "f": {"cloth": (246, 226, 208, 255), "clothS": (222, 190, 166, 255), "clothL": (255, 244, 232, 255),
              "leg": (178, 44, 48, 255), "legS": (128, 28, 34, 255), "legD": (88, 18, 26, 255)},
        "m": {"cloth": (178, 44, 48, 255), "clothS": (128, 28, 34, 255), "clothL": (232, 96, 70, 255),
              "leg": (96, 22, 30, 255), "legS": (66, 14, 22, 255), "legD": (44, 10, 16, 255)},
    },
    "frost": {
        "hair": (214, 230, 244, 255), "hairS": (170, 192, 214, 255),  # 은발
        "eye": (110, 200, 240, 255),                                   # 빙하 눈
        "f": {"cloth": (244, 250, 255, 255), "clothS": (216, 232, 246, 255), "clothL": (255, 255, 255, 255),
              "leg": (150, 196, 226, 255), "legS": (104, 152, 192, 255), "legD": (68, 108, 148, 255)},
        "m": {"cloth": (150, 196, 226, 255), "clothS": (104, 152, 192, 255), "clothL": (216, 240, 252, 255),
              "leg": (56, 64, 92, 255), "legS": (40, 46, 68, 255), "legD": (28, 32, 48, 255)},
    },
    "mystic": {
        "hair": (110, 84, 200, 255), "hairS": (78, 56, 150, 255),     # 제비꽃 머리
        "eye": (240, 204, 100, 255),                                   # 금성 눈
        "f": {"cloth": (208, 192, 244, 255), "clothS": (172, 150, 224, 255), "clothL": (236, 224, 255, 255),
              "leg": (56, 40, 92, 255), "legS": (38, 26, 66, 255), "legD": (24, 16, 46, 255)},
        "m": {"cloth": (76, 58, 120, 255), "clothS": (52, 38, 88, 255), "clothL": (120, 96, 176, 255),
              "leg": (28, 24, 40, 255), "legS": (20, 16, 30, 255), "legD": (14, 12, 22, 255)},
    },
}

GOLD = (232, 190, 92, 255)
GOLD_D = (150, 108, 40, 255)

def main():
    # ---------- [#3 망토 2종] ----------
    gen_cape(os.path.join(SRC, "acc_cape_crimson.webp"),
             main=(178, 44, 52, 255), dark=(112, 24, 32, 255), light=(232, 104, 104, 255), gold=(238, 196, 96, 255))
    gen_cape(os.path.join(SRC, "acc_cape_royal.webp"),
             main=(58, 78, 168, 255), dark=(34, 46, 112, 255), light=(120, 148, 232, 255), gold=(238, 196, 96, 255))

    # ---------- [#4 NPC급 코스튬 3세트 × 남녀] ----------
    for gender, base_prefix in (("f", "chf"), ("m", "chm")):
        # 베이스 시트 프레임 수집 (chf0 등 — 피부 변형 6종 중 0번(기본)을 베이스로 사용)
        for set_name, pal in SETS.items():
            out_prefix = f"cost{'m' if gender == 'm' else ''}_{set_name}"
            for pre, i in FRAMES:
                src_path = os.path.join(SRC, f"{base_prefix}0_{pre}{i}.webp")
                if not os.path.exists(src_path):
                    print("MISSING BASE:", src_path)
                    continue
                im = Image.open(src_path).convert("RGBA")
                px = im.load()
                w, h = im.size
                gp = pal[gender]
                mapping = {
                    H: pal["hair"], hS: pal["hairS"],
                    CT: gp["cloth"], Ct: gp["clothS"], Cu: gp["clothL"],
                    P: gp["leg"], Pp: gp["legS"], Pd: gp["legD"],
                    EY: pal["eye"],
                    # 피부는 베이스 그대로 (SK/SK2 유지 — 채색 없는 세트)
                }
                remap_palette(px, w, h, mapping)
                shade_gradient_cloth(px, w, h, gp["cloth"], gp["clothS"], gp["clothL"])
                gold_trim_cloth(px, w, h, gp["clothS"])  # 상의 클러스터 상단 금 트림
                gold_trim_cloth(px, w, h, gp["legS"])    # 드레스/바지 클러스터 상단 금 트림
                out_path = os.path.join(SRC, f"{out_prefix}_{pre}{i}.webp")
                im.save(out_path)
            print(f"set done: {out_prefix} (28 frames)")

if __name__ == "__main__":
    main()
