#!/usr/bin/env python3
"""
vc222 — `sprite-pipeline` 스킬 기준 몬스터 run 프레임 정규화.

## 진단 (실측)

`public/assets/x2_<key>_run<0-3>.png` 9종 중 6종이 세 가지 결함을 갖고 있었다.

1. **크기 드리프트** — idle 은 64x64 캔버스인데 run 만 40x40 이다.
   내용 크기까지 함께 작아져서, 달리기 시작하면 캐릭터가 급격히 줄어든다.
     firebird 56x42 → 27x22 (-75%)
     rat      60x31 → 30x17 (-73%)
     reeffish 48x37 → 25x19 (-73%)
     frog     43x32 → 23x18 (-71%)
     frostfly 46x42 → 32x30 (-49%)
     bat      40x20 → 30x16 (-40%)
   (darkhound / snail / stonegolem 은 64x64 이고 100~102% 로 정상이었다)

2. **하단 클리핑** — 40x40 run 프레임 21개가 캔버스 바닥에 닿아 잘려 있다.
   `x2_bat_run0.png` 은 마지막 행에 불투명 픽셀 2개가 붙어 있다 = 발이 잘림.

3. **팔레트 불일치** — firebird(idle 갈색 `#ab6426` → run 녹색 `#5c855b`),
   reeffish(청록 `#307883` → 파랑 `#3b6983`), frostfly(회색 `#435465` → 암적색 `#472138`).
   두 몬스터가 아니라 **다른 셀을 잘라 넣은 것**이다.

## 원인

`scripts/redesign_sprites.py` 의 `gen_monster()` 는 `idle0` 캔버스(64x64)에 쓰지만,
현재 run 파일은 40x40 짜리 **구버전 산출물**이 남아 있다. 게다가 그 스크립트의
`RUN_FS = [1.0, 0.90, 1.0, 0.96]` 은 index 0 과 2 가 모두 1.0 이라
**run0 과 run2 가 구조적으로 항상 동일**해진다(실측: darkhound/snail/stonegolem 중복).

## 처방 (`sprite-pipeline` §Core Workflow 4·5)

> "Normalize the result into fixed-size game frames.
>  Use one shared scale across the whole strip. Align frames with one shared anchor,
>  typically bottom-center."

- 기준은 **그 몬스터의 `idle0`** 하나. run 은 그 내용을 같은 스케일로 squash 한 변형이다.
  → 공유 스케일이므로 크기 드리프트가 0 이 된다.
- 앵커는 idle 의 bbox `bottom-center` 을 그대로 복사한다. → 전환 시 위치가 안 튄다.
- 캔버스 안에 클램프해 **클리핑을 구조적으로 불가능**하게 만든다.
- 팔레트는 idle 픽셀을 그대로 쓰므로 자동으로 일치한다.

## 정직한 한계

원본 `assets_src/32rogues/monsters.png` 는 156종 × **1칸**이다(실측: 12열 × 13행,
각 셀 1개씩, md5 상 서로 다른 몬스터). **걷기 프레임이 애초에 존재하지 않는다.**
따라서 run 은 정적 idle 을 squash/bob 한 사이클일 수밖에 없다.
이 스크립트가 하는 일은 "걷기를 창조"가 아니라 **깨진 정규화를 바로잡는 것**이다.

사용:
  python3 tools/normalize_monster_frames.py --dry-run   # 수치만 확인
  python3 tools/normalize_monster_frames.py             # 실제 적용(원본 백업)
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import os
import re
import shutil
import sys

from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")
BACKUP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets_backup_monster_run")

# 프레임별 (세로배율, 가로배율, 바닥 bob px)
#  · 네 프레임이 **모두 다르다** (종전 RUN_FS 는 0,2 가 같았다)
#  · 면적 변화는 ±8% 이내 — "크기가 변한다"로 읽히지 않을 만큼만
RUN_SPECS = [
    (1.00, 1.00, 0),
    (0.93, 1.07, 1),
    (1.04, 0.97, 0),
    (0.97, 1.03, 1),
]


def opaque_bbox(im: Image.Image):
    return im.getbbox()


def content_size(im: Image.Image):
    bb = im.getbbox()
    return (0, 0) if not bb else (bb[2] - bb[0], bb[3] - bb[1])


def touches_edge(im: Image.Image) -> list[str]:
    """bbox 가 캔버스 경계에 닿았는가 = 잘렸는가."""
    bb = im.getbbox()
    if not bb:
        return []
    w, h = im.size
    hits = []
    if bb[0] <= 0:
        hits.append("좌")
    if bb[1] <= 0:
        hits.append("상")
    if bb[2] >= w:
        hits.append("우")
    if bb[3] >= h:
        hits.append("하")
    return hits


def dom_color(im: Image.Image, thr: int = 128) -> str | None:
    from collections import Counter

    px = [p[:3] for p in im.convert("RGBA").getdata() if p[3] > thr]
    if not px:
        return None
    r, g, b = Counter(px).most_common(1)[0][0]
    return f"#{r:02x}{g:02x}{b:02x}"


def color_dist(a: str, b: str) -> float:
    ar, ag, ab = int(a[1:3], 16), int(a[3:5], 16), int(a[5:7], 16)
    br, bg, bb = int(b[1:3], 16), int(b[3:5], 16), int(b[5:7], 16)
    return ((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2) ** 0.5


def plan(keys: list[str]):
    """각 몬스터의 현재 상태를 측정해 리포트."""
    rows = []
    for key in keys:
        idle_path = f"{ASSETS}/x2_{key}_idle0.png"
        if not os.path.exists(idle_path):
            continue
        idle = Image.open(idle_path).convert("RGBA")
        iw, ih = content_size(idle)
        idle_dom = dom_color(idle)
        runs = sorted(glob.glob(f"{ASSETS}/x2_{key}_run*.png"))
        if not runs:
            continue
        run_can = Image.open(runs[0]).convert("RGBA").size
        ratios, clipped, pal_bad = [], 0, 0
        for r in runs:
            im = Image.open(r).convert("RGBA")
            rw, rh = content_size(im)
            ratios.append((rw * rh) / (iw * ih) * 100 if iw * ih else 0)
            if touches_edge(im):
                clipped += 1
            rd = dom_color(im)
            if rd and idle_dom and color_dist(rd, idle_dom) > 60:
                pal_bad += 1
        md5s = [hashlib.md5(Image.open(r).convert("RGBA").tobytes()).hexdigest() for r in runs]
        rows.append(
            {
                "key": key,
                "idle_canvas": idle.size,
                "run_canvas": run_can,
                "idle_content": (iw, ih),
                "run_ratio_avg": sum(ratios) / len(ratios),
                "run_ratio_min": min(ratios),
                "clipped": clipped,
                "palette_bad": pal_bad,
                "unique": len(set(md5s)),
                "frames": len(runs),
            }
        )
    return rows


def normalize(keys: list[str], dry: bool) -> int:
    bad = 0
    for key in keys:
        idle_path = f"{ASSETS}/x2_{key}_idle0.png"
        runs = sorted(glob.glob(f"{ASSETS}/x2_{key}_run*.png"))
        if not os.path.exists(idle_path) or not runs:
            continue

        idle = Image.open(idle_path).convert("RGBA")
        W, H = idle.size
        bb = idle.getbbox()
        if not bb:
            print(f"  !! {key}: idle 이 완전 투명 — 스킵")
            bad += 1
            continue

        art = idle.crop(bb)  # 기준 아트 = idle 내용 그대로 (팔레트/실루엣 보존)
        cx = (bb[0] + bb[2]) / 2  # 공유 앵커 X = idle bbox 중심
        bottom = bb[3]  # 공유 앵커 Y = idle bbox 바닥

        # 가로 여유 — 확장 시 캔버스를 넘으면 클리핑된다.
        #  rat(60/64) · snail(60/64) 은 남은 여유가 4px 뿐이라
        #  확장하면 좌우 어느 한쪽이 캔버스 경계에 닿는다. 게다가 cx=32.0 이
        #  정수라 `round(32 - 63/2)` 가 0.5→0 으로 떨어져 좌측이 붙었다.
        #  → 좌우에 최소 2px 씩 여유를 남기는 배율까지만 키운다.
        max_fw = (W - 4) / art.width if art.width else 9.0

        for i, path in enumerate(runs):
            fh, fw, bob = RUN_SPECS[i % len(RUN_SPECS)]
            fw = min(fw, max_fw)
            w = max(1, round(art.width * fw))
            h = max(1, round(art.height * fh))
            f = art.resize((w, h), Image.NEAREST)

            cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            # 좌표를 정수로 확정한 뒤 배치한다.
            #  cx 가 반정수(예: 32.0)일 때 int() 절삭이 프레임마다 다르게 걸려
            #  좌우로 1px 씩 밀리며 캔버스 경계를 넘는 일이 있었다(rat/snail).
            x = round(cx - w / 2)
            y = round(bottom - h - bob)
            x = max(0, min(x, W - w))
            y = max(0, min(y, H - h)) if h <= H else 0
            cv.alpha_composite(f, (int(x), int(y)))

            if not dry:
                os.makedirs(BACKUP, exist_ok=True)
                bak = os.path.join(BACKUP, os.path.basename(path))
                if not os.path.exists(bak):
                    shutil.copy2(path, bak)
                cv.save(path)

        if dry:
            print(f"  (dry) {key}: {len(runs)}프레임 재생성 예정  캔버스 {W}x{H}")
        else:
            print(f"  {key}: {len(runs)}프레임 정규화 ✓  캔버스 {W}x{H}")
    return bad


def verify(keys: list[str]) -> int:
    """계약 검증 — 스킬의 Quality Gates 를 수치로."""
    print("\n=== 검증 (sprite-pipeline Quality Gates) ===")
    print(f"{'몬스터':<13} {'idle캔버스':>10} {'run캔버스':>9} {'면적비':>7} {'최소':>6} {'잘림':>5} {'팔레트':>6} {'고유':>5}  판정")
    print("-" * 78)
    fails = 0
    for r in plan(keys):
        checks = []
        if r["run_canvas"] != r["idle_canvas"]:
            checks.append("캔버스불일치")
        if not (88 <= r["run_ratio_avg"] <= 116):
            checks.append("크기드리프트")
        if r["clipped"]:
            checks.append(f"잘림{r['clipped']}")
        if r["palette_bad"]:
            checks.append("팔레트")
        if r["unique"] != r["frames"]:
            checks.append(f"중복{r['frames']-r['unique']}")
        ok = not checks
        if not ok:
            fails += 1
        print(
            f"{r['key']:<13} {str(r['idle_canvas']):>10} {str(r['run_canvas']):>9} "
            f"{r['run_ratio_avg']:>6.0f}% {r['run_ratio_min']:>5.0f}% {r['clipped']:>5} "
            f"{r['palette_bad']:>6} {r['unique']}/{r['frames']:>3}  {'OK' if ok else ' / '.join(checks)}"
        )
    print("-" * 78)
    print(f"{'통과' if fails == 0 else f'{fails}종 실패'}")
    return 0 if fails == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--keys", nargs="*", default=None)
    args = ap.parse_args()

    keys = args.keys or sorted(
        {
            re.match(r"x2_(.+)_run\d+\.png$", os.path.basename(p)).group(1)
            for p in glob.glob(f"{ASSETS}/x2_*_run*.png")
            if re.match(r"x2_(.+)_run\d+\.png$", os.path.basename(p))
        }
    )

    if args.verify_only:
        return verify(keys)

    print("=== BEFORE ===")
    for r in plan(keys):
        flag = []
        if r["run_canvas"] != r["idle_canvas"]:
            flag.append(f"캔버스 {r['run_canvas']}≠{r['idle_canvas']}")
        if r["run_ratio_avg"] < 88:
            flag.append(f"크기 {r['run_ratio_avg']:.0f}%")
        if r["clipped"]:
            flag.append(f"잘림 {r['clipped']}")
        if r["palette_bad"]:
            flag.append(f"팔레트 {r['palette_bad']}")
        if r["unique"] != r["frames"]:
            flag.append(f"중복 {r['frames']-r['unique']}")
        print(f"  {r['key']:<13} {' '.join(flag) if flag else 'OK'}")

    print("\n=== 정규화 ===")
    normalize(keys, args.dry_run)

    if args.dry_run:
        print("\n(dry-run — 파일을 쓰지 않았다)")
        return 0
    return verify(keys)


if __name__ == "__main__":
    sys.exit(main())
