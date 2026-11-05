#!/usr/bin/env python3
"""AI 생성 초상화 → 진짜 픽셀아트 초상화 변환.

[문제]
  gpt_image_2 는 "pixel art" 프롬프트에도 **픽셀 흉내를 낸 고해상도 그림**을 낸다
  (1024×1024, 부드러운 안티앨리어싱). 그대로 쓰면 게임의 다른 도트 에셋과 이질감이 난다.

[해결]
  ① 배경 제거(가장자리 플러드필 — 테두리와 이어진 배경색만 지운다. 머리카락 사이는 보존)
  ② 다운스케일 — 목표 도트 해상도로 줄여 실제 픽셀 격자를 만든다
  ③ 팔레트 양자화 — 색을 N개로 제한(도트 특유의 색 단계)
  ④ 다시 확대(NEAREST) — 게임이 쓰는 84×84 초상화 크기로
  ⑤ 알파 보존 — 투명 배경 유지

[왜 다운스케일 후 양자화인가]
  순서를 반대로 하면(양자화 → 다운스케일) 색이 뭉개져 다시 그라데이션이 생긴다.
  먼저 줄이면 각 픽셀이 하나의 색을 갖게 되고, 그 뒤 색 수를 줄이면
  도트 특유의 단계가 남는다.

사용:
  python3 scripts/pixelize_portrait.py <입력.png> <출력.png> [--size 84] [--dots 56] [--colors 24]
"""
import argparse
import os
import sys
from collections import deque

from PIL import Image


