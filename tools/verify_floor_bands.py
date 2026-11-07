#!/usr/bin/env python3
"""verify_floor_bands.py — P1b 지면 밴드 침범/미달 전수 측정

[왜 필요한가]
vc275 에서 지면/경로/구조물 레이어를 unit(28·32px) 격자 Tilemap 에서
**셀 크기로 클리핑한 TileSprite 밴드**로 교체했다. 이 스크립트는 그 교체가
"경로가 통로를 넘지도, 벽이 비지도 않는지"를 모든 authored 스테이지에서 픽셀 단위로
확인한다. `npm test` 의 floor-band-coverage 테스트가 셀 단위 계약을 지키지만,
이 스크립트는 **실제 그림**(픽셀)로 한 번 더 검증하고 before/after PNG 를 남긴다.

[사용법]
  # 1) 레이아웃 덤프 (Node)
  node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs \\
       tools/dump_authored_layouts.mjs > /tmp/layouts.json

  # 2) 측정 + 렌더
  python3 tools/verify_floor_bands.py /tmp/layouts.json

[출력]
  reports/p1b/{stage}_{role}.png          레이어별 렌더
  reports/p1b/{before,after}_{k}_view.png 카메라 배율 뷰 비교
  reports/p1b/summary.json                수치 요약
"""
import json
import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "reports/p1b")
os.makedirs(OUT, exist_ok=True)

# AuthoredMapLayers.AUTHORED_GROUND_SOURCES 와 동일해야 한다(tests/floor-tiles 가 강제).
SOURCES = {
    "ground_meadow": (256, 32), "ground_dirt": (84, 28), "ground_sand": (84, 28),
    "ground_forest": (96, 32), "ground_slate": (256, 32), "ground_ash": (256, 32),
    "ground_violet": (256, 32), "ground_cavern": (256, 32),
}

_src = {}


def load(key):
    if key not in _src:
        p = os.path.join(ROOT, "public/assets/ground", f"{key}.png")
        _src[key] = Image.open(p).convert("RGB")
    return _src[key]


def cells_across(n, unit, cell_size, limit):
    a = max(0, int(n * unit / cell_size))
    b = min(limit - 1, int(((n + 1) * unit - 1) / cell_size))
    return [a] if a > b else [a, b]


