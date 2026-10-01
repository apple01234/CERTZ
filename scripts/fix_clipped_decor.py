# -*- coding: utf-8 -*-
"""
v3.0.10 지시 #3 — 잘린 데코 텍스처 수리
기존 redesign/build 스크립트들이 시트 격자에 안 맞는 crop 좌표를 써서
나무 아래 잘린 덤불이 붙고 바위는 반쪽 2개로 나오던 문제를 수정한다.

원칙:
- Serene Village 32px 시트: 반드시 32px 배수 좌표로 crop (트리 2x3셀=64x96, 바위 2x2셀=64x64)
- Zelda Overworld 16px 시트: 분수 48x64 = (352,144)-(400,208)
- 생성 후 알파 bbox가 캔버스 가장자리에 닿으면 인접 후보로 자동 재시도
- 틴트 변형(pine_snow 등)은 keep_lum 방식 그대로 재현
- 각 텍스처의 권장 충돌 박스(하단 밴드)를 측정해 보고 → WorldScene 수동 반영
"""
from PIL import Image
import os

ROOT = "/home/z/my-project"
A = f"{ROOT}/public/assets"
SER = f"{ROOT}/upload/extracted/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED/Serene_Village_32x32.png"
OW = f"{ROOT}/scripts/asset-sources/assets-src/zelda_gfx/gfx/Overworld.png"
OBJ = f"{ROOT}/scripts/asset-sources/assets-src/td_tmp/Tiles"  # build_assets.py의 OBJ 후보

report = []


def save(im: Image.Image, path: str) -> None:
    im.save(path)
    report.append(f"[save] {os.path.basename(path)} {im.size[0]}x{im.size[1]}")


def edge_touch(im: Image.Image) -> list:
    """알파 콘텐츠가 캔버스 가장자리에 닿는 변 목록 (짤림 신호)"""
    w, h = im.size
    a = im.getchannel("A")
    bbox = a.getbbox()
    if not bbox:
        return ["빈이미지"]
    x0, y0, x1, y1 = bbox
    out = []
    if x0 <= 0:
        out.append("좌")
    if y0 <= 0:
        out.append("상")
    if x1 >= w:
        out.append("우")
    if y1 >= h:
        out.append("하")
    return out


