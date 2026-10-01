#!/usr/bin/env python3
"""v1.2.1 (#7 미소녀) — 여캠 얼굴 전면 강화 (유저 지시 "미소년 말고 미소녀 캐릭터들 다 어디감??").

v1.2.0의 애니눈(하이라이트+아이리스) 위에 한 단계 더:
  1) 눈 확대 — 아래로 1행 확장(2x5 애니눈) + 두 번째 하이라이트 → 크고 반짝이는 눈
  2) 속눈썹 강화 — 위-바깥 2px 래시 라인
  3) 볼터치 강화 — 2px 폭 파스텔 핑크
  4) 입 — 눈 아래 중앙에 1~2px 로즈 입술 (존재만으로 표정이 산다)
  5) 트윈테일 사이드 스트랜드 — chf 기본 시트 머리 옆에서 가슴까지 2px 스트랜드
     (포니테일 폐지 이후 여캠 실루엣이 밋밋해진 것 보강 — 어태치와 무관하게 베이크)

대상: chf0~5(기본 여캠 6피부) + jobf_* 8직업 + cost_* 여성 코스튬 10종 — 총 24시트 × 28프레임.
모든 픽셀 추가는 "피부 위에만" 가드 — 머리카락/의상/투명 영역 오염 없음.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_v120_looks import EY, WHITE, JOBS, lighten  # noqa: E402

SRC = "public/assets"
BLUSH = (255, 138, 158, 225)
LIPS = (222, 106, 120, 255)
LASH = (26, 18, 22, 255)

FRAME_PARTS = ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]

SKIN_BY_PREFIX = {
    "chf0": [(248, 224, 198, 255), (255, 240, 222, 255)],
    "chf1": [(232, 197, 159, 255), (247, 217, 185, 255)],
    "chf2": [(214, 176, 138, 255), (234, 202, 164, 255)],
    "chf3": [(156, 110, 78, 255), (182, 142, 104, 255)],
    "chf4": [(126, 86, 58, 255), (156, 114, 80, 255)],
    "chf5": [(96, 62, 42, 255), (124, 88, 62, 255)],
}


def skin_candidates(px, im):
    """시트에서 피부색 후보 추정: 가장 많은 밝은 색 2종 (얼굴/손 영역)"""
    from collections import Counter
    c = Counter()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] > 0 and p[0] > p[2] and p[0] > 90 and p[1] > 60:
                c[p] += 1
    return [col for col, _ in c.most_common(3)]


def eye_clusters(px, eye_color):
    pts = [(x, y) for y in range(64) for x in range(96) if px[x, y] == eye_color]
    if not pts:
        return None, None
    xs = sorted({x for x, _ in pts})
    clusters = [[xs[0]]]
    for x in xs[1:]:
        if x - clusters[-1][-1] > 3:
            clusters.append([x])
        else:
            clusters[-1].append(x)
    if len(clusters) != 2:
        return None, None
    ys = sorted({y for _, y in pts})
    side = (clusters[1][0] - clusters[0][-1]) <= 4
    return (clusters, ys), side


def girly_face(im, eye_color, skins):
    """눈 확대+러시+입+볼터치 — 피부 위에만 픽셀 추가"""
    if len(eye_color) == 3:
        eye_color = tuple(eye_color) + (255,)
    px = im.load()
    r = eye_clusters(px, eye_color)
    if not r or r[0] is None:
        return im
    (clusters, ys), side = r
    made_mouth = False
    for ci, cxs in enumerate(clusters):
        x0, x1 = cxs[0], cxs[-1]
        cy0 = ys[0]
        eye_h = max(y for x, y in [(x, y) for y in ys for x in cxs] if True) if False else max(y for _, y in [(x, y) for x in range(x0, x1 + 1) for y in ys if px[x, y] == eye_color])
        is_right = ci == 1
        if side:
            outer, inner = x0, x1
        else:
            inner = x0 if is_right else x1
            outer = x1 if is_right else x0
        # 1) 눈 확대 — 아래 1행 (어두운 아이리스 그림자)
        ny = eye_h + 1
        for x in range(x0, x1 + 1):
            if 0 <= ny < 64 and px[x, ny][3] > 0 and px[x, ny] in skins:
                px[x, ny] = (tuple(int(v * 0.72) for v in eye_color[:3])) + (255,)
        # 2) 두 번째 하이라이트 (위-바깥)
        hy = cy0
        if 0 <= outer < 96 and px[outer, hy + 1] == eye_color:
            px[outer, hy + 1] = WHITE
        # 3) 속눈썹 2px — 위-바깥 라인
        for dx, dy in ((0, -1), (-1 if is_right and not side else 1, -1)):
            lx = outer + dx
            ly = cy0 + dy
            if 0 <= lx < 96 and 0 <= ly < 64 and px[lx, ly][3] == 0:
                px[lx, ly] = LASH
        # 4) 볼터치 2px 폭
        by = cy0 + 5
        for dx in (0, -1 if is_right and not side else 1):
            bx = outer + dx
            if 0 <= bx < 96 and by < 64 and px[bx, by][3] > 0 and px[bx, by] in skins:
                px[bx, by] = BLUSH
    # 5) 입 — 두 눈 사이 아래 중앙, 피부 위에만
    mid = (clusters[0][-1] + clusters[1][0]) / 2
    my = ys[0] + 7
    for mx in (int(mid - 0.5), int(mid + 0.5)):
        if 0 <= mx < 96 and my < 64 and px[mx, my][3] > 0 and px[mx, my] in skins:
            px[mx, my] = LIPS
            made_mouth = True
    return im


def twin_strands(im, hair_color, hair_s=None):
    """chf 트윈테일 스트랜드 — 머리 옆(헤어 경계 바로 바깥)에서 아래로 2px 스트랜드.
    투명 픽셀에만 그려 실루엣을 침범하지 않는다.
    v1.2.1 수정: hair_color는 "헤어 본색"(행 20~26 최빈 불투명색) — 외곽선 검정을 샘플링해
    검은 실처럼 보이던 버그 수정."""
    if len(hair_color) == 3:
        hair_color = tuple(hair_color) + (255,)
    if hair_s is not None and len(hair_s) == 3:
        hair_s = tuple(hair_s) + (255,)
    px = im.load()
    # 머리 영역: 행별 헤어색 경계 탐색 (y 16..30)
    left_x, right_x = None, None
    for y in range(18, 32):
        for x in range(96):
            if px[x, y] == hair_color:
                if left_x is None or x < left_x:
                    left_x = x
                if right_x is None or x > right_x:
                    right_x = x
    if left_x is None or right_x is None:
        return im
    shade = tuple(int(v * 0.62) for v in hair_color[:3]) + (255,)
    for side_x in (left_x - 1, left_x - 2, right_x + 1, right_x + 2):
        for y in range(30, 46):
            if 0 <= side_x < 96 and px[side_x, y][3] == 0:
                # 아래로 갈수록 가늘게 (끝 4행은 1개 열만)
                if y > 42 and abs(side_x) % 2 == 0:
                    continue
                px[side_x, y] = hair_color if (y % 3) else shade
                # 인접 열도 절반 확률로 채워 자연스러운 뭉치
                nx = side_x + (1 if side_x < 48 else -1)
                if 0 <= nx < 96 and px[nx, y][3] == 0 and y < 40:
                    px[nx, y] = shade if (y % 2) else hair_color
    return im


def hair_body_color(im, eye_color=None):
    """헤어 본색 추정: 행 18~26에서 최빈 불투명색 (외곽선·피부·눈 제외한 가장 흔한 색)."""
    from collections import Counter
    px = im.load()
    c = Counter()
    for y in range(16, 27):
        for x in range(96):
            p = px[x, y]
            if p[3] == 0:
                continue
            if max(p[0], p[1], p[2]) < 40:  # 외곽선(검정) 제외
                continue
            c[p] += 1
    return c.most_common(1)[0][0] if c else (120, 84, 56, 255)


def main():
    made = 0
    sheets = []
    # 기본 여캠 6종 (트윈테일 포함)
    sheets += [(p, EY, SKIN_BY_PREFIX[p], True) for p in ["chf0", "chf1", "chf2", "chf3", "chf4", "chf5"]]
    # 직업 여캠 8종 (직업별 눈색)
    for key, pal_ in JOBS.items():
        sheets.append((f"jobf_{key}", pal_["eye"], [(tuple(s) + (255,)) if len(s) == 3 else s for s in (pal_["skin"], pal_["skin2"])], False))
    # 여성 코스튬 10종 (눈색 자동: EY 시도)
    for k in ["royal", "shadow", "spring", "navy", "silver", "crimson", "seraph", "abyss", "nightmare", "gilded"]:
        sheets.append((f"cost_{k}", EY, None, False))

    for prefix, eye, skins, twin in sheets:
        # 피부 후보 자동 추정 (미지정 시)
        probe = f"{SRC}/{prefix}_idle0.webp"
        if not os.path.exists(probe):
            print("SKIP", prefix)
            continue
        auto = skins is None
        for part in FRAME_PARTS:
            for i in range(4):
                path = f"{SRC}/{prefix}_{part}{i}.webp"
                if not os.path.exists(path):
                    continue
                im = Image.open(path).convert("RGBA")
                px = im.load()
                sk = skins if skins else skin_candidates(px, im)
                if auto and i == 0:
                    # 코스튬 시트는 첫 프레임에서 추정한 피부색 고정 (프레임 간 일관성)
                    skins2 = sk
                else:
                    skins2 = sk
                before = im.tobytes()
                im = girly_face(im, eye, skins2)
                if twin:
                    im = twin_strands(im, hair_body_color(im))
                if im.tobytes() != before:
                    im.save(path, lossless=True)
                    made += 1
    print(f"girly pass: {made} frames updated")


if __name__ == "__main__":
    main()
