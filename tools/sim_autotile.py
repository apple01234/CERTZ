#!/usr/bin/env python3
"""
sim_autotile.py — 오토타일 경계 배치 로직 시뮬레이션 (브라우저 없이)

src/game/autotile.ts 와 동일한 마스크 규칙을 파이썬으로 재현하고,
public/assets/autotile_edge.webp 아틀라스를 실제로 합성해 결과 이미지를 만든다.

목적:
  1) 마스크 계산이 맞는지 (내부=15, 경계<15)
  2) 아틀라스 프레임 인덱스가 의도한 방향의 띠를 그리는지
  3) 실제 지면 위에 얹었을 때 경계가 읽히는지

픽셀 판정을 사람 눈 없이 하기 위해, 경계 셀의 평균 밝기가 내부 셀보다
낮은지(=경계가 어둡게 그려졌는지)를 수치로 확인한다.
"""
import os, math
from PIL import Image

ASSETS = "/root/workspace/CERTZ/public/assets"
CELL = 256

BIT_UP, BIT_DOWN, BIT_LEFT, BIT_RIGHT = 1, 2, 4, 8


def open_mask_at(open_grid, cols, rows, c, r):
    """src/game/autotile.ts openMaskAt 과 동일."""
    def at(cc, rr):
        if cc < 0 or rr < 0 or cc >= cols or rr >= rows:
            return False
        return bool(open_grid[rr * cols + cc])
    if not at(c, r):
        return 0
    m = 0
    if at(c, r - 1): m |= BIT_UP
    if at(c, r + 1): m |= BIT_DOWN
    if at(c - 1, r): m |= BIT_LEFT
    if at(c + 1, r): m |= BIT_RIGHT
    return m


def make_room(cols, rows, seed=1):
    """간단한 방 레이아웃 (가장자리 벽 + 중앙 방 + 통로)."""
    g = [0] * (cols * rows)
    # 중앙 방
    x0, y0, x1, y1 = cols // 4, rows // 4, cols * 3 // 4, rows * 3 // 4
    for r in range(y0, y1 + 1):
        for c in range(x0, x1 + 1):
            g[r * cols + c] = 1
    # 통로
    for c in range(x0, cols - 2):
        g[(rows // 2) * cols + c] = 1
    for r in range(y0, rows - 2):
        g[r * cols + (cols // 2)] = 1
    return g


def main():
    sheet = Image.open(os.path.join(ASSETS, "autotile_edge.webp")).convert("RGBA")
    ground = Image.open(os.path.join(ASSETS, "tile_grass.webp")).convert("RGBA")

    cols, rows = 24, 16
    sub = 64                    # 축소 타일 크기
    grid = make_room(cols, rows)

    # 1) 지면 TileSprite 상당 : ground 를 맵 전체에 반복
    W, H = cols * sub, rows * sub
    base = Image.new("RGBA", (W, H))
    gt = ground.resize((sub, sub), Image.NEAREST)
    for y in range(0, H, sub):
        for x in range(0, W, sub):
            base.paste(gt, (x, y))

    # 2) 경계 오버레이 합성 (WorldScene.drawGroundEdges 와 동일 규칙)
    over = base.copy()
    placed = masked = 0
    for r in range(rows):
        for c in range(cols):
            if not grid[r * cols + c]:
                continue
            m = open_mask_at(grid, cols, rows, c, r)
            masked += 1
            if m == 15:
                continue
            fr = m  # patternFor 는 0~15 항등
            fr_img = sheet.crop((fr % 4 * CELL, fr // 4 * CELL,
                                 fr % 4 * CELL + CELL, fr // 4 * CELL + CELL))
            fr_img = fr_img.resize((sub, sub), Image.NEAREST)
            over.alpha_composite(fr_img, (c * sub, r * sub))
            placed += 1

    out = "/root/.hermes/cache/scratch/deploy/autotile_sim.png"
    side = Image.new("RGB", (W * 2 + 12, H), (18, 18, 24))
    side.paste(base.convert("RGB"), (0, 0))
    side.paste(over.convert("RGB"), (W + 12, 0))
    side.save(out)

    # 3) 수치 검증: 경계 셀 평균 밝기 < 내부 셀
    def cell_lum(img, c, r):
        box = img.crop((c * sub, r * sub, (c + 1) * sub, (r + 1) * sub)).convert("L")
        px = list(box.getdata())
        return sum(px) / len(px)

    inner, edgev = [], []
    for r in range(rows):
        for c in range(cols):
            if not grid[r * cols + c]:
                continue
            m = open_mask_at(grid, cols, rows, c, r)
            (inner if m == 15 else edgev).append(cell_lum(over, c, r))

    print(f"open cells={sum(grid)}  masked={masked}  overlay placed={placed}")
    print(f"내부(mask=15) 셀 {len(inner)}개  평균밝기={sum(inner)/len(inner):.2f}")
    print(f"경계(mask<15) 셀 {len(edgev)}개  평균밝기={sum(edgev)/len(edgev):.2f}")
    delta = sum(inner)/len(inner) - sum(edgev)/len(edgev)
    print(f"경계가 내부보다 어두운 정도: {delta:+.2f}  -> {'OK (경계 형성)' if delta > 2 else 'FAIL (경계 안 보임)'}")
    print(f"saved {out}  ({side.size[0]}x{side.size[1]})")

    # 4) 마스크 분포
    from collections import Counter
    cnt = Counter()
    for r in range(rows):
        for c in range(cols):
            if grid[r * cols + c]:
                cnt[open_mask_at(grid, cols, rows, c, r)] += 1
    print("마스크 분포:", dict(sorted(cnt.items())))


if __name__ == "__main__":
    main()
