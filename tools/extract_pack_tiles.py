#!/usr/bin/env python3
"""SERTZ 지면 타일 — TopDown 2D RPG BE3 팩의 Tiles.png 에서 추출.

유저 지시 #5: "DLC 및 재림 스테이지 빼고는 종이쪼가리 같은 너가 쳐 만든 타일맵 쓰지마.
              분명 예전 이런 느낌의 타일맵 에셋을 써라고 했을텐데??"

■ 원본 격자 실측
  Tiles.png = 101x101, 검은 구분선이 16/33/50/67/84 행·열에 있다 → 셀 16px, 6x6.
  (101 = 6*16 + 5 → 16px 셀 + 1px 선 구조)
  좌상단 3x3 = 잔디, 우상단 3x3 = 모래, 좌하단 3x3 = 물, 우하단 = 흙/입구.

■ 추출 대상 (중앙 타일만 — 테두리 오토타일은 지면 반복용이 아니다)
  grass   (0,0) 셀 = 순수 잔디
  sand    (3,0) 셀 = 순수 모래/흙길
  water   (0,3) 셀 = 순수 물
  dirt    (3,3) 셀 = 순수 갈색 흙

■ 출력
  256x256 으로 NEAREST 업스케일(픽셀아트 보존) 후 webp.
  기존 코드가 256px 타일을 setTileScale(1) 로 크게 깔고 있으므로 크기를 맞춘다.
"""
import os
from PIL import Image

SRC = "/root/workspace/_assets_in/x2/TopDown 2D RPG BE3/Sprites/Tiles.png"
OUT = "/root/workspace/CERTZ/public/assets"

# 셀 인덱스 (col, row) — 16px 셀, 구분선 제외
# ⚠ 각 3x3 블록의 "모서리" 셀은 상단·좌측 하이라이트 + 하단·우측 그림자(베벨)가
#   들어가 있어 반복하면 블록/플랫폼처럼 보인다. 반드시 **중앙 셀(1,1)** 을 쓴다.
#   좌상단 3x3 잔디 = cols 0..2, rows 0..2 → 중앙 (1,1)
#   우상단 3x3 모래 = cols 3..5, rows 0..2 → 중앙 (4,1)
#   좌하단 3x3 물   = cols 0..2, rows 3..5 → 중앙 (1,4)
#   우하단 3x3 흙   = cols 3..5, rows 3..5 → 중앙 (4,4)
CELL = {
    "grass": (1, 1),
    "sand":  (4, 1),
    "water": (1, 4),
    "dirt":  (3, 4),
}

# v1.4.35 — 반복 격자감 완화용 변형 타일.
#  같은 3x3 블록 안에서 베벨이 없는 내부 셀들을 변형으로 함께 뽑아
#  WorldScene 이 무작위로 섞어 깔게 한다(같은 무늬가 64px 주기로 규칙 반복되는 것 방지).
VARIANTS = {
    "grass": [(1, 1), (0, 1), (1, 0)],
    "sand":  [(4, 1), (3, 1), (4, 0)],
    "water": [(1, 4), (0, 4), (1, 3)],
    "dirt":  [(3, 4), (4, 3), (3, 3)],
}
CELL_PX = 16
LINE = 1  # 셀 사이 구분선

def cell_box(c: int, r: int):
    x = c * (CELL_PX + LINE)
    y = r * (CELL_PX + LINE)
    return (x, y, x + CELL_PX, y + CELL_PX)

def main():
    im = Image.open(SRC).convert("RGBA")
    print(f"원본 {SRC.split('/')[-1]} {im.size}")
    for name, (c, r) in CELL.items():
        box = cell_box(c, r)
        tile = im.crop(box)
        # 64x64 로 4배 업스케일 (16 → 64, NEAREST 로 픽셀 보존)
        #  ⚠ 256px(16배)로 키우면 16px 원본의 픽셀 하나가 16x16 블록이 되어
        #    화면이 거대한 모자이크처럼 보인다. 반복 주기(=텍스처 크기, setTileScale 1)
        #    를 64px 로 두면 1280px 화면에 20회 반복 — 픽셀아트 질감이 유지되면서
        #    "크게크게 배치"(지시 #3) 도 만족한다.
        big = tile.resize((64, 64), Image.NEAREST)
        dst = os.path.join(OUT, f"tile_{name}_pack.webp")
        big.save(dst, "WEBP", quality=100, method=6)
        # 검증: 업스케일 후에도 16px 격자가 유지되는지 + 색 다양성
        import numpy as np
        a = np.array(big.convert("RGB"))
        print(f"  {name:6s} cell({c},{r}) → {dst.split('/')[-1]}  {big.size}  std={a.std():5.1f}  colors={len(np.unique(a.reshape(-1,3),axis=0))}")

    # 변형 타일 추출 (tile_<name>_pack_v1/v2.webp)
    for name, cells in VARIANTS.items():
        for vi, (c, r) in enumerate(cells[1:], start=1):
            tile = im.crop(cell_box(c, r))
            big = tile.resize((64, 64), Image.NEAREST)
            dst = os.path.join(OUT, f"tile_{name}_pack_v{vi}.webp")
            big.save(dst, "WEBP", quality=100, method=6)
        print(f"  {name:6s} 변형 {len(cells)-1}종 추가")

    # 실제 반복 느낌 확인용: 각 타일을 4x4 로 타일링해 256px 블록으로
    preview = Image.new("RGB", (512, 512))
    order = ["grass", "sand", "water", "dirt"]
    for i, n in enumerate(order):
        t = Image.open(os.path.join(OUT, f"tile_{n}_pack.webp")).convert("RGB")
        for ty in range(4):
            for tx in range(4):
                preview.paste(t, ((i % 2) * 256 + tx * 64, (i // 2) * 256 + ty * 64))
    preview.save("/tmp/tiles_pack_preview.png")
    print("\n미리보기 /tmp/tiles_pack_preview.png")

if __name__ == "__main__":
    main()
