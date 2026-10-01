# -*- coding: utf-8 -*-
"""
v3.0.10 지시 #3 후속 2차 — Serene 시트의 나무 줄에서 개별 나무 추출.
나무들은 뿌리가 이어져 하나의 연결 요소이므로,
1) 나무 영역(x>=288, y>=290)에서 행 프로파일로 나무 줄(y밴드) 검출
2) 각 줄에서 열 프로파일 갭(빈 열)으로 나무 1그루씩 분할
3) 색조(hue)로 초록 나무(tree) / 청록 나무(pine) 선택
4) 64x96 캔버스 하단 중앙 배치 (margin 2) + tint 변형 재생성
"""
from PIL import Image
import colorsys
from collections import deque

ROOT = "/home/z/my-project"
A = f"{ROOT}/public/assets"
SER = f"{ROOT}/upload/extracted/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED/Serene_Village_32x32.png"
TREE_MIN_W, TREE_MAX_W = 40, 78
TREE_MIN_H = 70


def tint(im: Image.Image, rgb: tuple) -> Image.Image:
    px = im.load()
    r0, g0, b0 = rgb
    for y in range(im.height):
        for x in range(im.width):
            pr, pg, pb, pa = px[x, y]
            if pa == 0:
                continue
            lum = (pr + pg + pb) / 3 / 255
            nr = int(min(255, r0 * (0.45 + 0.75 * lum)))
            ng = int(min(255, g0 * (0.45 + 0.75 * lum)))
            nb = int(min(255, b0 * (0.45 + 0.75 * lum)))
            px[x, y] = (nr, ng, nb, pa)
    return im


def split_rows(mask, x0, x1, y0, y1, min_gap=3, min_run=40):
    """밴드에서 행 프로파일(각 y의 알파 열 수) → 빈 갭으로 y밴드 분할"""
    rows = []
    run_start = None
    gap = 0
    for y in range(y0, y1):
        cnt = sum(1 for x in range(x0, x1) if mask[y][x])
        if cnt > 0:
            if run_start is None:
                run_start = y
            gap = 0
        else:
            if run_start is not None:
                gap += 1
                if gap >= min_gap:
                    if y - gap - run_start + 1 >= min_run:
                        rows.append((run_start, y - gap + 1))
                    run_start = None
                    gap = 0
    if run_start is not None and y1 - run_start >= min_run:
        rows.append((run_start, y1))
    return rows


def split_cols(mask, x0, x1, ry0, ry1, min_gap=2, min_w=TREE_MIN_W):
    """y밴드에서 열 프로파일 → 빈 갭으로 x구간(나무 1그루) 분할"""
    cols = []
    run_start = None
    gap = 0
    for x in range(x0, x1):
        cnt = sum(1 for y in range(ry0, ry1) if mask[y][x])
        if cnt > 0:
            if run_start is None:
                run_start = x
            gap = 0
        else:
            if run_start is not None:
                gap += 1
                if gap >= min_gap:
                    if x - gap - run_start + 1 >= min_w:
                        cols.append((run_start, x - gap + 1))
                    run_start = None
                    gap = 0
    if run_start is not None and x1 - run_start >= min_w:
        cols.append((run_start, x1))
    return cols


def dominant_hue(im: Image.Image) -> float:
    """불투명 픽셀 RGB 평균 hue (0~360)"""
    r = g = b = n = 0
    px = im.load()
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            pr, pg, pb, pa = px[x, y]
            if pa > 60:
                r += pr; g += pg; b += pb; n += 1
    if n == 0:
        return 0
    h, s, v = colorsys.rgb_to_hsv(r / n / 255, g / n / 255, b / n / 255)
    return h * 360


def edge_touch(im: Image.Image) -> list:
    w, h = im.size
    b = im.getchannel("A").getbbox()
    if not b:
        return ["빈이미지"]
    out = []
    if b[0] <= 0: out.append("좌")
    if b[1] <= 0: out.append("상")
    if b[2] >= w: out.append("우")
    if b[3] >= h: out.append("하")
    return out


