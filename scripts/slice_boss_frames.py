#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
보스 전면 리메이크 — bsw 시트 → 개별 프레임 분할 파이프라인

시트 구조(7행 균일 그리드): 0=idle 1=walk 2=atk 3=death (4~6=sp1~3 — 향후 확장용, 미출력)
출력: public/assets/{tex}_{state}{i}.webp  (i=0..5, 상태당 6프레임 균일)
  - tex 매핑: guardian=boss, behemoth=boss2, abysslord=boss3, 나머지=boss_<key>
  - 기존 {tex}_idle0/1.webp(.png) 덮어씀 → 게임이 즉시 신규 아트로 스왑
  - png는 기존에 존재하던 키(idle0/1)에 한정 재생성 (신규 키는 webp만 — APK 용량)
셀 크기: 드래곤 220x147(7열) / 골렘·선박 256x171(6열) / 늑대 204x184(6열)
빈 셀(투명)은 직전 프레임 복제로 플리커 방지
"""
from PIL import Image
import os, shutil

PUB = "/home/z/my-project/public/assets"
SRC = "/home/z/my-project/assets_src/boss_sheets"
os.makedirs(SRC, exist_ok=True)

# (시트, tex 접두사, cols, cw, ch)
SPECS = [
    ("bsw_guardian",  "boss",           7, 220, 147),
    ("bsw_behemoth",  "boss2",          6, 256, 171),
    ("bsw_abysslord", "boss3",          6, 256, 171),
    ("bsw_nidhog",    "boss_nidhog",    7, 220, 147),
    ("bsw_surt",      "boss_surt",      6, 256, 171),
    ("bsw_fenrir",    "boss_fenrir",    6, 204, 184),
    ("bsw_skoll",     "boss_skoll",     6, 204, 184),
    ("bsw_gram",      "boss_gram",      6, 204, 184),
    ("bsw_abudditos", "boss_abudditos", 7, 220, 147),
    ("bsw_vord",      "boss_vord",      7, 220, 147),
    ("bsw_jorm",      "boss_jorm",      7, 220, 147),
    ("bsw_nagr",      "boss_nagr",      7, 220, 147),
]
STATES = ["idle", "walk", "atk", "die"]  # 행 0~3
N_FRAMES = 6

def cell_nonempty(im: Image.Image) -> bool:
    """알파 합이 유의미하면 콘텐츠 있음으로 판정"""
    a = im.getchannel("A")
    hist = a.histogram()
    return sum(hist[24:]) > 40  # 알파 >= 24 픽셀이 40개 미만이면 빈 셀

def main():
    total = 0
    for sheet, prefix, cols, cw, ch in SPECS:
        path = f"{PUB}/{sheet}.webp"
        if not os.path.exists(path):
            print(f"!! 시트 없음: {path}")
            continue
        im = Image.open(path).convert("RGBA")
        W, H = im.size
        for r, state in enumerate(STATES):
            prev = None
            for i in range(N_FRAMES):
                # 시트는 cols개 셀 — 드래곤(7열)은 앞 6프레임 사용
                x0, y0 = i * cw, r * ch
                if x0 + cw > W:  # 셀 초과 — 직전 복제
                    cellim = prev
                else:
                    cellim = im.crop((x0, y0, x0 + cw, y0 + ch))
                    if not cell_nonempty(cellim):
                        cellim = prev  # 빈 셀 — 직전 프레임 복제
                if cellim is None:
                    # 첫 셀이 빈 경우 — 다음 유의미한 셀 탐색
                    for j in range(i + 1, cols):
                        cj = im.crop((j * cw, r * ch, (j + 1) * cw, r * ch + ch))
                        if cell_nonempty(cj):
                            cellim = cj
                            break
                    if cellim is None:
                        cellim = im.crop((0, r * ch, cw, r * ch + ch))
                prev = cellim
                key = f"{prefix}_{state}{i}"
                cellim.save(f"{PUB}/{key}.webp", "WEBP", quality=90, method=4)
                # 기존 png가 있던 키(idle0/1)만 png 유지
                if state == "idle" and i < 2 and os.path.exists(f"{PUB}/{key}.png"):
                    cellim.save(f"{PUB}/{key}.png", "PNG")
                total += 1
        kb = os.path.getsize(f"{PUB}/{prefix}_idle0.webp") // 1024
        print(f"  ✓ {prefix:16s} ← {sheet}  idle0 {kb}KB")
    print(f"총 {total} 프레임 출력 완료")

    # 원본 시트를 배포 제외 폴더로 이동 (public 잔존 시 APK/웹에 9MB 무송출 물량)
    for sheet, *_ in SPECS:
        src = f"{PUB}/{sheet}.webp"
        if os.path.exists(src):
            shutil.move(src, f"{SRC}/{sheet}.webp")
    print(f"원본 시트 {SRC} 이동 완료 (배포 제외)")

if __name__ == "__main__":
    main()
