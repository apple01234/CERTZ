#!/usr/bin/env python3
"""
import_portraits_20261109.py — 2026-11-09 Drive 초상화 배급분을 SERTZ 대화 초상화로 변환

[배급분 구조]
  41개 PNG, 각 **1024×1024 = 2×2 그리드**(사분면당 초상화 1개)
  → 최대 164개 초상화. 배경은 순백/불투명(alpha 전부 255).

[SERTZ 초상화 규격 — 실측]
  `public/assets/npcportrait/*.png` = **84×84 RGBA**, 투명 배경(~46%),
  `_map.json` 매니페스트에 {src, source, crop, sha256}.

[변환 규칙]
  1) 1024² 를 512² 사분면 4개로 분할
  2) 흰 배경 → 투명 (flood-fill 아님, 경계 임계값 기반. 캐릭터 내부 흰색 보존)
  3) 인물 bbox 검출 → 84×84 캔버스에 **하단 중앙 정렬**(대화창 피벗과 동일 규칙)
  4) 인물이 84px 넘으면 축소, 작으면 확대 금지(도트/붓터치 보존)
  5) RGBA PNG 출력 (초상화는 webp 미사용 — 기존 규격 유지)

[이름 규칙]
  dxp_<파일번호2><사분면>  예: dxp_00tl, dxp_00tr, dxp_00bl, dxp_00br
  파일번호는 정렬 순서(00..40)로 고정해 재실행 시 동일 이름이 나온다.
"""
import os
import sys
import json
import glob
import hashlib
from PIL import Image, ImageDraw

SRC = "/root/workspace/portraits_drop/pack/images"
DST = "/root/workspace/CERTZ/public/assets/npcportrait"
CELL = 84
QUAD = 512

# 배경 판정 임계값 — 이 이상 밝으면 배경으로 본다.
# 픽셀아트 외곽선은 어두우므로 240 이면 캐릭터 경계를 보존한다.
WHITE_T = 240
# 사분면 가장자리에서 이 비율 이상이 배경색이면 '배경에 닿은' 것으로 보고 테두리 flood-fill
BORDER_EPS = 0.02


def strip_white(im: Image.Image) -> Image.Image:
    """흰 배경을 투명으로. 테두리에서 연결된 흰 영역만 지워 캐릭터 내부 흰색은 보존."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    # 테두리에서 시작하는 flood-fill (BFS). 내부 흰색(눈동자 하이라이트 등)은 남긴다.
    from collections import deque

    def is_bg(p):
        r, g, b, a = p
        return a > 8 and r >= WHITE_T and g >= WHITE_T and b >= WHITE_T

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(px[x, y]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(px[x, y]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not seen[idx] and is_bg(px[nx, ny]):
                    seen[idx] = 1
                    q.append((nx, ny))
    return im


def fit_cell(im: Image.Image, cell=CELL) -> Image.Image | None:
    """인물 bbox → cell 캔버스 하단 중앙 정렬. 콘텐츠 없으면 None."""
    bb = im.getbbox()
    if not bb:
        return None
    char = im.crop(bb)
    cw, ch = char.size
    # 너무 작은 조각(노이즈)은 버린다
    if cw < 24 or ch < 24:
        return None
    scale = min(1.0, (cell - 2) / max(cw, ch))
    if scale < 1.0:
        char = char.resize((max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))),
                           Image.LANCZOS)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    x = (cell - char.size[0]) // 2
    y = cell - char.size[1]
    out.alpha_composite(char, (x, y))
    return out


def main(dry=False):
    files = sorted(glob.glob(os.path.join(SRC, "*.png")))
    report = []
    made = 0
    for fi, f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        if im.size != (QUAD * 2, QUAD * 2):
            print(f"  ! {os.path.basename(f)} 크기 이상 {im.size} — 건너뜀")
            continue
        for qi, (suffix, box) in enumerate([
            ("tl", (0, 0, QUAD, QUAD)),
            ("tr", (QUAD, 0, QUAD * 2, QUAD)),
            ("bl", (0, QUAD, QUAD, QUAD * 2)),
            ("br", (QUAD, QUAD, QUAD * 2, QUAD * 2)),
        ]):
            quad = im.crop(box)
            clean = strip_white(quad)
            cell = fit_cell(clean)
            if cell is None:
                report.append({"name": f"dxp_{fi:02d}{suffix}", "skip": "빈 사분면"})
                continue
            name = f"dxp_{fi:02d}{suffix}"
            outp = os.path.join(DST, name + ".png")
            if not dry:
                cell.save(outp, "PNG")
            made += 1
            report.append({
                "name": name,
                "src": os.path.basename(f),
                "quad": suffix,
                "file": name + ".png",
            })
    print(f"{'생성' if not dry else '예정'} {made}개 / 파일 {len(files)}개")
    if not dry:
        with open("/root/workspace/CERTZ/tools/_portrait_20261109_report.json", "w") as fp:
            json.dump(report, fp, ensure_ascii=False, indent=1)
    return report


if __name__ == "__main__":
    main(dry="--dry" in sys.argv)