def place_on_canvas(crop: Image.Image, cw: int, ch: int, margin: int = 2) -> Image.Image:
    # 실제 알파 bbox로 먼저 잘라내기(하단 여백 제거 → 지면 밀착), 그 후 캔버스 하단 중앙 배치
    bb = crop.getchannel("A").getbbox()
    if bb:
        crop = crop.crop(bb)
    w, h = crop.size
    maxw, maxh = cw - margin * 2, ch - margin * 2
    scale = 1.0
    if w > maxw or h > maxh:
        scale = min(maxw / w, maxh / h)
        method = Image.LANCZOS if scale < 0.85 else Image.NEAREST
        crop = crop.resize((max(1, int(w * scale)), max(1, int(h * scale))), method)
        w, h = crop.size
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((cw - w) // 2, ch - margin - h))
    return canvas


def components(mask, min_px=200):
    """알파 마스크(2D list)의 연결 요소별 bbox 목록 (4방향 BFS)"""
    h = len(mask)
    w = len(mask[0])
    seen = [[False] * w for _ in range(h)]
    out = []
    for sy in range(h):
        for sx in range(w):
            if mask[sy][sx] and not seen[sy][sx]:
                q = deque([(sx, sy)])
                seen[sy][sx] = True
                x0 = x1 = sx
                y0 = y1 = sy
                n = 0
                while q:
                    x, y = q.popleft()
                    n += 1
                    x0 = min(x0, x); x1 = max(x1, x)
                    y0 = min(y0, y); y1 = max(y1, y)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            q.append((nx, ny))
                if n >= min_px:
                    out.append((x0, y0, x1 + 1, y1 + 1, n))
    return out


def isolate_largest(crop: Image.Image) -> Image.Image:
    """crop 내부에서 가장 큰 알파 연결 요소(나무 본체)만 남기고 이웃 잔여물(바위 등) 제거"""
    W, H = crop.size
    px = crop.getchannel("A").load()
    mask = [[(px[x, y] > 12) for x in range(W)] for y in range(H)]
    comps = components(mask, min_px=120)
    if not comps:
        return crop
    comps.sort(key=lambda c: c[4], reverse=True)
    x0, y0, x1, y1, _ = comps[0]
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(crop.crop((x0, y0, x1, y1)), (x0, y0))
    print(f"    본체 분리: bbox=({x0},{y0})-({x1},{y1}) — 잔여물 {len(comps) - 1}개 제거")
    return out


def isolate_trunk(crop: Image.Image) -> Image.Image:
    """줄기(하단 중앙) 시드에서 flood-fill — 연결된 나무 본체만 남기고 좌우 바위/풀 제거"""
    W, H = crop.size
    px = crop.getchannel("A").load()
    mask = [[(px[x, y] > 12) for x in range(W)] for y in range(H)]
    # 시드 탐색: 캐노피 중앙 밴드(y 35~55%)에서 x 중앙 ±8 범위의 알파 픽셀 (잎사귀 — 확실히 나무 본체)
    seed = None
    for y in range(int(H * 0.35), int(H * 0.55)):
        for x in range(W // 2 - 8, W // 2 + 9):
            if mask[y][x]:
                seed = (x, y)
                break
        if seed:
            break
    if not seed:
        print("    시드 없음 — 원본 유지")
        return crop
    seen = [[False] * W for _ in range(H)]
    q = deque([seed])
    seen[seed[1]][seed[0]] = True
    n = 0
    x0 = x1 = seed[0]
    y0 = y1 = seed[1]
    while q:
        x, y = q.popleft()
        n += 1
        x0 = min(x0, x); x1 = max(x1, x)
        y0 = min(y0, y); y1 = max(y1, y)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and mask[ny][nx] and not seen[ny][nx]:
                seen[ny][nx] = True
                q.append((nx, ny))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    kept = crop.copy()
    kpx = kept.load()
    for y in range(H):
        for x in range(W):
            if mask[y][x] and not seen[y][x]:
                kpx[x, y] = (0, 0, 0, 0)
    print(f"    줄기 flood-fill: 시드={seed} 본체 bbox=({x0},{y0})-({x1+1},{y1+1}) 픽셀={n}")
    return kept


def main() -> None:
    sheet = Image.open(SER).convert("RGBA")
    W, H = sheet.size
    a = sheet.getchannel("A").load()
    mask = [[(a[x, y] > 12) for x in range(W)] for y in range(H)]

    # 나무 줄 검출 — 시트 우측 나무 영역 (x>=288, y>=290)
    bands = split_rows(mask, 288, W, 290, H, min_gap=4, min_run=50)
    print("나무 줄(y밴드):", bands)

    trees = []  # (bbox, hue)
    for (ry0, ry1) in bands:
        segs = split_cols(mask, 288, W, ry0, ry1)
        for (cx0, cx1) in segs:
            crop = sheet.crop((cx0, ry0, cx1, ry1))
            w, h = crop.size
            if w < TREE_MIN_W or w > TREE_MAX_W or h < TREE_MIN_H:
                continue
            if edge_touch(crop):
                continue  # 줄 가장자리 잘림 — 스킵
            trees.append(((cx0, ry0, cx1, ry1), dominant_hue(crop), w, h))
    print(f"개별 나무 후보 {len(trees)}개:")
    for bb, hue, w, h in trees:
        print(f"  bbox={bb} {w}x{h} hue={hue:.0f}")

    greens = [t for t in trees if 70 <= t[1] <= 160]
    teals = [t for t in trees if 160 < t[1] <= 210]
    print(f"색조 분류 — greens:{len(greens)} teals:{len(teals)} (참고용)")

    tree_bbox = (480, 586, 544, 692)  # 몽타주 실측 — 초록 나무 완전형 (캐노피 좌우 무잘림)
    print("tree 채택:", tree_bbox)

    # 격자 실측 지우개 — 나무 본체(x22~42 줄기, 캐노피 y<56) 외 이웃 바위/열매 제거
    tc = sheet.crop(tree_bbox)
    tpx = tc.load()
    for y in range(tc.height):
        for x in range(tc.width):
            if (y >= 56 and (x < 22 or x > 42)) or (y >= 80 and 22 <= x <= 42):
                tpx[x, y] = (0, 0, 0, 0)
    tree_crop = tc
    canvas_t = place_on_canvas(tree_crop, 64, 96, margin=2)
    canvas_t.save(f"{A}/tree.png")

    # pine: 시트의 청록 나무는 캐노피가 64px를 넘어 잘림 → tree 소스를 청록 keep_lum 틴트로 파생 (잘림 0)
    tree_img = Image.open(f"{A}/tree.png").convert("RGBA")
    tint(tree_img.copy(), (96, 208, 186)).save(f"{A}/pine.png")

    pine = Image.open(f"{A}/pine.png").convert("RGBA")
    tint(pine.copy(), (222, 238, 250)).save(f"{A}/pine_snow.png")
    tint(pine.copy(), (108, 96, 148)).save(f"{A}/pine_dark.png")

    # 검증 + 충돌 박스 측정
    for n in ("tree", "pine", "pine_snow", "pine_dark"):
        im = Image.open(f"{A}/{n}.png").convert("RGBA")
        b = im.getchannel("A").getbbox()
        bad = edge_touch(im)
        band = 24
        y_top = im.height - band
        bb = im.getchannel("A").crop((0, y_top, im.width, im.height)).getbbox()
        box = f"setSize({bb[2]-bb[0]-2},{band-2}).setOffset({bb[0]+1},{y_top+1})" if bb else "n/a"
        print(f"검증 {n}: bbox={b} 닿는변={bad or '없음'} 충돌권장={box}")

    # 프리뷰 몽타주
    prev = Image.new("RGBA", (64 * 2 + 60, 96 + 10), (40, 44, 52, 255))
    prev.alpha_composite(Image.open(f"{A}/tree.png").convert("RGBA"), (10, 5))
    prev.alpha_composite(Image.open(f"{A}/pine.png").convert("RGBA"), (64 + 40, 5))
    prev = prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST)
    prev.save(f"{ROOT}/scripts/_check_trees.png")
    print("프리뷰: scripts/_check_trees.png")


if __name__ == "__main__":
    main()
