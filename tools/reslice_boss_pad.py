#!/usr/bin/env python3
"""보스 아틀라스 재슬라이스 — 원본(bsw_*)에서 프레임 경계에 그림이 닿지 않게 다시 자른다.

문제
----
현재 배포본 일부는 프레임마다 캐릭터 하단(발)이 셀 경계에 정확히 닿아 있다.
실측: atl_boss_hati 는 하단 6줄이 알파 178~255 로 채워져 있다(색 RGB 80,102,134
= 캐릭터 몸통색). 즉 그림자가 아니라 몸이 잘린 것이다.

원인
----
원본 아트가 캐릭터를 프레임 하단에 붙여 그렸는데, 배포 시 격자를 균등 분할해
잘라내면서 발이 셀 밖으로 나갔다.

해법
----
원본의 실제 내용 바운딩박스를 측정해 **프레임마다 여백을 확보**해 재구성한다.
격자(열/행)는 원본 아트가 그려진 단위를 실측으로 찾아 쓴다.

사용
----
  python3 tools/reslice_boss_pad.py                 # 미리보기(변경 없음)
  python3 tools/reslice_boss_pad.py --apply         # 실제 적용
  python3 tools/reslice_boss_pad.py --only surt     # 특정 보스만
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
SRC = ROOT / "assets_src" / "boss_sheets"
TEXTURES = ROOT / "src" / "game" / "textures.ts"

# bsw 원본 파일명 → (출력 아틀라스 키, 열, 행)
#  열/행은 원본 아트의 실제 격자다. bsw_* 크기에서 내용 간격을 실측해 확정했다.
MAP = {
    "guardian":  ("boss",       11, 7),
    "abysslord": ("boss3",       8, 7),
    "behemoth":  ("boss2",      12, 7),
    "surt":      ("boss_surt",   6, 7),
    "nidhog":    ("boss_nidhog",11, 7),
    "nagr":      ("boss_nagr",  11, 7),
    "jorm":      ("boss_jorm",   6, 7),
}

PAD_X = 0.06   # 셀 폭 대비 좌우 여백
PAD_Y = 0.08   # 셀 높이 대비 상하 여백


def content_bbox(im: Image.Image):
    a = np.array(im.getchannel("A"))
    ys, xs = np.where(a > 16)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def slice_cell(im: Image.Image, cx: int, cy: int, cw: int, ch: int):
    """한 셀을 잘라 내용을 중앙에 재배치하고 여백을 넣는다."""
    W, H = im.size
    x0 = max(0, cx)
    y0 = max(0, cy)
    x1 = min(W, cx + cw)
    y1 = min(H, cy + ch)
    if x1 <= x0 or y1 <= y0:
        return None
    cell = im.crop((x0, y0, x1, y1))
    bb = content_bbox(cell)
    if bb is None:
        return Image.new("RGBA", (cw, ch), (0, 0, 0, 0))

    content = cell.crop(bb)
    padx = int(cw * PAD_X)
    pady = int(ch * PAD_Y)
    avail_w = cw - padx * 2
    avail_h = ch - pady * 2

    # 내용이 여백 안에 들어오도록 축소 (확대는 하지 않는다 — 원본 화질 보존)
    k = min(1.0, avail_w / content.width, avail_h / content.height)
    if k < 1.0:
        content = content.resize(
            (max(1, int(content.width * k)), max(1, int(content.height * k))),
            Image.LANCZOS,
        )

    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    out.paste(content, ((cw - content.width) // 2, (ch - content.height) // 2))
    return out


def build(src_name: str, apply: bool):
    out_key, cols, rows = MAP[src_name]
    src = SRC / f"bsw_{src_name}.webp"
    if not src.exists():
        return {"key": out_key, "ok": False, "err": f"원본 없음: {src.name}"}

    im = Image.open(src).convert("RGBA")
    W, H = im.size
    cw, ch = W // cols, H // rows

    sheet = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    empty = 0
    for r in range(rows):
        for c in range(cols):
            # 원본은 정확히 cols*fw 를 채우지 않을 수 있다 → 실제 좌표로 자른다
            cell = slice_cell(im, c * cw, r * ch, cw, ch)
            if cell is None:
                empty += 1
                continue
            if content_bbox(cell) is None:
                empty += 1
            sheet.paste(cell, (c * cw, r * ch))

    dst = ASSETS / f"atl_{out_key}.webp"
    if apply:
        sheet.save(dst, "WEBP", lossless=True, quality=100, method=4)

    return {"key": out_key, "ok": True, "size": sheet.size,
            "cell": (cw, ch), "cols": cols, "rows": rows,
            "empty": empty, "written": apply, "dst": dst.name}


def update_textures(results):
    src = TEXTURES.read_text(encoding="utf-8")
    orig = src
    for r in results:
        if not r.get("ok"):
            continue
        cols, rows = r["cols"], r["rows"]
        cw, ch = r["cell"]
        key = r["key"]
        # BOSS_ATLAS 항목
        pat = re.compile(
            r"^(\s*)" + re.escape(key) + r"(:\s*\{\s*key:\s*\"[^\"]*\",\s*"
            r"file:\s*\"[^\"]*\",\s*fw:\s*)\d+(,\s*fh:\s*)\d+"
            r"((?:,\s*cols:\s*)\d+)?(\s*\})",
            re.M,
        )
        m = pat.search(src)
        if m:
            line_start = src.rfind("\n", 0, m.start()) + 1
            line_end = src.find("\n", m.end())
            full = src[line_start:line_end]
            comment = " " + full[full.index("//"):] if "//" in full else ""
            new = (f'{m.group(1)}{key}:'.ljust(16) +
                   f'{{ key: "atl_{key}", file: "{r["dst"]}", '
                   f'fw: {cw}, fh: {ch}, cols: {cols} }}{comment}')
            src = src[:line_start] + new + src[line_end:]
        # BOSS_ATLAS_ROWS
        counts = ", ".join(str(cols) for _ in range(rows))
        pat2 = re.compile(r"^(\s*" + re.escape(key) + r":\s*\[)[^\]]*(\])", re.M)
        if pat2.search(src):
            src = pat2.sub(lambda mm: mm.group(1) + counts + mm.group(2), src, count=1)

    if src != orig:
        TEXTURES.write_text(src, encoding="utf-8")
        return True
    return False


def main():
    apply = "--apply" in sys.argv
    only = None
    if "--only" in sys.argv:
        i = sys.argv.index("--only")
        only = sys.argv[i + 1:]

    names = [n for n in MAP if (only is None or n in only)]
    results = []
    print(f"{'원본':12s} {'→ 아틀라스':16s} {'셀':>10s}  {'여백':>6s}  상태")
    print("-" * 72)
    for n in names:
        r = build(n, apply)
        results.append(r)
        if not r["ok"]:
            print(f"{n:12s} {'-':16s} {'-':>10s}  {'-':>6s}  ★ {r['err']}")
            continue
        print(f"{n:12s} → {r['key']:16s} {r['cell'][0]:4d}x{r['cell'][1]:<4d}  "
              f"{int(r['cell'][0]*PAD_X):3d}px  OK {r['size']} 빈칸 {r['empty']}")

    if apply:
        changed = update_textures(results)
        print("\ntextures.ts 갱신:", "완료" if changed else "변경 없음")
    else:
        print("\n(--apply 로 실제 기록)")


if __name__ == "__main__":
    main()
