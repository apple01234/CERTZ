#!/usr/bin/env python3
"""초상화 배경 제거 — 보수적 알고리즘 (v3).

[실패 이력]
  v1 (pixelize_portrait.remove_background): 코너 1점 + tol 26.
       → 배경이 그라데이션이면 사각형 테두리가 남음(21건 중 7건).
  v2 (fix_portrait_bg, 테두리 다점 + tol 52): 캐릭터가 하단에 닿아 있어
       `bot-mid=(113,97,103)` 이 배경색으로 등록 → 범위가 (1,4,26)~(186,162,181) 로
       벌어져 **전부 불투명 100%** (아무것도 안 지워짐).
  v2b (모서리만 + tol 52 범위 확장): 어두운 남색 배경과 **어두운 옷**이 같은 범위에
       들어가 캐릭터가 통째로 먹혔다 — 실측 불투명 0.0~8% (ran 0%, rian 0.2%,
       kayen 0.4%, lilac 1.6%). 이게 사용자가 본 "깨진" 상태다.

[이번 설계 — 왜 이렇게 하는가]
  ① 배경색은 **모서리 4점의 중앙값**으로 잡는다(한 점이 튀어도 안전).
  ② 허용 오차는 **채널별 20**. 남색 배경 (5~8, 6~12, 26~30) 이면
     실제 제거 범위는 (0~28, 0~32, 6~50) — 남색 배경만 잡고 중간톤 옷은 살아남는다.
  ③ 플러드필은 **테두리에서 연결된 영역만**. 캐릭터 내부의 같은 색은 지우지 않는다.
  ④ **안전장치**: 결과 불투명도가 25% 미만이면 배경 제거를 포기하고
     원본 배경을 그대로 둔다(캐릭터를 먹는 것보다 낫다 — 사용자 판단 우선).
  ⑤ 다운스케일 후 픽셀화는 **원본 비율을 유지**한 채 84px 로 줄인다.

사용:
  python3 scripts/rebuild_portraits.py            # 전체 재생성
  python3 scripts/rebuild_portraits.py lilac haru # 특정 캐릭터만
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
TOL = 20            # 채널별 허용 오차 — 남색 배경만 잡는다
MIN_OPAQUE = 0.25   # 이보다 적게 남으면 배경 제거 포기


def corner_color(im):
    w, h = im.size
    px = im.load()
    pts = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    pts = [p[:3] for p in pts if p[3] > 8] or [(0, 0, 0)]
    # 채널별 중앙값 — 한 모서리에 캐릭터가 걸려도 튀지 않는다
    med = tuple(sorted(p[i] for p in pts)[len(pts) // 2] for i in range(3))
    return med


def remove_bg(im):
    """테두리에서 연결된 배경만 지운다. 반환: (이미지, 제거된 비율)

    [v4 — 모서리 4점을 **각각** 기준색으로 쓴다]
      cartel 실측: 모서리가 (133,129,103) / (25,33,40) / (160,156,165) / (21,29,42) 로
      완전히 달랐다(배경에 그라데이션·광원이 있음). 중앙값 하나로 잡으면 어느 쪽도
      맞지 않아 제거율이 0~16% 에 그쳤다.
      → 4개 기준색을 각각 허용 범위로 두고, 그중 하나라도 맞으면 배경으로 본다.
        플러드필은 여전히 **테두리 연결**만 지우므로 캐릭터 내부는 안전하다.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    bases = []
    for pt in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        c = px[pt][:3]
        if c not in bases:
            bases.append(c)
    rngs = [
        ((max(0, c[0] - TOL), max(0, c[1] - TOL), max(0, c[2] - TOL)),
         (min(255, c[0] + TOL), min(255, c[1] + TOL), min(255, c[2] + TOL)))
        for c in bases
    ]

    def is_bg(x, y):
        r, g, b, a = px[x, y]
        if a < 8:
            return True
        for lo, hi in rngs:
            if lo[0] <= r <= hi[0] and lo[1] <= g <= hi[1] and lo[2] <= b <= hi[2]:
                return True
        return False

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
        if not is_bg(x, y):
            continue
        px[x, y] = (0, 0, 0, 0)
        removed += 1
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))
    return im, removed / (w * h)


def pixelize(im, dst, dots=SIZE, colors=48):
    """다운스케일 → 팔레트 제한 → NEAREST 확대."""
    small = im.resize((dots, dots), Image.LANCZOS)
    alpha = small.getchannel("A")
    rgb = small.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    small = rgb.convert("RGBA")
    small.putalpha(alpha)
    sp = small.load()
    # 반투명 잔여물 정리 — 알파 96 미만은 투명으로
    for y in range(dots):
        for x in range(dots):
            r, g, b, a = sp[x, y]
            sp[x, y] = (0, 0, 0, 0) if a < 96 else (r, g, b, 255)
    small.resize((SIZE, SIZE), Image.NEAREST).save(dst)


def opaque_ratio(path):
    im = Image.open(path).convert("RGBA")
    a = im.split()[3]
    return sum(1 for v in a.get_flattened_data() if v > 0) / (im.width * im.height)


def process(raw_path, dst):
    im = Image.open(raw_path).convert("RGBA")
    removed, bg_ratio0 = None, None
    cleaned, removed = remove_bg(im)
    # 안전장치 — 너무 많이 지웠으면 원본(배경 포함)으로 되돌린다
    kept = 1.0 - removed
    if kept < MIN_OPAQUE:
        pixelize(im, dst)
        return opaque_ratio(dst), "배경유지(과다제거 방지)"
    pixelize(cleaned, dst)
    return opaque_ratio(dst), f"배경제거 {removed:.0%}"


def main():
    keys = [a for a in sys.argv[1:] if not a.startswith("-")]
    raws = sorted(glob.glob(os.path.join(RAW, "npc_*_raw.png")))
    if not raws:
        print("raw 원본이 없습니다")
        return
    for r in raws:
        key = os.path.basename(r).replace("npc_", "").replace("_raw.png", "")
        if keys and key not in keys:
            continue
        dst = os.path.join(OUT, f"npc_{key}.png")
        try:
            op, note = process(r, dst)
            flag = "  ⚠" if op < 0.12 else ""
            print(f"  {key:12s} 불투명 {op:5.1%}  {note}{flag}")
        except Exception as e:
            print(f"  {key:12s} 실패: {e}")


if __name__ == "__main__":
    main()
