#!/usr/bin/env python3
"""v1.2.1 (#1 치장위치) — 어태치 장식 앵커 테이블 생성.

문제: 왕관/리본/후광/날개가 고정 픽셀 오프셋으로 붙어서 시트별 머리 높이가 다르면
      (여캠 긴머리+아호게, 직업 시트, GM 등) 위치가 어긋난다 — "위치가 이상해"의 원인.

해법: 모든 바디 시트 프레임 96x64의 알파를 스캔해 프레임별 앵커를 산출한다.
  ht = 머리 꼭대기 y (중앙 열 x38..58에서 최초 불투명 픽셀)
  hl, hr = 머리 영역(ht..ht+10 행)의 머리 좌/우 경계 x
  feet = 발바닥 y (전체 불투명 최대 y)
출력: src/game/acc_anchors.ts — Record<string, [ht, hl, hr, feet]>, 키 = "<prefix>_<frame>"
플레이어 origin은 center(48,32) — WorldScene이 player.y + (an[0]-32) 형태로 사용.
"""
import os

from PIL import Image

SRC = "public/assets"
BODY_PREFIXES = [
    "chm0", "chm1", "chm3", "chm4", "chm5",
    "chf0", "chf1", "chf2", "chf3", "chf4", "chf5",
] + [f"cost_{k}" for k in ["royal", "shadow", "spring", "navy", "silver", "crimson", "seraph", "abyss", "nightmare", "gilded"]] \
  + [f"costm_{k}" for k in ["royal", "shadow", "spring", "navy", "silver", "crimson", "seraph", "abyss", "nightmare", "gilded"]] \
  + [f"jobf_{k}" for k in ["berserker", "guardian", "sniper", "windrunner", "archmage", "sage", "assassin", "swashbuckler"]] \
  + [f"jobm_{k}" for k in ["berserker", "guardian", "sniper", "windrunner", "archmage", "sage", "assassin", "swashbuckler"]] \
  + ["gm"]

FRAME_PARTS = ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]


def scan(path):
    im = Image.open(path).convert("RGBA")
    if im.size != (96, 64):
        return None
    px = im.load()
    # 머리 꼭대기: 중앙 열대(x38..58)에서 최초 불투명
    ht = None
    for y in range(64):
        for x in range(38, 59):
            if px[x, y][3] > 0:
                ht = y
                break
        if ht is not None:
            break
    if ht is None:
        return None
    # 머리 영역 좌우 경계 (ht..ht+10)
    hl, hr = None, None
    for y in range(ht, min(64, ht + 11)):
        for x in range(96):
            if px[x, y][3] > 0:
                if hl is None or x < hl:
                    hl = x
                if hr is None or x > hr:
                    hr = x
    feet = 0
    for y in range(63, -1, -1):
        if any(px[x, y][3] > 0 for x in range(96)):
            feet = y
            break
    return (ht, hl if hl is not None else 38, hr if hr is not None else 58, feet)


def main():
    entries = {}
    made = 0
    for p in BODY_PREFIXES:
        for part in FRAME_PARTS:
            for i in range(4):
                key = f"{p}_{part}{i}"
                path = f"{SRC}/{key}.webp"
                if not os.path.exists(path):
                    continue
                r = scan(path)
                if r:
                    entries[key] = r
                    made += 1
        # hero 원본 (prefix "" 기본형)
    for part in FRAME_PARTS:
        for i in range(4):
            key = f"hero_{part}{i}"
            path = f"{SRC}/{key}.webp"
            if os.path.exists(path):
                r = scan(path)
                if r:
                    entries[key] = r
                    made += 1

    lines = [
        "/* v1.2.1 (#1 치장위치) — 바디 시트 프레임별 앵커 테이블 (scripts/gen_acc_anchors.py 산출).",
        " *  [머리꼭대기y, 머리좌경계x, 머리우경계x, 발y] — 96x64 프레임, origin center(48,32) 기준.",
        " *  왕관/리본/후광/날개가 시트별 실루엣에 정확히 붙도록 한다. */",
        "export const ACC_ANCHORS: Record<string, [number, number, number, number]> = {",
    ]
    for k in sorted(entries):
        ht, hl, hr, feet = entries[k]
        lines.append(f'  "{k}": [{ht}, {hl}, {hr}, {feet}],')
    lines.append("};")
    lines.append("")
    with open("src/game/acc_anchors.ts", "w") as fp:
        fp.write("\n".join(lines))
    print(f"anchors: {made} frames, {len(entries)} keys -> src/game/acc_anchors.ts")


if __name__ == "__main__":
    main()
