#!/usr/bin/env python3
"""vc147 (#27) — 모자/투구 치장 얼굴 가림 수정.
투구 바이저·후드 그림자로 얼굴이 지워진 코스튬 프레임의 얼굴 영역을 자동 검출해
피부톤 + 눈을 다시 그려 넣는다. AI 생성 0 — 유저 스프라이트 위 픽셀 복원.

· 대상: cost_*/costm_* 정면 프레임(idle*/walk*) 중 머리 영역에 다크 바이저(연속 어두운 띠)가 있는 것
· 방법: 머리 박스(x34~62, y8~30)에서 어두운 픽셀(a>200, sum<150) 최대 클러스터 →
  상하단 1px 헬멧 테두리 남기고 피부톤 채움 + 눈 2개(1×2px) + 입 생략(도트 크기)
· 측면/상하 프레임(atk/atkup/atkdown)은 프로필이라 미처리 (원본 유지)
"""
from PIL import Image
import glob, os, sys

SKIN = (240, 200, 168, 255)
SKIN_DK = (216, 172, 138, 255)
EYE = (44, 34, 38, 255)
HEAD_BOX = (34, 8, 63, 31)  # x0,y0,x1,y1 (96x64 프레임 기준)
DARK_SUM = 150

def dark_cluster(im):
    x0, y0, x1, y1 = HEAD_BOX
    w, h = im.size
    px = im.load()
    pts = []
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, a = px[x, y]
            if a > 200 and r + g + b < DARK_SUM:
                pts.append((x, y))
    if len(pts) < 12:
        return None
    # flood fill 최대 클러스터
    ptset = set(pts)
    best = set()
    seen = set()
    for p in pts:
        if p in seen:
            continue
        stack = [p]
        comp = set()
        while stack:
            q = stack.pop()
            if q in seen or q not in ptset:
                continue
            seen.add(q)
            comp.add(q)
            x, y = q
            stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
        if len(comp) > len(best):
            best = comp
    if len(best) < 12:
        return None
    xs = [p[0] for p in best]; ys = [p[1] for p in best]
    return min(xs), min(ys), max(xs), max(ys), best

def face_reveal(path, dry=False):
    im = Image.open(path).convert("RGBA")
    c = dark_cluster(im)
    if not c:
        return False, "no visor"
    vx0, vy0, vx1, vy1, comp = c
    bw, bh = vx1 - vx0 + 1, vy1 - vy0 + 1
    if bw < 5 or bh < 2:
        return False, f"cluster too small {bw}x{bh}"
    px = im.load()
    # 1) 피부 채움 — 클러스터 내부만(헬멧 테두리 1px 보존)
    for (x, y) in comp:
        if x in (vx0, vx1) or y in (vy0, vy1):
            continue
        px[x, y] = SKIN
    # 2) 눈 — 바이저 폭 3분할 지점, 세로 중앙
    ey = vy0 + max(1, bh // 2)
    e1 = vx0 + max(2, bw // 3)
    e2 = vx1 - max(2, bw // 3)
    if 0 < e1 < im.size[0] and 0 < e2 < im.size[0]:
        px[e1, ey] = EYE
        px[e2, ey] = EYE
        if bh >= 4:
            px[e1, ey + 1] = EYE
            px[e2, ey + 1] = EYE
    # 3) 뺨 음영 1px (볼륨감)
    if bw >= 8:
        for xx in range(vx0 + 1, min(vx0 + 2, vx1)):
            yy = min(vy1 - 1, ey + 2)
            if (xx, yy) in comp:
                px[xx, yy] = SKIN_DK
    if not dry:
        im.save(path)
    return True, f"visor {bw}x{bh} @({vx0},{vy0})"

def main():
    dry = "--dry" in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith("--only="):
            only = a.split("=", 1)[1]
    changed = skipped = 0
    targets = []
    for path in sorted(glob.glob("public/assets/cost_*_idle*.webp") + glob.glob("public/assets/cost_*_walk*.webp")):
        name = os.path.basename(path)
        fam = name.rsplit("_", 1)[0]  # cost_valkyrie_idle
        suit = "_".join(fam.split("_")[1:-1])
        if only and suit != only:
            continue
        targets.append(path)
    # suit 단위로 1프레임 검출 → 해당 슈트 전 프레임 일괄 처리
    suits = {}
    for path in targets:
        name = os.path.basename(path)
        parts = name.split("_")
        suit = parts[1]
        # costm_ 접두 처리
        if parts[0] == "costm":
            suit = parts[1]
        suits.setdefault(f"{parts[0]}_{suit}", []).append(path)
    for suit, paths in sorted(suits.items()):
        ok, info = face_reveal(paths[0], dry=True)
        if not ok:
            print(f"SKIP {suit}: {info}")
            skipped += 1
            continue
        for p in paths:
            ok2, info2 = face_reveal(p, dry=dry)
        print(f"{'DRY' if dry else 'FIX '} {suit}: {len(paths)} frames — {info}")
        changed += 1
    print(f"\nsummary: {changed} suits processed, {skipped} skipped, dry={dry}")

if __name__ == "__main__":
    main()
