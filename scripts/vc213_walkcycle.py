#!/usr/bin/env python3
"""vc213 — 32rogues 원본 시트 → 4프레임 걷기 사이클 생성기

배경
----
이 게임의 몬스터 프레임은 원래 `redesign_sprites.py` 가 **정적 셀 1장을 상하 스쿼시**
해 만든 것이었다. 그 결과 run0=run2=idle0 이 되어(4프레임 중 고유 2~3개)
"제자리에서 젤리처럼 출렁이는" 모션이 됐다.

원본 `32rogues/monsters.png` 를 확보했지만 **이 시트에도 애니메이션 프레임은 없다**
(전 셀을 0.5~12 거리로 비교한 결과 유사 쌍 0개 — 종류별 1마리씩 도감형).
따라서 프레임을 '찾는' 대신 원본 1장에서 **구조적으로 합성**한다.

합성 규칙 (검수 점수 5/10 → 7/10 → 7.5/10 로 개선된 값)
-------------------------------------------------------
  1) 접촉/통과 4비트 구조: ContactA → Passing → ContactB → Passing
  2) 앞다리·뒷다리 **반대 위상** (걷기 판독의 핵심. 같은 위상이면 미끄러짐)
  3) 통과 프레임에서 발 **2px 들기** (지면에 붙어 있으면 스케이트로 읽힘)
  4) 몸통 보브 2px + 스쿼시 0.95 (접촉=낮게, 통과=높게)
  5) 보폭 ±2px (스프라이트 대비 발 미끄러짐을 줄이는 최소 유효 범위)

사용법
------
  python3 scripts/vc213_walkcycle.py            # 전체 생성
  python3 scripts/vc213_walkcycle.py --dry-run  # 미리보기만
"""
import argparse, hashlib, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, "assets_src/32rogues/monsters.png")
OUTDIR = os.path.join(ROOT, "public/assets")
MATCH = os.path.join(ROOT, "docs/rogues_cell_match.json")

# 신뢰 매칭(d<12)만 사용한다. 불확실한 종은 건드리지 않는다(오염 방지).
D_MAX = 12.0


def cell(sheet, c, r):
    return sheet.crop((c * 32, r * 32, c * 32 + 32, r * 32 + 32))


# 원본 셀 32x32 를 40x40 캔버스 중앙에 놓고 ±4px 이동 여유를 준다.
# (원본이 32px 를 꽉 채우는 11종은 32px 캔버스에서 어떤 이동도 잘림을 만든다)
PAD = 4
CANVAS = 32 + PAD * 2


def frame(s, *, bob, squash, fdx, bdx, lift_f, lift_b):
    """원본 1장 → 걷기 1프레임. 다리 영역을 분리해 위상을 준다."""
    bb = s.getbbox()
    if bb is None:
        return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    art = s.crop(bb)
    ax = bb[0] + PAD   # 패딩된 캔버스 좌표계
    w, h = art.width, art.height
    lh = max(2, int(h * 0.38))
    body = art.crop((0, 0, w, max(1, h - lh)))
    legs = art.crop((0, max(0, h - lh), w, h))
    body = body.resize((w, max(1, round(body.height * squash))), Image.NEAREST)
    bh = body.height
    half = max(1, w // 2)
    front = legs.crop((0, 0, half, legs.height))
    back = legs.crop((half, 0, w, legs.height))
    lcv = Image.new("RGBA", (w + 8, legs.height + 4), (0, 0, 0, 0))
    lcv.alpha_composite(front, (4 + fdx, lift_f))
    lcv.alpha_composite(back, (4 + half + bdx, lift_b))
    cv = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    y = max(0, CANVAS - (bh + legs.height) + bob)
    cv.alpha_composite(body, (ax, min(y, CANVAS - 1)))
    if y + bh < CANVAS:
        cv.alpha_composite(lcv, (max(0, ax - 4), min(CANVAS - 1, y + bh)))
    return cv


# 접촉 → 통과 → 접촉 → 통과 (앞뒤 다리 반대 위상)
PHASES = [
    dict(bob=0, squash=1.00, fdx=-2, bdx=2, lift_f=0, lift_b=0),
    dict(bob=-2, squash=0.95, fdx=0, bdx=0, lift_f=0, lift_b=2),
    dict(bob=0, squash=1.00, fdx=2, bdx=-2, lift_f=0, lift_b=0),
    dict(bob=-2, squash=0.95, fdx=0, bdx=0, lift_f=2, lift_b=0),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-dist", type=float, default=D_MAX)
    args = ap.parse_args()

    if not os.path.exists(SHEET):
        sys.exit(f"원본 시트 없음: {SHEET}")
    if not os.path.exists(MATCH):
        sys.exit(f"매칭표 없음: {MATCH}")

    sheet = Image.open(SHEET).convert("RGBA")
    match = json.load(open(MATCH, encoding="utf-8"))

    done, skipped = [], []
    for key, cands in sorted(match.items()):
        top = cands[0]
        if top["d"] > args.max_dist:
            skipped.append((key, top["cell"], top["d"]))
            continue
        cellname = top["cell"]
        r = int(cellname.split("r")[1].split("c")[0])
        c = int(cellname.split("c")[1])
        src = cell(sheet, c, r)
        frames = [frame(src, **p) for p in PHASES]

        # 검증: 4프레임이 실제로 서로 달라야 한다(이 스크립트의 존재 이유)
        hashes = [hashlib.md5(f.tobytes()).hexdigest() for f in frames]
        if len(set(hashes)) < 4:
            skipped.append((key, cellname, f"프레임 중복 {len(set(hashes))}/4"))
            continue
        # 좌우 잘림 검사 — 캐릭터 실루엣이 캔버스 밖으로 나가면 안 된다
        clipped = []
        for i, f in enumerate(frames):
            bb = f.getbbox()
            if bb and (bb[0] == 0 or bb[2] == CANVAS):
                clipped.append(i)
        if clipped:
            skipped.append((key, cellname, f"좌우 잘림 프레임 {clipped}"))
            continue

        if not args.dry_run:
            # 기존 규약 유지: 파일명은 `${key}_run{0..3}.png`
            for i, f in enumerate(frames):
                out = os.path.join(OUTDIR, f"{key}_run{i}.png")
                f.save(out, "PNG", optimize=True)
        done.append((key, cellname, top["d"]))

    print(f"생성 {len(done)}종 / 건너뜀 {len(skipped)}종")
    for k, c, d in done:
        print(f"  OK   {k:<18} <- {c} (d={d})")
    for k, c, d in skipped:
        print(f"  SKIP {k:<18} <- {c} ({d})")
    if args.dry_run:
        print("\n--dry-run: 파일을 쓰지 않았습니다.")


if __name__ == "__main__":
    main()
