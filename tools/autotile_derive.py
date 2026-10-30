#!/usr/bin/env python3
"""
autotile_derive.py — RPG Maker MV 맵에서 "이웃 비트마스크 → 타일 패턴" 규칙을 실측 역산

왜 하는가
---------
SERTZ 는 지면을 단일 타일 반복(tileSprite)으로만 깐다. 그래서 길·물·벽 경계가
표현되지 않고 "같은 무늬 반복"으로 보인다. 유니티 타일 아틀라스식 오토타일이 없다.

RPG Maker MV 는 오토타일을 **타일 ID 하나에 48패턴**을 담고, 각 셀의
상/하/좌/우 이웃 존재 여부로 패턴을 고른다. 맵 JSON 만 있으면 그 선택 규칙을
실측으로 역산할 수 있다(맵은 이미 그 규칙으로 칠해져 있으므로).

출력
----
각 오토타일 블록에 대해 (이웃 마스크 → 패턴 인덱스) 표와, 규칙이 일관된 비율.
일관성이 높으면 "이 게임은 N비트 이웃 마스크 오토타일을 쓴다"가 확정된다.
"""
import json, sys, glob, os
from collections import defaultdict, Counter

BASE = 1536          # 첫 A 타일 ID (RPG Maker MV)
A_SPAN = 2048        # A1~A4 영역 크기 (48블록 x 48패턴)
PATTERNS = 48


def block_pattern(tid):
    """타일 ID -> (블록키, 패턴인덱스). A 영역이 아니면 None."""
    if not isinstance(tid, int) or tid < BASE:
        return None
    n = tid - BASE
    if n >= A_SPAN:
        return None
    i, p = divmod(n, PATTERNS)
    return i, p


def analyze(path):
    d = json.load(open(path))
    if not isinstance(d, dict):
        return None
    w, h = d.get('width'), d.get('height')
    data = d.get('data')
    if not w or not h or not isinstance(data, list):
        return None

    def cell(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return 0
        return data[y * w + x]

    # 셀 -> (블록, 패턴)
    grid = {}
    for y in range(h):
        for x in range(w):
            bp = block_pattern(cell(x, y))
            if bp:
                grid[(x, y)] = bp

    # 블록별 (이웃마스크 -> 패턴) 집계
    # 마스크 비트: 1=상, 2=하, 4=좌, 8=우 (같은 블록이 이웃에 있으면 1)
    per_block = defaultdict(lambda: defaultdict(Counter))
    for (x, y), (blk, pat) in grid.items():
        def same(nx, ny):
            nb = grid.get((nx, ny))
            return nb is not None and nb[0] == blk
        m = (1 if same(x, y - 1) else 0) | (2 if same(x, y + 1) else 0) | \
            (4 if same(x - 1, y) else 0) | (8 if same(x + 1, y) else 0)
        per_block[blk][m][pat] += 1

    return dict(map=os.path.basename(path), w=w, h=h, cells=len(grid),
                per_block=per_block)


def main():
    files = sys.argv[1:] or sorted(glob.glob('data/Map*.json'))
    agg = defaultdict(lambda: defaultdict(Counter))
    maps = 0
    for f in files:
        try:
            r = analyze(f)
        except Exception:
            continue
        if not r:
            continue
        maps += 1
        for blk, mc in r['per_block'].items():
            for m, pc in mc.items():
                agg[blk][m].update(pc)

    print(f"분석한 맵: {maps}\n")
    print("=== 블록별: 마스크 -> 대표 패턴 (일관성) ===")
    print(f"{'blk':>4s} {'mask':>5s} {'n':>5s} {'top':>5s} {'agree':>7s}  patterns")
    print('-' * 74)

    consistent_blocks = 0
    for blk in sorted(agg):
        total = sum(sum(c.values()) for c in agg[blk].values())
        deterministic = 0
        for m in sorted(agg[blk]):
            pc = agg[blk][m]
            n = sum(pc.values())
            top, topn = pc.most_common(1)[0]
            agree = topn / n
            if agree >= 0.9:
                deterministic += 1
            pats = ','.join(str(p) for p, _ in pc.most_common(4))
            print(f"{blk:>4d} {m:>5d} {n:>5d} {top:>5d} {agree:>6.0%}  {pats}")
        # 마스크 4개 이상이고 대부분 결정적이면 "오토타일 규칙 성립"
        if len(agg[blk]) >= 3 and deterministic >= len(agg[blk]) * 0.6:
            consistent_blocks += 1
        print()

    print(f"=== 결론 ===")
    print(f"오토타일 규칙이 성립하는 블록: {consistent_blocks} / {len(agg)}")
    print(f"관측된 마스크 값: {sorted({m for b in agg for m in agg[b]})}")
    print("마스크 1=상 2=하 4=좌 8=우 (같은 블록이 이웃에 존재)")


if __name__ == '__main__':
    main()
