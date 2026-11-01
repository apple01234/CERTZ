#!/usr/bin/env python3
"""
vc224 — Fantasy Adventure Pack → 게임 스프라이트 변환.

## 왜 하는가

지적: "에셋 생성하지 말고 다운받아 써라. 여기 폴더에 좋은 게 얼마나 많은데"

종전에는 `scripts/redesign_sprites.py` 가 정적 셀 1장을 squash 해서 4프레임을 **합성**했다.
그래서 프레임이 실제 동작이 아니었고(run0 == run2), 로직도 아트도 코드 생산물이었다.

`_assets_in/x2/Fantasy Adventure Pack` 에 **원본 애니메이션 475프레임**이 있다:
  플레이어 3종 × 26애니메이션 (P1_Idle 7f, P1_Run 8f, P1_Attack1~4 5f, P1_Dead 18f …)

## 규격 (실측)

```
원본  : 160x160 셀, 가로 나열
내용  : 18x36 px  (캔버스의 11% — 여백이 매우 큼)
현재  : hero_* = 96x64 셀, 내용 26x42, 물리 바디 20x44
```

내용 크기가 18x36 → 26x42 이므로 **약 1.17배**면 현재 캐릭터와 같은 크기가 된다.
정수 NEAREST 배율을 지키려면 **1배 그대로** 쓰고, 표시 시 `setScale` 로 키우는 편이
화질 손실이 없다. 다만 160px 캔버스는 메모리·충돌 판정에 불리하므로
**내용 bbox 를 공통 앵커로 잘라 64x64 로 리패킹**한다(내용은 손대지 않음).

## 공통 앵커 (sprite-pipeline 규칙)

> "Use one shared anchor, typically bottom-center."

한 캐릭터의 **모든 애니메이션에서 동일한 bbox 창**을 쓴다. 그래야 idle↔run↔attack
전환 시 발 위치가 튀지 않는다. 창은 캐릭터 전체 애니메이션의 bbox 합집합에서 계산한다.

## 출력

```
public/assets/fa/<char>/<anim>_<n>.png   ← 개별 프레임
```

게임 로더는 개별 키 방식(`load.image`)이므로 프레임을 낱장으로 낸다.
키 규칙: `fa_p1_idle0`, `fa_p1_run3` …

사용:
  python3 tools/import_fantasy_adventure.py --dry-run
  python3 tools/import_fantasy_adventure.py
"""
from __future__ import annotations

import argparse
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = "/root/workspace/_assets_in/x2/Fantasy Adventure Pack/Sprites/Player Sprites"
OUT_ROOT = os.path.join(ROOT, "public", "assets", "fa")

CELL = 160
# 출력 캔버스 크기 — 내용(18x36)이 여유 있게 들어가고 현재 hero(96x64)와 비슷한 스케일
OUT_W, OUT_H = 64, 64

# 게임이 필요로 하는 애니메이션 → FA 시트 이름
#  방향별 걷기/공격은 FA 에 없으므로(단일 방향 측면) 가장 가까운 것으로 매핑한다.
ANIM_MAP = {
    "idle":   "Idle",
    "run":    "Run",
    "atk":    "Attack1",
    "atk2":   "Attack2",
    "atk3":   "Attack3",
    "atk4":   "Attack4",
    "atkup":  "AttackUp",
    "atkdown": "AttackDown",
    "jump":   "TakeOff",
    "fall":   "Fall",
    "dash":   "Dash",
    "hit":    "Hit",
    "dead":   "Dead",
    "idle2run": "IdleToRun",
    "run2idle": "RunToIdle",
    "land":   "Landing",
}

CHARS = {"p1": "Player1", "p2": "Player2", "p3": "Player3"}


def frames_of(path: str):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if w % CELL or h != CELL:
        return []
    n = w // CELL
    return [im.crop((i * CELL, 0, i * CELL + CELL, CELL)) for i in range(n)]