def render_legacy(key, width, height, open_g, paths, cols, rows, cellW, cellH, role):
    """vc275 이전 방식 — 타일 중심점이 속한 셀로 판정. before 측정용."""
    size, unit = SOURCES[key]
    source_cols = size // unit
    src = load(key)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    n_cols, n_rows = math.ceil(width / unit), math.ceil(height / unit)
    for r in range(n_rows):
        for c in range(n_cols):
            cx = min(cols - 1, math.floor((c + 0.5) * unit / cellW))
            cy = min(rows - 1, math.floor((r + 0.5) * unit / cellH))
            cell = cy * cols + cx
            if role != "ground":
                ok = bool(paths[cell]) if role == "paths" else not bool(open_g[cell])
                if not ok:
                    continue
            idx = (r % source_cols) * source_cols + (c % source_cols)
            sx, sy = (idx % source_cols) * unit, (idx // source_cols) * unit
            x0, y0 = c * unit, r * unit
            w, h = min(unit, width - x0), min(unit, height - y0)
            if w > 0 and h > 0:
                canvas.paste(src.crop((sx, sy, sx + w, sy + h)), (x0, y0))
    return canvas


def render_bands(key, width, height, open_g, paths, cols, rows, cellW, cellH, role):
    """vc275 최종 — 칠할 셀을 행 단위로 병합하고 셀 크기로 클리핑해 반복."""
    src = load(key)
    sw, sh = src.size
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for r in range(rows):
        y0, y1 = round(r * cellH), round((r + 1) * cellH)
        run = -1
        for c in range(cols + 1):
            if c < cols:
                cell = r * cols + c
                on = True if role == "ground" else (
                    bool(paths[cell]) if role == "paths" else not bool(open_g[cell]))
            else:
                on = False
            if on and run < 0:
                run = c
            if not on and run >= 0:
                x0, x1 = round(run * cellW), round(c * cellW)
                for ty in range(y0, y1, sh):
                    for tx in range(x0, x1, sw):
                        w, h = min(sw, x1 - tx), min(sh, y1 - ty)
                        canvas.paste(src.crop((0, 0, w, h)), (tx, ty))
                run = -1
    return canvas


def role_mask(role, width, height, open_g, paths, cols, rows, cellW, cellH):
    mask = bytearray(width * height)
    for r in range(rows):
        y0, y1 = round(r * cellH), round((r + 1) * cellH)
        for c in range(cols):
            cell = r * cols + c
            want = True if role == "ground" else (
                bool(paths[cell]) if role == "paths" else not bool(open_g[cell]))
            if not want:
                continue
            x0, x1 = round(c * cellW), round((c + 1) * cellW)
            for y in range(y0, min(y1, height)):
                base = y * width
                for x in range(x0, min(x1, width)):
                    mask[base + x] = 1
    return mask


def score(layer, mask, width, height):
    px = layer.load()
    bleed = miss = 0
    for y in range(height):
        base = y * width
        for x in range(width):
            filled = px[x, y][3] > 0
            want = mask[base + x] == 1
            if filled and not want:
                bleed += 1
            elif want and not filled:
                miss += 1
    return bleed, miss


def compose(d, mode):
    fn = render_legacy if mode == "legacy" else render_bands
    imgs = []
    for role, key in (("ground", d["authored"]["ground"]),
                      ("paths", d["authored"]["path"]),
                      ("structures", d["authored"]["structure"])):
        imgs.append(fn(key, d["w"], d["h"], d["open"], d["paths"],
                       d["cols"], d["rows"], d["cellW"], d["cellH"], role))
    out = imgs[0].convert("RGB")
    out.paste(imgs[1], (0, 0), imgs[1])
    out.paste(imgs[2], (0, 0), imgs[2])
    return out


def view_zoom(h_css=1080):
    """PhaserGame.viewZoom 과 동일."""
    return min(2.5, max(1.0, round((h_css / 560) * 4) / 4))


def crop_view(img, cx, cy, vw=1920, vh=1080):
    z = view_zoom(vh)
    ww, wh = vw / z, vh / z
    W, H = img.size
    x0 = max(0, min(W - ww, cx - ww / 2))
    y0 = max(0, min(H - wh, cy - wh / 2))
    return img.crop((int(x0), int(y0), int(min(W, x0 + ww)), int(min(H, y0 + wh)))
                    ).resize((vw, vh), Image.NEAREST)


def wall_target(d):
    """벽에 접한 통로 셀 — 경계 결함이 가장 잘 보이는 지점."""
    cols, rows, cw, ch = d["cols"], d["rows"], d["cellW"], d["cellH"]
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            if d["open"][r * cols + c] and not d["open"][r * cols + c + 1]:
                return ((c + 1) * cw, (r + 0.5) * ch)
    return (d["w"] / 2, d["h"] / 2)


def main():
    dump = json.load(open(sys.argv[1]))
    summary = []
    print(f"{'stage':16}{'role':11}{'before bleed':>13}{'before miss':>12}"
          f"{'after bleed':>12}{'after miss':>11}")
    for d in dump:
        w, h = d["w"], d["h"]
        cols, rows, cw, ch = d["cols"], d["rows"], d["cellW"], d["cellH"]
        rec = {"stage": d["key"], "roles": {}}
        for role, key in (("ground", d["authored"]["ground"]),
                          ("paths", d["authored"]["path"]),
                          ("structures", d["authored"]["structure"])):
            mask = role_mask(role, w, h, d["open"], d["paths"], cols, rows, cw, ch)
            bb, bm = score(render_legacy(key, w, h, d["open"], d["paths"], cols, rows, cw, ch, role),
                           mask, w, h)
            ab, am = score(render_bands(key, w, h, d["open"], d["paths"], cols, rows, cw, ch, role),
                           mask, w, h)
            print(f"{d['key']:16}{role:11}{bb:>13}{bm:>12}{ab:>12}{am:>11}")
            rec["roles"][role] = {"before": {"bleed": bb, "miss": bm},
                                  "after": {"bleed": ab, "miss": am}}
        target = wall_target(d)
        for mode in ("legacy", "bands"):
            tag = "before" if mode == "legacy" else "after"
            img = compose(d, mode)
            crop_view(img, *target).save(os.path.join(OUT, f"{tag}_{d['key']}_view.png"))
            img.save(os.path.join(OUT, f"{tag}_{d['key']}_full.png"))
        summary.append(rec)
        print()
    json.dump(summary, open(os.path.join(OUT, "summary.json"), "w"), indent=1)
    tb = sum(r["roles"]["paths"]["after"]["bleed"] + r["roles"]["ground"]["after"]["bleed"]
             + r["roles"]["structures"]["after"]["bleed"] for r in summary)
    tm = sum(r["roles"]["paths"]["after"]["miss"] + r["roles"]["ground"]["after"]["miss"]
             + r["roles"]["structures"]["after"]["miss"] for r in summary)
    print(f"after 총계 — bleed {tb} / miss {tm}")


if __name__ == "__main__":
    main()
