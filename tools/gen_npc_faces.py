"""SERTZ 대사창 전용 NPC 얼굴 생성기 — 절차 생성, 외부 이미지 0장.

왜 필요한가 (실측)
  기존 대사창은 맵용 `spum_*.webp`(96×96)를 80×80 프레임에 `object-cover object-top`
  으로 잘라 쓴다. 원본 얼굴 영역이 3~5px 뿐이라 **눈을 그릴 픽셀이 없다.**
  실측 결과 5개 중 4개가 눈 없는 살구색 블록으로, 대사창에서 "얼굴 없는 마네킹"으로 보였다.

설계
  · 32×32 논리 도트 → 4배(128×128) 출력. 56px(모바일)·80px(PC) 프레임에서 또렷하다.
  · 눈은 최소 2px + 흰 하이라이트 1px. 눈이 얼굴 인식의 핵심이므로 절대 생략하지 않는다.
  · 표정 3종(neutral/happy/angry) — 대사 감정에 대응할 수 있게.
  · 기사는 투구 콘셉트를 유지하되 **바이저 틈으로 빛나는 눈**을 노출한다.

저작권: 입력은 수치(팔레트)뿐. 색은 SERTZ 자체 에셋에서 실측했다.

출력: public/assets/npcface/<kind>_<expr>.png
사용: python3 tools/gen_npc_faces.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("public/assets/npcface")
S = 32          # 논리 해상도
SCALE = 4       # 128×128

INV = "#0b0d16"  # 외곽선


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# 종족/직업별 팔레트 — SERTZ 기존 에셋 실측 톤 계승
KINDS = {
    "merchant": {"skin": "#e8c59f", "shade": "#bb7c47", "hair": "#8a8078", "hair2": "#5d554e",
                 "cloth": "#8b5a2b", "cloth2": "#5c3a1a", "acc": "#f0c060"},
    "knight":   {"skin": "#e8c59f", "shade": "#bb7c47", "hair": "#6b7280", "hair2": "#3f4650",
                 "cloth": "#7d8ba1", "cloth2": "#4a545f", "acc": "#ffd98a"},
    "mage":     {"skin": "#f8e0c6", "shade": "#d9b394", "hair": "#9a6fd0", "hair2": "#6a3fa0",
                 "cloth": "#6a3fa0", "cloth2": "#452669", "acc": "#c4b5fd"},
    "elf":      {"skin": "#f8e0c6", "shade": "#d9b394", "hair": "#d8ac54", "hair2": "#a67b2e",
                 "cloth": "#2f7a4f", "cloth2": "#1c4e31", "acc": "#a7f3d0"},
    "villager_m": {"skin": "#c1ac8f", "shade": "#8e5e36", "hair": "#573a23", "hair2": "#402717",
                 "cloth": "#7a6a52", "cloth2": "#4d4132", "acc": "#fcd34d"},
    "villager_f": {"skin": "#f8e0c6", "shade": "#d9b394", "hair": "#a83a3a", "hair2": "#732222",
                 "cloth": "#c86a8a", "cloth2": "#8a4058", "acc": "#fcd34d"},
    "smith":    {"skin": "#c1ac8f", "shade": "#8e5e36", "hair": "#4a4038", "hair2": "#2b241e",
                 "cloth": "#4a4458", "cloth2": "#2e2a38", "acc": "#ffb080"},
    "priest":   {"skin": "#f8e0c6", "shade": "#d9b394", "hair": "#d8dce8", "hair2": "#9aa2b4",
                 "cloth": "#c8b06a", "cloth2": "#8f7c42", "acc": "#fff0b8"},
}


def draw_face(kind: str, expr: str) -> Image.Image:
    """32×32 얼굴 1장. expr: neutral | happy | angry"""
    p = KINDS[kind]
    sb, ss = rgb(p["skin"]), rgb(p["shade"])
    hb, hs = rgb(p["hair"]), rgb(p["hair2"])
    cb, cs = rgb(p["cloth"]), rgb(p["cloth2"])
    ac = rgb(p["acc"])
    iv = rgb(INV)
    W = "#ffffff"

    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = S // 2

    # ── 어깨/옷깃 (하단) ───────────────────────────────────────────
    d.rectangle([3, 27, 28, 31], fill=cb)
    d.rectangle([3, 27, 8, 31], fill=cs)
    # 옷깃 V자
    d.polygon([(cx - 5, 27), (cx + 4, 27), (cx, 30)], fill=cs)
    d.line([(cx - 5, 27), (cx, 30)], fill=ac)
    d.line([(cx + 4, 27), (cx, 30)], fill=ac)

    # ── 목 ────────────────────────────────────────────────────────
    d.rectangle([cx - 3, 24, cx + 2, 27], fill=ss)

    # ── 얼굴 ──────────────────────────────────────────────────────
    # 기사는 투구가 얼굴을 덮으므로 별도 처리
    helm = kind == "knight"

    if not helm:
        # vc210b — 얼굴이 프레임의 대부분을 차지하게 확대 (7,6,24,26 → 4,3,28,30)
        d.ellipse([4, 3, 28, 30], fill=sb, outline=iv)
        # 볼 음영 (좌측)
        d.arc([5, 6, 27, 30], 100, 250, fill=ss)
        # 턱
        d.line([(10, 27), (22, 27)], fill=ss)

        # ── 눈: 얼굴 인식의 핵심. 3px 폭 + 흰 하이라이트 ──
        # vc210b — 눈을 2×2 + 하이라이트로 확대 (1~2px 점 → 판독 가능)
        eye_y = 16
        for side, ex in ((-1, 11), (1, 20)):
            if expr == "happy":
                d.line([(ex - 2, eye_y + 2), (ex - 1, eye_y), (ex, eye_y), (ex + 1, eye_y + 2)], fill=iv)
            elif expr == "angry":
                # vc211b — 눈을 가늘게(1px 높이) + 눈썹을 코쪽으로 강하게 눌러 그린다.
                d.rectangle([ex - 1, eye_y + 1, ex + 1, eye_y + 2], fill=iv)
                # 눈썹: 바깥은 높고 안쪽(코)은 낮게 → 화난 인상의 핵심 신호
                d.line([(ex - side * 3, eye_y - 3), (ex + side * 2, eye_y - 1)], fill=iv, width=1)
                d.line([(ex - side * 3, eye_y - 2), (ex + side * 2, eye_y)], fill=iv, width=1)
            else:
                d.rectangle([ex - 1, eye_y, ex + 1, eye_y + 2], fill=iv)
                d.rectangle([ex - 1, eye_y, ex, eye_y], fill=W)   # 하이라이트 2px
        # 눈썹 (중립)
        if expr != "angry":
            for ex in (12, 19):
                d.line([(ex - 2, eye_y - 3), (ex + 2, eye_y - 3)], fill=hs)

        # ── 코 ──
        d.line([(cx, 20), (cx, 22)], fill=ss)

        # ── 입 ──
        my = 24
        if expr == "happy":
            d.line([(cx - 3, my), (cx + 2, my)], fill=iv)
            d.point((cx - 4, my - 1), fill=ss)
            d.point((cx + 3, my - 1), fill=ss)
        elif expr == "angry":
            # vc211c — 입을 **아래로 처진 frown**(가운데가 내려감)으로. 볼 홍조는
            # "부끄러움"으로 오독되므로 제거하고, 만화식 분노 기호(💢)를 머리 옆에 둔다.
            d.line([(cx - 3, my), (cx + 2, my)], fill=iv)          # 입꼬리 양끝
            d.line([(cx - 2, my + 1), (cx + 1, my + 1)], fill=iv)  # 가운데 내려감
            # 분노 기호 — 십자 혈관 2×2
            gx, gy = 25, 6
            d.line([(gx, gy), (gx, gy + 1)], fill=rgb("#d94a4a"))
            d.line([(gx + 1, gy), (gx + 1, gy + 1)], fill=rgb("#d94a4a"))
            d.point((gx, gy + 2), fill=rgb("#d94a4a"))
            d.point((gx + 1, gy + 2), fill=rgb("#d94a4a"))
        else:
            d.line([(cx - 2, my), (cx + 1, my)], fill=iv)

        # ── 머리카락: 윗머리 + 앞머리(눈 위에서 끊는다) ──
        d.pieslice([3, 1, 29, 20], 180, 360, fill=hb, outline=iv)
        d.arc([5, 2, 27, 14], 200, 300, fill=hs)      # 하이라이트
        # 앞머리 갈래 — y 13 에서 멈춘다 (눈은 y 16)
        for i, fx in enumerate((7, 12, 17, 22)):
            d.line([(fx, 8), (fx + (1 if i % 2 else -1), 13)], fill=hs)
        # 옆머리
        d.rectangle([3, 8, 6, 24], fill=hb, outline=iv)
        d.rectangle([26, 8, 29, 24], fill=hs, outline=iv)
    else:
        # ── 기사: 투구 + 바이저 틈으로 빛나는 눈 ──
        d.ellipse([3, 1, 29, 31], fill=cb, outline=iv)
        d.arc([4, 2, 28, 22], 200, 320, fill=rgb("#a8b4c8"))
        # 바이저 띠 — 넓게
        d.rectangle([5, 14, 27, 20], fill=cs, outline=iv)
        # 틈으로 보이는 눈 (발광) — 2×2 + 글로우
        for ex in (11, 20):
            d.rectangle([ex - 2, 16, ex + 1, 18], fill=iv)
            d.rectangle([ex - 1, 16, ex, 17], fill=ac)
            d.point((ex - 2, 16), fill=ac)
        # 콧대
        d.line([(cx, 20), (cx, 24)], fill=cs)
        # 턱 보호구
        d.rectangle([9, 24, 23, 28], fill=cs, outline=iv)
        d.line([(cx - 5, 26), (cx + 4, 26)], fill=iv)
        # 투구 볼륨
        d.arc([3, 1, 29, 18], 190, 300, fill=rgb("#b8c4d8"))

    # ── 종족/직업 액센트 ──
    if kind == "elf":
        # 뾰족 귀
        d.polygon([(6, 15), (2, 11), (7, 18)], fill=sb, outline=iv)
        d.polygon([(25, 15), (29, 11), (24, 18)], fill=ss, outline=iv)
    if kind == "mage":
        # 모자 챙
        d.polygon([(4, 9), (27, 9), (23, 4), (8, 4)], fill=rgb("#452669"), outline=iv)
        d.line([(5, 9), (26, 9)], fill=ac)
    if kind == "priest":
        # 후광
        d.ellipse([10, 0, 21, 4], outline=ac)
    if kind == "smith":
        # 앞치마 끈
        d.line([(9, 28), (11, 31)], fill=cs)
        d.line([(22, 28), (20, 31)], fill=cs)
    if kind == "merchant":
        # 두건
        d.polygon([(5, 12), (26, 12), (24, 7), (7, 7)], fill=cs, outline=iv)

    return im


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for kind in KINDS:
        for expr in ("neutral", "happy", "angry"):
            im = draw_face(kind, expr)
            big = im.resize((S * SCALE, S * SCALE), Image.NEAREST)
            p = OUT / f"{kind}_{expr}.png"
            big.save(p)
            a = im.getchannel("A")
            opaque = sum(1 for v in a.get_flattened_data() if v > 0)
            print(f"  {kind:11s} {expr:8s} 불투명 {opaque:>4}px → {big.size}")
            n += 1
    print(f"\n생성 {n}장 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
