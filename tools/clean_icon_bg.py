#!/usr/bin/env python3
"""UI 아이콘에서 불필요한 사각 배경을 제거한다.

문제
----
RPG Icons 팩 일부 아이콘은 투명 PNG 지만 **이미지 전체가 불투명한 사각
배경 위에 그려져** 있다(불투명 비율 1.00). 이걸 20px HUD 아이콘으로 쓰면
배경 사각형이 그대로 보여 '검은 사각형'처럼 렌더된다.

해결
----
가장자리에서 flood fill 로 배경색을 찾아 알파 0으로 만든다. 중심에서 시작해
같은 색으로 이어진 영역만 지우므로 아이콘 내부의 같은 색(예: 검은 외곽선
안쪽)은 보존된다. 이후 아이콘 실체 영역만 잘라 정사각으로 다시 중앙 정렬한다.

사용
----
  python3 tools/clean_icon_bg.py --dry-run
  python3 tools/clean_icon_bg.py --apply
"""
import argparse
import glob
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(ROOT, "public", "assets", "ui")


def flood_bg(im: Image.Image, tol: int = 24) -> Image.Image:
    """가장자리와 이어진 배경색을 알파 0으로."""
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    alpha = a[:, :, 3]

    # 네 모서리 픽셀을 배경 후보로 삼아 중앙값 사용
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
    bg = np.median(corners, axis=0)

    # 배경과 비슷한 픽셀
    dist = np.abs(rgb - bg).sum(axis=2)
    similar = (dist <= tol) & (alpha > 8)

    # 가장자리에서 시작하는 flood fill (4-이웃)
    visited = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and similar[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    out = a.copy()
    out[:, :, 3] = np.where(visited, 0, a[:, :, 3])
    return Image.fromarray(out, "RGBA")


def trim_square(im: Image.Image, size: int) -> Image.Image:
    """불투명 영역만 잘라 정사각 중앙 정렬."""
    a = np.array(im.getchannel("A"))
    ys, xs = np.where(a > 16)
    if ys.size == 0:
        return im.resize((size, size), Image.NEAREST)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = im.crop((x0, y0, x1, y1))
    # 여백 6% 를 남기고 정사각으로 맞춘 뒤 확대
    side = max(crop.width, crop.height)
    pad = int(side * 0.06)
    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    canvas.paste(crop, ((canvas.width - crop.width) // 2,
                        (canvas.height - crop.height) // 2))
    return canvas.resize((size, size), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--size", type=int, default=64)
    ap.add_argument("--tol", type=int, default=24)
    args = ap.parse_args()

    fs = sorted(glob.glob(os.path.join(UI, "ui_*.webp")))
    print(f"{'아이콘':16s} {'전 불투명':>8s} {'후':>6s}")
    print("-" * 34)
    fixed = 0
    for f in fs:
        im = Image.open(f).convert("RGBA")
        before = float((np.array(im.getchannel("A")) > 16).mean())
        out = flood_bg(im, args.tol)
        after = float((np.array(out.getchannel("A")) > 16).mean())
        mark = ""
        if before > 0.92:
            out2 = trim_square(out, args.size)
            after2 = float((np.array(out2.getchannel("A")) > 16).mean())
            mark = f"  → 사각 제거 {after2:.2f}"
            if args.apply:
                out2.save(f, "WEBP", quality=95, method=4)
            fixed += 1
        elif args.apply:
            out.save(f, "WEBP", quality=95, method=4)
        print(f"{os.path.basename(f)[:-5]:16s} {before:8.2f} {after:6.2f}{mark}")
    print("-" * 34)
    print(f"사각 배경 제거: {fixed}개 / {'적용' if args.apply else '(--apply 로 실행)'}")


if __name__ == "__main__":
    sys.exit(main())
