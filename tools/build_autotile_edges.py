#!/usr/bin/env python3
"""
build_autotile_edges.py — 지면 경계(오토타일) 오버레이 아틀라스 생성

설계
----
바닥 전체를 타일마다 이미지로 깔면 오브젝트 수가 폭발한다(맵 2200x1200 / 64px
= 600개 이상). 대신:

  1) 내부는 지금처럼 TileSprite 한 장으로 깐다(원본 텍스처 그대로 → 화질 손실 0).
  2) 벽과 맞닿은 **경계 셀에만** 이 아틀라스의 프레임을 오버레이한다.

아틀라스 = 4x4(16프레임, 256px). 프레임 인덱스 = 이웃 마스크(0~15).
각 프레임은 "같은 계열이 없는 쪽"에 어두운 가장자리를 그린 투명 오버레이다.
마스크 15(사방 연결)는 완전 투명 → 오버레이 불필요.

마스크 규칙은 게임 빌드 실측(tools/autotile_derive.py)에서 가져왔다:
1=상 2=하 4=좌 8=우 가 같은 계열.

vc204 수정 이력
--------------
초기 버전은 띠 폭 22px / 세기 118 이었다. 그런데 실제 셀은 64px 로 축소해
합성하므로 띠가 5px 로 줄고, 렌더 알파 0.55 까지 곱해져 경계가 사실상
사라졌다(tools/sim_autotile.py 실측: 내부 대비 -0.5 = FAIL).
→ 띠 폭을 셀 대비 비율(26%)로 키우고 세기를 올려, 축소 후에도 읽히게 한다.
   목표: 경계 셀 평균 밝기가 내부보다 6 이상 어두울 것.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = "/root/workspace/CERTZ/public/assets/autotile_edge.webp"
CELL = 256
EDGE_RATIO = 0.26
EDGE = int(CELL * EDGE_RATIO)
STRENGTH = 235


def _vgrad(w, h, from_left):
    """가로 알파 그라데이션. from_left=True 면 왼쪽이 진하다."""
    g = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(g)
    for x in range(w):
        k = (1 - x / max(1, w - 1)) if from_left else (x / max(1, w - 1))
        d.line([(x, 0), (x, h)], fill=int(STRENGTH * k ** 1.6))
    return g


def _hgrad(w, h, from_top):
    """세로 알파 그라데이션. from_top=True 면 위가 진하다."""
    g = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(g)
    for y in range(h):
        k = (1 - y / max(1, h - 1)) if from_top else (y / max(1, h - 1))
        d.line([(0, y), (w, y)], fill=int(STRENGTH * k ** 1.6))
    return g


def make_frame(mask: int) -> Image.Image:
    """마스크에 맞는 경계 오버레이 1프레임(RGBA)."""
    im = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    black = (0, 0, 0, 255)

    if not (mask & 1):      # 위가 연결 안 됨 → 상단 띠
        im.paste(black, (0, 0, CELL, EDGE), _hgrad(CELL, EDGE, True))
    if not (mask & 2):      # 아래
        im.paste(black, (0, CELL - EDGE, CELL, CELL), _hgrad(CELL, EDGE, False))
    if not (mask & 4):      # 왼쪽
        im.paste(black, (0, 0, EDGE, CELL), _vgrad(EDGE, CELL, True))
    if not (mask & 8):      # 오른쪽
        im.paste(black, (CELL - EDGE, 0, CELL, CELL), _vgrad(EDGE, CELL, False))

    # 이음새만 부드럽게 (과하게 흐리면 축소 후 사라진다)
    im = im.filter(ImageFilter.GaussianBlur(2))
    return im


def main():
    sheet = Image.new("RGBA", (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for mask in range(16):
        if mask == 15:
            continue                      # 내부 — 오버레이 없음
        fr = make_frame(mask)
        sheet.paste(fr, ((mask % 4) * CELL, (mask // 4) * CELL), fr)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT, "WEBP", quality=92, method=6)
    print(f"saved {OUT}  {sheet.size}  {os.path.getsize(OUT)/1024:.0f} KB")
    print(f"frames 16 (4x4), cell {CELL}px, band {EDGE}px ({EDGE_RATIO:.0%}), strength {STRENGTH}")


if __name__ == "__main__":
    main()