def remove_background(im: Image.Image, tol: int = 26) -> Image.Image:
    """가장자리에서 시작하는 플러드필로 배경만 지운다.

    [왜 플러드필인가]
      단순 색 매칭은 캐릭터 안의 같은 색(목걸이·의상)까지 지워 버린다.
      테두리와 **연결된** 영역만 지우면 배경은 지워지고 내부는 남는다.

    [왜 허용 오차가 필요한가]
      AI 생성 배경은 단색이 아니라 미세한 그라데이션·압축 노이즈가 있다.
      허용 오차 없이는 배경이 조금씩 남아 지저분한 테두리가 된다.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    # 모서리 4점의 중앙값을 배경색으로 추정 (한 점이 튀는 것을 방지)
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sorted(c[0] for c in corners)[len(corners) // 2]
    bg = sorted(c[1] for c in corners)[len(corners) // 2]
    bb = sorted(c[2] for c in corners)[len(corners) // 2]

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        if a < 8:
            return True
        return abs(r - br) <= tol and abs(g - bg) <= tol and abs(b - bb) <= tol

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


def remove_background_local(im: Image.Image, local_tol: int = 8, global_tol: int = 60) -> Image.Image:
    """부모 픽셀과의 국소 색차로 전파하는 플러드필.

    [왜 국소 색차인가]
      고정 허용오차(remove_background)는 배경과 캐릭터 색이 가까운 경우
      (검은 갑옷 + 남색 배경) 둘 중 하나를 포기해야 한다. 허용오차를 줄이면
      배경 테두리가 남고, 늘리면 갑옷에 구멍이 뚫린다.
      국소 색차는 "이웃과 색이 거의 같으면 계속 전파"하므로 배경의 완만한
      그라데이션은 끝까지 따라가고, 색 단차가 큰 캐릭터 경계에서 멈춘다.

    [global_tol 의 역할]
      배경색에서 너무 멀리 떨어진 픽셀은 국소 차이가 작아도 지우지 않는다.
      (배경 그라데이션이 캐릭터 내부까지 새어 들어가는 것을 막는 안전장치)
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sorted(c[0] for c in corners)[len(corners) // 2]
    bg = sorted(c[1] for c in corners)[len(corners) // 2]
    bb = sorted(c[2] for c in corners)[len(corners) // 2]
    bgc = (br, bg, bb)

    def dist(c1, c2):
        return abs(c1[0] - c2[0]) + abs(c1[1] - c2[1]) + abs(c1[2] - c2[2])

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0, bgc)); q.append((x, h - 1, bgc))
    for y in range(h):
        q.append((0, y, bgc)); q.append((w - 1, y, bgc))

    while q:
        x, y, parent = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        c = px[x, y]
        if c[3] < 8 or (dist(c, bgc) <= global_tol and dist(c, parent) <= local_tol):
            seen[i] = 1
            px[x, y] = (0, 0, 0, 0)
            cur = (c[0], c[1], c[2])
            q.append((x + 1, y, cur)); q.append((x - 1, y, cur))
            q.append((x, y + 1, cur)); q.append((x, y - 1, cur))
    return im


def despeckle(im: Image.Image, min_px: int = 10) -> Image.Image:
    """본체에서 떨어진 고립 픽셀 덩어리를 지운다.

    [왜 필요한가]
      배경 제거 후 안티앨리어싱 잔여물이 1~5px 점으로 남는다. 84px 초상화에서
      이 점들은 눈에 띄게 지저분하다. 가장 큰 연결요소(캐릭터)만 남기고
      min_px 미만 덩어리를 제거한다.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if px[sx, sy][3] == 0 or seen[sy * w + sx]:
                continue
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(cells)
    if len(comps) <= 1:
        return im
    comps.sort(key=len, reverse=True)
    for cells in comps[1:]:
        if len(cells) < min_px:
            for (x, y) in cells:
                px[x, y] = (0, 0, 0, 0)
    return im


def pixelize(src: str, dst: str, size: int = 84, dots: int = 56, colors: int = 24,
             keep_bg: bool = False, local_diff: bool = False, min_speck: int = 10) -> dict:
    im = Image.open(src).convert("RGBA")
    orig = im.size

    if not keep_bg:
        if local_diff:
            im = remove_background_local(im)
        else:
            im = remove_background(im)

    # ② 다운스케일 — 여기서 실제 픽셀 격자가 생긴다
    small = im.resize((dots, dots), Image.LANCZOS)

    # ③ 팔레트 양자화 (알파는 따로 보존)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    small = rgb.convert("RGBA")
    small.putalpha(alpha)

    # 양자화가 알파 0 픽셀의 색을 뭉개므로 다시 0 으로
    sp = small.load()
    for y in range(dots):
        for x in range(dots):
            r, g, b, a = sp[x, y]
            sp[x, y] = (0, 0, 0, 0) if a < 96 else (r, g, b, 255)

    # ④ 게임 규격으로 확대 — NEAREST 라 격자가 유지된다
    out = small.resize((size, size), Image.NEAREST)
    out = despeckle(out, min_px=min_speck)

    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    out.save(dst)

    # 통계 — 품질 판정용
    op = out.convert("RGBA").load()
    opaque = 0
    uniq = set()
    for y in range(size):
        for x in range(size):
            r, g, b, a = op[x, y]
            if a > 0:
                opaque += 1
                uniq.add((r, g, b))
    return {
        "src": src, "dst": dst, "orig": orig, "size": size, "dots": dots,
        "colors": len(uniq), "opaque_ratio": round(opaque / (size * size), 3),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", type=int, default=84, help="출력 크기(게임 초상화 규격 84)")
    ap.add_argument("--dots", type=int, default=56, help="목표 도트 해상도")
    ap.add_argument("--colors", type=int, default=24, help="팔레트 색 수")
    ap.add_argument("--keep-bg", action="store_true", help="배경 제거를 하지 않는다")
    ap.add_argument("--local-diff", action="store_true",
                    help="국소 색차 플러드필 사용(어두운 캐릭터 + 어두운 배경에 필요)")
    ap.add_argument("--min-speck", type=int, default=10, help="제거할 고립 픽셀 덩어리 상한")
    a = ap.parse_args()
    st = pixelize(a.src, a.dst, a.size, a.dots, a.colors, a.keep_bg, a.local_diff, a.min_speck)
    print(f"{st['dst']}: {st['orig']} → {st['size']}×{st['size']} "
          f"(도트 {st['dots']}, 색 {st['colors']}, 불투명 {st['opaque_ratio']:.0%})")


if __name__ == "__main__":
    main()
