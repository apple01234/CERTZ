#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4.18 (#2 에셋) — 여캐 chf0~5를 v1.1.0 원본 레시피로 재생성.

경위:
  v1.4.13/14의 PIL 박스머리 재생성으로 chf가 파손 → batch-6(019a85d)에서 jobf 재색칠로
  덮었으나 jobf 계열 자체가 "머리+갈색 덩어리" 실루엣이라 유저가 "에셋 안불러와짐"으로 인지.
  본 스크립트는 남캐(hero)와 동일한 아트 스타일의 정상 여캐(긴머리+스커트 실루엣 변환)를
  원본 gen_char_system.py 로직 그대로 재생성한다 — 코스튬/직업/남캐는 건드리지 않음.

산출: public/assets/chf{0,1,2,3,4,5}_{28프레임}.webp = 168파일
이후: scripts/gen_acc_anchors.py 로 앵커 재산출 필요 (아래 실행 블록이 자동 호출)
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gen_char_system as G


def regen_chf():
    made = 0
    for si in range(6):
        sm = G.skin_palette(si)
        if sm is None:
            sm = {}  # chf2 = 기본 피부 (실루엣만 변형)
        prefix = f"chf{si}"
        for fr in G.FRAMES:
            im = G.load_frame(fr)
            px = G.colors_of(im)
            im = G.make_longhair(im, px)
            px = G.colors_of(im)
            im = G.make_skirt(im, px)
            if sm:
                im = G.remap(im, sm)
            im.save(f"{G.OUT}/{prefix}_{fr}.webp", lossless=True)
            made += 1
    print("chf regenerated:", made)


if __name__ == "__main__":
    regen_chf()
    print("OK — 이제 gen_acc_anchors.py 를 실행해 앵커를 재산출하세요")
