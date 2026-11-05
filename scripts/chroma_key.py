#!/usr/bin/env python3
"""크로마키 배경 제거 — 마젠타(#FF00FF) 전용.

[왜 크로마키인가]
  지금까지 남색 배경을 색 거리로 지우려다 세 번 실패했다:
   · v1 tol26  → 그라데이션 배경이 남아 사각형 테두리
   · v2 tol52  → 어두운 옷까지 먹어 캐릭터 소실(불투명 0~8%)
   · v4 모서리별 → feron/haru/iris 는 배경과 옷이 같은 남색이라 원리적으로 분리 불가
  남색 배경 + 남색 옷은 **색으로 구분할 수 없다**. 그래서 생성 프롬프트에
  "solid magenta background" 를 넣어 **캐릭터에 없는 색**으로 뽑고,
  그 색만 지운다. 마젠타는 피부·금색·남색·보라 어디에도 가깝지 않아 안전하다.

[동작]
  ① 마젠타 판정: R>150, B>150, G<110 (R·B 는 높고 G 는 낮은 색)
  ② 테두리 플러드필로 연결된 마젠타만 제거(캐릭터 내부 보라색 보석 보존)
  ③ 가장자리 1px 정리 — 마젠타 반투명 잔여물 제거
  ④ 다운스케일 → 팔레트 제한 → NEAREST 확대

사용: python3 scripts/chroma_key.py [key ...]
"""
import glob
import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "public/assets/npcportrait/_raw")
OUT = os.path.join(ROOT, "public/assets/npcportrait")
SIZE = 84
COLORS = 48


def is_magenta(r, g, b):
    """마젠타 판정 — **HSV 색상환** 기준.

    [왜 RGB 임계값으로 안 되는가 — 실측]
      프롬프트에 `#FF00FF` 를 넣어도 모델은 순수 마젠타를 안 준다. 실제로 나온 배경:
        cartel (187,37,88) / jade (186,42,96) / ran (185,39,117) / ihyun (200,47,124)
      전부 **핑크~마젠타 계열**이지만 B 가 88~124 라 종전 조건(`b>150`)을 못 넘겼다.
      → 색상환(H) 으로 판정해야 한다. 핑크·마젠타는 H 290~350 에 모인다.

    [안전 범위]
      · 라일락 머리 (200,180,220) → S=0.18 (임계 0.35 미만) → 제외 ✓
      · 보라 보석 (120,60,180) → H=270 (290 미만) → 제외 ✓
      · 금색 (220,180,60) → H=45 → 제외 ✓
      · 피부 (240,200,180) → H=20 → 제외 ✓
      붉은 옷(180,30,80)은 H≈340 으로 걸릴 수 있으나, 플러드필이 **테두리 연결**만
      지우므로 캐릭터 내부는 안전하다."""
    import colorsys
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    return 290 <= hd <= 350 and s >= 0.35 and v >= 0.15


def key_out(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    removed = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if a > 8 and not is_magenta(r, g, b):
            continue
        px[x, y] = (0, 0, 0, 0)
        removed += 1
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))

    # 가장자리 정리 — 마젠타와 섞인 반투명 픽셀(프린지) 제거
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # 이웃 4방 중 3개 이상이 투명이면 테두리 → 살짝 깎는다
            n = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] == 0:
                    n += 1
            if n >= 3 and (r > 130 and b > 130 and g < 130):
                # 마젠타 기운이 남은 테두리 픽셀만 제거(캐릭터 색은 보존)
                px[x, y] = (0, 0, 0, 0)
    return im, removed / (w * h)


def pixelize(im, dst):
    small = im.resize((SIZE, SIZE), Image.LANCZOS)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
    small = rgb.convert("RGBA")
    small.putalpha(alpha)
    sp = small.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = sp[x, y]
            sp[x, y] = (0, 0, 0, 0) if a < 96 else (r, g, b, 255)
    small.save(dst)


def opaque_ratio(path):
    im = Image.open(path).convert("RGBA")
    a = im.split()[3]
    return sum(1 for v in a.get_flattened_data() if v > 0) / (im.width * im.height)


def main():
    keys = [a for a in sys.argv[1:] if not a.startswith("-")]
    raws = sorted(glob.glob(os.path.join(RAW, "npc_*_raw.png")))
    for r in raws:
        key = os.path.basename(r).replace("npc_", "").replace("_raw.png", "")
        if keys and key not in keys:
            continue
        dst = os.path.join(OUT, f"npc_{key}.png")
        im, rem = key_out(Image.open(r))
        pixelize(im, dst)
        print(f"  {key:12s} 마젠타 제거 {rem:5.1%} → 불투명 {opaque_ratio(dst):5.1%}")


if __name__ == "__main__":
    main()