def union_bbox(paths):
    """캐릭터 전체 애니메이션의 bbox 합집합 — 공통 앵커 창.

    vc224 — **이펙트가 큰 애니메이션은 제외**한다.
    `Appear`/`Dead`/`VFX` 는 폭발·마법진이 캔버스를 크게 차지해 bbox 가 83x83 이다.
    이걸 포함하면 앵커 창이 3배로 커져 본체(25x37)가 작게 보이고 프레임도 무거워진다.
    본체 동작(idle/run/attack/hit/dash)만으로 창을 잡는다.
    """
    x0 = y0 = 10**9
    x1 = y1 = -1
    for p in paths:
        base = os.path.basename(p)
        # 폭발/등장/소멸 연출은 창 계산에서 제외
        if re.search(r"_(Dead|Appear|VFX)\.png$", base):
            continue
        for fr in frames_of(p):
            bb = fr.getbbox()
            if not bb:
                continue
            x0 = min(x0, bb[0]); y0 = min(y0, bb[1])
            x1 = max(x1, bb[2]); y1 = max(y1, bb[3])
    if x1 < 0:
        return None
    return (x0, y0, x1, y1)


def build(char_key: str, dry: bool) -> tuple[int, int]:
    src_dir = os.path.join(SRC_ROOT, CHARS[char_key])
    if not os.path.isdir(src_dir):
        print(f"  !! {char_key}: 원본 폴더 없음")
        return 0, 0

    # 존재하는 애니메이션만
    avail = {}
    for game_name, fa_name in ANIM_MAP.items():
        p = os.path.join(src_dir, f"{CHARS[char_key].upper().replace('PLAYER','P')}_{fa_name}.png")
        if os.path.exists(p):
            avail[game_name] = p
    if not avail:
        print(f"  !! {char_key}: 시트 없음")
        return 0, 0

    # 공통 앵커 창 — 본체 애니메이션만으로 계산
    #  `atk4`(Attack4)는 검기 이펙트가 87px 까지 뻗어 창을 오염시키고, 게임에서 쓰지 않는다.
    #  `dead`/`appear`/`vfx` 는 폭발 연출이라 동일하게 제외한다(union_bbox 내부에서 처리).
    anchor_src = {k: v for k, v in avail.items() if k != "atk4"}
    ub = union_bbox(list(anchor_src.values()))
    if not ub:
        ub = union_bbox(list(avail.values()))
    if not ub:
        return 0, 0
    cx0, cy0, cx1, cy1 = ub
    cw, chh = cx1 - cx0, cy1 - cy0
    # 창 크기는 내용에 맞춰 늘린다. 억지로 64 로 줄이면 잘린다(화질·실루엣 손실).
    win_w = max(OUT_W, cw + 2)
    win_h = max(OUT_H, chh + 2)
    # bottom-center 앵커: 창의 가로 중앙에 캐릭터 중앙, 세로는 바닥 정렬
    pad_x = (win_w - cw) // 2
    pad_y = win_h - chh - 1

    n_total = 0
    n_anim = 0
    for game_name, path in avail.items():
        frames = frames_of(path)
        if not frames:
            continue
        n_anim += 1
        for i, fr in enumerate(frames):
            # 공통 창으로 크롭 (모든 프레임이 같은 좌표계)
            crop = fr.crop((cx0 - pad_x, cy0 - pad_y, cx0 - pad_x + win_w, cy0 - pad_y + win_h))
            # vc224 — 구분자 충돌 방지: `atk` + `2` = `atk2` 가 되어 `atk2` 애니메이션과
            #  섞인다(atk20 이 atk 2번째인지 atk2 0번째인지 모호). 밑줄을 하나 더 둔다.
            out_name = f"fa_{char_key}_{game_name}__{i}.png"
            if not dry:
                d = os.path.join(OUT_ROOT, char_key)
                os.makedirs(d, exist_ok=True)
                crop.save(os.path.join(d, out_name))
            n_total += 1

    print(f"  {char_key}: {n_anim}애니메이션 / {n_total}프레임  "
          f"앵커창 {win_w}x{win_h} (내용 {cw}x{chh})")
    return n_anim, n_total


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print(f"출력 캔버스 목표 {OUT_W}x{OUT_H} (내용이 크면 확장)")
    a = f = 0
    for k in CHARS:
        na, nf = build(k, args.dry_run)
        a += na; f += nf
    print(f"\n합계: {a}애니메이션 / {f}프레임")
    if args.dry_run:
        print("(dry-run — 파일을 쓰지 않았다)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