def alpha_bbox_body(im: Image.Image, band_h: int, pad: int = 2) -> tuple:
    """하단 band_h 픽셀 밴드에서 불투명 영역의 x범위를 측정 → (bodyW, bodyH, offX, offY)"""
    w, h = im.size
    a = im.getchannel("A")
    bbox = a.getbbox()
    if not bbox:
        return (20, 14, 22, 46)
    x0, y0, x1, y1 = bbox
    y_top = max(0, h - band_h)
    band = a.crop((0, y_top, w, h))
    bb = band.getbbox()
    if bb:
        bx0, _, bx1, _ = bb
    else:
        bx0, bx1 = 0, w
    bw = max(8, bx1 - bx0 - pad * 2)
    bh = max(8, band_h - pad)
    offx = max(0, bx0 + pad)
    offy = max(0, h - band_h + pad // 2)
    return (bw, bh, offx, offy)


def tint(im: Image.Image, rgb: tuple, keep_lum: bool = True) -> Image.Image:
    px = im.load()
    r0, g0, b0 = rgb
    for y in range(im.height):
        for x in range(im.width):
            pr, pg, pb, pa = px[x, y]
            if pa == 0:
                continue
            if keep_lum:
                lum = (pr + pg + pb) / 3 / 255
                nr = int(min(255, r0 * (0.45 + 0.75 * lum)))
                ng = int(min(255, g0 * (0.45 + 0.75 * lum)))
                nb = int(min(255, b0 * (0.45 + 0.75 * lum)))
            else:
                nr, ng, nb = pr * r0 // 255, pg * g0 // 255, pb * b0 // 255
            px[x, y] = (nr, ng, nb, pa)
    return im


def pick_clean_cell(sheet: Image.Image, cell: int, cands: list, cw: int, chh: int) -> Image.Image:
    """후보 셀 목록에서 가장자리에 안 닿는 첫 crop을 반환"""
    for (cx, cy) in cands:
        crop = sheet.crop((cx * cell, cy * cell, (cx + cw) * cell, (cy + chh) * cell))
        bad = edge_touch(crop)
        report.append(f"  시도 셀({cx},{cy}) {'x'.join(map(str, crop.size))} 닿는변={bad or '없음'}")
        if not bad:
            return crop
    # 전부 닿으면 가장 덜 닿은 첫 후보
    report.append("  경고: 모든 후보가 가장자리에 닿음 — 첫 후보 사용")
    return sheet.crop((cands[0][0] * cell, cands[0][1] * cell, (cands[0][0] + cw) * cell, (cands[0][1] + chh) * cell))


def main() -> None:
    ser = Image.open(SER).convert("RGBA")
    ow = Image.open(OW).convert("RGBA")

    # ── 1. 나무 (64x96 = 32px 셀 2x3) ──
    report.append("── tree (녹색 큰나무) ──")
    tree = pick_clean_cell(ser, 32, [(10, 18), (8, 18), (12, 18), (14, 18)], 2, 3)
    save(tree, f"{A}/tree.png")

    report.append("── pine (청록 큰나무) ──")
    pine = pick_clean_cell(ser, 32, [(10, 15), (8, 15), (12, 15), (14, 15)], 2, 3)
    save(pine, f"{A}/pine.png")

    # 눈/어둠 변형 — 청록 나무 기준 keep_lum 틴트 (원래 파이프라인 방식)
    save(tint(pine.copy(), (222, 238, 250)), f"{A}/pine_snow.png")
    save(tint(pine.copy(), (108, 96, 148)), f"{A}/pine_dark.png")

    # ── 2. 바위 (64x64 = 32px 셀 2x2) ──
    report.append("── rock (큰 바위) ──")
    rock = pick_clean_cell(ser, 32, [(0, 18), (2, 17), (0, 17)], 2, 2)
    save(rock, f"{A}/rock.png")
    save(tint(rock.copy(), (216, 230, 244)), f"{A}/rock_snow.png")
    save(tint(rock.copy(), (118, 104, 148)), f"{A}/rock_dark.png")
    save(tint(rock.copy(), (172, 162, 150)), f"{A}/rock_stone.png")

    # ── 3. 우물/분수 (Overworld 48x48 → 72x72, 96x96 캔버스 하단 정렬) ──
    report.append("── well (분수 48x48 재정렬) ──")
    # 실측: 분수 본체는 (352,144)-(400,192) 48x48, 그 아래(y192+)는 지붕 타일이 붙어 있음
    fnt = ow.crop((352, 144, 400, 192))
    bad = edge_touch(fnt)
    report.append(f"  48x48 crop 닿는변={bad or '없음'}")
    fnt = fnt.resize((72, 72), Image.NEAREST)
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    canvas.alpha_composite(fnt, ((96 - 72) // 2, 96 - 72))
    save(canvas, f"{A}/well.png")

    # ── 4. fragment(수정) — 현재 짤림 → 90% 축소 후 중앙 패딩으로 가장자리 이탈 제거 ──
    report.append("── fragment (수정 덩어리 축소 패딩) ──")
    frag = Image.open(f"{A}/fragment.png").convert("RGBA")
    small = frag.resize((28, 28), Image.NEAREST)
    canvas2 = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    canvas2.alpha_composite(small, (2, 2))
    save(canvas2, f"{A}/fragment.png")

    # ── 5. 충돌 박스 측정 보고 ──
    report.append("── 권장 충돌 박스 (setSize(w,h).setOffset(x,y)) ──")
    for name, band in (("tree", 24), ("pine", 24), ("pine_snow", 24), ("pine_dark", 24),
                       ("rock", 30), ("rock_snow", 30), ("rock_dark", 30), ("rock_stone", 30),
                       ("well", 40)):
        im = Image.open(f"{A}/{name}.png").convert("RGBA")
        bw, bh, ox, oy = alpha_bbox_body(im, band)
        report.append(f"  {name}: setSize({bw},{bh}).setOffset({ox},{oy})")

    print("\n".join(report))


if __name__ == "__main__":
    main()
