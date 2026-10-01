#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.17 — 여캐 스프라이트 전면 교체. 유저 지시 "여캐 ㅈㄴ 이상함 => 에셋을 사용해야지".

gen_v1412(SPUM 합성)·v1413(남캐 베이스)·v1414(PIL 드로잉) 3차 시도 모두 실패한 커스텀
생성 라인을 폐기하고, 검증된 기존 에셋(jobf_* — SPUM 합성 정상 여캐)을 베이스로 사용한다.

· 소스: jobf_swashbuckler_{28프레임}.webp (96×64, 남캐 chm/hero와 동일 규격·스켈레톤)
· 교체: chf{0..5}_{28프레임}.webp — 피부톤만 남캐 라인(chm0/1/3/4/5·hero)과 동일하게 재색칠
  (헤어/의상/실루엣은 원본 유지 — 눈·입·볼터치 등 디테일 보존)
· 앵커: acc_anchors.ts의 chf{i}_* 좌표를 jobf_swashbuckler_* 값으로 싱크 (기하 동일)

출력: public/assets/chf{0..5}_{28프레임}.webp (168개)
"""
import os
import re
from PIL import Image

ROOT = "/home/z/my-project"
ASSETS = os.path.join(ROOT, "public", "assets")
SRC_PREFIX = "jobf_swashbuckler"
OUT_PREFIX_FMT = "chf{}"

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

# 피부톤 6종 — 남캐 라인에서 추출한 실제 값 (0백자 1밝은 2기본(hero) 3밀색 4구릿빛 5초콜릿)
TONES = {
    0: (248, 224, 198),
    1: (232, 197, 159),
    2: (193, 172, 143),
    3: (182, 142, 104),
    4: (126, 86, 58),
    5: (124, 88, 62),
}

# 베이스 스프라이트의 피부색 클러스터 (얼굴 주톤+하이라이트 — 사전 추출)
BASE_SKINS = [(236, 200, 168), (250, 220, 192)]

TOLERANCE = 70  # 피부 판정 거리(유클리드) — 눈/헤어/의상은 이보다 멀어서 무영향


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def recolor(src_path, dst_path, tone):
    im = Image.open(src_path).convert("RGBA")
    px = im.load()
    base_lum = lum(BASE_SKINS[0])
    tgt_lum = lum(tone)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            for bs in BASE_SKINS:
                d = ((r - bs[0]) ** 2 + (g - bs[1]) ** 2 + (b - bs[2]) ** 2) ** 0.5
                if d < TOLERANCE:
                    # 명도 비율 보존 (주톤/하이라이트/그림자 그레이딩 유지)
                    ratio = lum((r, g, b)) / max(1.0, base_lum)
                    nr = min(255, max(0, int(tone[0] * ratio)))
                    ng = min(255, max(0, int(tone[1] * ratio)))
                    nb = min(255, max(0, int(tone[2] * ratio)))
                    px[x, y] = (nr, ng, nb, a)
                    break
    im.save(dst_path, "WEBP", quality=95, method=6)


def sync_anchors():
    """acc_anchors.ts: chf{i}_{frame} 좌표를 jobf_swashbuckler_{frame} 값으로 교체."""
    path = os.path.join(ROOT, "src", "game", "acc_anchors.ts")
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    # jobf_swashbuckler_{frame}: [x, y, w, h] 추출
    pat_src = re.compile(r'"jobf_swashbuckler_([a-z0-9]+)":\s*\[([^\]]+)\]')
    src_map = {m.group(1): m.group(2).strip() for m in pat_src.finditer(text)}
    missing = [f for f in FRAMES if f not in src_map]
    if missing:
        raise SystemExit(f"앵커 원본 누락: {missing}")

    replaced = 0
    for i in range(6):
        for fr in FRAMES:
            pat = re.compile(rf'"chf{i}_{fr}":\s*\[[^\]]+\]')
            new = f'"chf{i}_{fr}": [{src_map[fr]}]'
            text, n = pat.subn(new, text)
            replaced += n
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return replaced


def main():
    # 1) 소스 28프레임 검증
    for fr in FRAMES:
        p = os.path.join(ASSETS, f"{SRC_PREFIX}_{fr}.webp")
        if not os.path.exists(p):
            raise SystemExit(f"소스 누락: {p}")

    # 2) 6스킨 × 28프레임 생성
    made = 0
    for i, tone in TONES.items():
        for fr in FRAMES:
            src = os.path.join(ASSETS, f"{SRC_PREFIX}_{fr}.webp")
            dst = os.path.join(ASSETS, f"chf{i}_{fr}.webp")
            recolor(src, dst, tone)
            made += 1
    print(f"[1/2] 스프라이트 재생성 완료: {made}개 (chf0~5 × 28프레임)")

    # 3) 앵커 싱크
    n = sync_anchors()
    print(f"[2/2] acc_anchors.ts chf 앵커 싱크 완료: {n}개 교체")


if __name__ == "__main__":
    main()
