#!/usr/bin/env python3
"""배경 제거 개선판 — 그라데이션·노이즈 배경도 지운다.

[기존 pixelize_portrait.remove_background 의 한계]
  코너 1점의 색을 기준으로 tol=26 만 허용했다. AI 생성 배경은
  · 미세한 그라데이션(가장자리→중심으로 밝아짐)
  · 압축 노이즈
  · 캐릭터 뒤 광원(후광·빛무리)
때문에 허용 오차를 벗어난 배경이 남아 **사각형 테두리**가 보였다
(실측 7/21건 실패: cartel, iris, ran + 컨택트시트 판정 3·4·11·13·18·19).

[개선]
  ① 코너 4점 + 상단/하단 가장자리 다점 샘플로 배경색 범위를 넓게 잡는다.
  ② tol 을 26 → 52 로 (색 차이의 유클리드 거리 기준).
  ③ **가장자리 연결** 플러드필은 유지 — 캐릭터 내부의 같은 색은 지우지 않는다.
  ④ 마지막에 **테두리 1px 링 검사**: 남은 불투명 픽셀이 프레임을 따라
     한 줄로 이어져 있으면 그 줄만 추가로 지운다(사각형 잔여 제거).
  ⑤ 후광 등 캐릭터에 붙은 밝은 영역은 보존 — 알파 0 픽셀과 4-이웃으로
     연결된 영역만 지우므로 실루엣 내부는 안전하다.

사용: python3 scripts/fix_portrait_bg.py [--all]
"""
import argparse
import glob
import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "public/assets/npcportrait/_raw")
OUT = os.path.join(ROOT, "public/assets/npcportrait")
SIZE, DOTS, COLORS = 84, 84, 40


def bg_range(im):
    """**모서리 4점만** 표본으로 쓴다.

    [왜 가장자리 다점이 실패했나 — 실측]
      상/하/좌/우 중앙점을 표본에 넣었더니 lilac 원본에서 `bot-mid = (113,97,103)` 이
      잡혔다. 캐릭터(드레스)가 하단 중앙에 닿아 있어 **캐릭터 색이 배경색으로 등록**됐고,
      범위가 `lo(1,4,26) ~ hi(186,162,181)` 로 벌어져 배경이 거의 지워지지 않았다
      (21개 전부 불투명 100%).
    → 배경은 항상 **모서리**에서 시작한다. 모서리 4점 + 아주 가까운 안쪽 점만 쓴다.
      가장자리 중앙은 캐릭터가 닿을 수 있으므로 쓰지 않는다."""
    w, h = im.size
    px = im.load()
    inset = max(1, min(w, h) // 100)      # 1% 안쪽 — 테두리 아티팩트 회피
    corners = [
        px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1],
        px[inset, inset], px[w - 1 - inset, inset],
        px[inset, h - 1 - inset], px[w - 1 - inset, h - 1 - inset],
    ]
    samples = [c[:3] for c in corners if c[3] > 8]
    if not samples:
        return (0, 0, 0), (0, 0, 0)
    lo = tuple(min(s[i] for s in samples) for i in range(3))
    hi = tuple(max(s[i] for s in samples) for i in range(3))
    return lo, hi


def remove_bg(im, tol=52):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    lo, hi = bg_range(im)
    # 배경 범위를 tol 만큼 확장
    lo = tuple(max(0, c - tol) for c in lo)
    hi = tuple(min(255, c + tol) for c in hi)

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        if a < 8:
            return True
        return lo[0] <= r <= hi[0] and lo[1] <= g <= hi[1] and lo[2] <= b <= hi[2]

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_bg(x, y):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))
    return im


def strip_frame(im, max_run=2):
    """프레임을 따라 남은 불투명 픽셀 줄을 지운다(사각형 테두리 제거).

    [왜 필요한가] 캐릭터가 가장자리에 닿아 있으면 플러드필이 그 뒤 배경을
    지우지 못하고 1~2px 테두리가 남는다(실측: 사각 배경 잔여).
    테두리에서 **연속 2px 이하**로 이어진 불투명 구간만 지우므로
    캐릭터 본체(넓게 이어진 영역)는 보존된다."""
    px = im.load()
    w, h = im.size

    def clear_run(coords):
        for (x, y) in coords:
            px[x, y] = (0, 0, 0, 0)

    for y in (0, 1, h - 2, h - 1):
        run = []
        for x in range(w):
            if px[x, y][3] > 0:
                run.append((x, y))
            else:
                if 0 < len(run) <= max_run:
                    clear_run(run)
                run = []
        if 0 < len(run) <= max_run:
            clear_run(run)
    for x in (0, 1, w - 2, w - 1):
        run = []
        for y in range(h):
            if px[x, y][3] > 0:
                run.append((x, y))
            else:
                if 0 < len(run) <= max_run:
                    clear_run(run)
                run = []
        if 0 < len(run) <= max_run:
            clear_run(run)
    return im


def pipeline(raw_path, dst, dots=DOTS, colors=COLORS, size=SIZE):
    im = Image.open(raw_path).convert("RGBA")
    im = remove_bg(im)
    small = im.resize((dots, dots), Image.LANCZOS)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    small = rgb.convert("RGBA")
    small.putalpha(alpha)
    sp = small.load()
    for y in range(dots):
        for x in range(dots):
            r, g, b, a = sp[x, y]
            sp[x, y] = (0, 0, 0, 0) if a < 96 else (r, g, b, 255)
    # 다운스케일 후에도 테두리 잔여를 한 번 더 정리
    small = strip_frame(small, max_run=3)
    out = small.resize((size, size), Image.NEAREST)
    out.save(dst)

    a = out.split()[3]
    opaque = sum(1 for v in a.get_flattened_data()) / (size * size)
    return opaque


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="전부 다시 처리")
    ap.add_argument("--keys", default="", help="쉼표 구분 키만")
    a = ap.parse_args()

    keys = [k.strip() for k in a.keys.split(",") if k.strip()]
    raws = sorted(glob.glob(os.path.join(RAW, "npc_*_raw.png")))
    if not raws:
        print("raw 파일이 없습니다 — build_portraits.py 를 먼저 실행하세요")
        return

    for r in raws:
        key = os.path.basename(r).replace("npc_", "").replace("_raw.png", "")
        dst = os.path.join(OUT, f"npc_{key}.png")
        if keys and key not in keys:
            continue
        if not a.all and not keys and os.path.exists(dst):
            # 기존 파일의 불투명도가 1.0(배경 잔여)이면 재처리
            try:
                img = Image.open(dst).convert("RGBA")
                op = sum(1 for v in img.split()[3].get_flattened_data()) / (img.width * img.height)
                if op < 0.97:
                    continue
            except Exception:
                pass
        op = pipeline(r, dst)
        flag = " ⚠ 배경잔여" if op >= 0.97 else ""
        print(f"  {key:12s} opaque={op:.1%}{flag}")


if __name__ == "__main__":
    main()
