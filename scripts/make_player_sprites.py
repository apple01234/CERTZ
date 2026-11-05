#!/usr/bin/env python3
"""플레이어 기본 외형 스프라이트 생성 — npcbody 규격 준수 (지시 #7).

[문제]
기본 남캐(FA 아틀라스 `fa/p1.png` 의 idle 프레임)가 64×85 프레임에 캐릭터 **18×36px** 이고,
실제로는 사람이 아니라 **청보라색 외계 생물**로 보인다:
  · 큰 원형 머리 + 1px 촉수형 팔다리 + 노란 사각 눈 2개
  · 목·어깨·몸통·골반 구조가 없고, 코·입·귀·머리카락·의상이 전혀 없다
  · 배경과 외곽선 명도가 붙어 실루엣이 묻힌다
`ch{m|f}{skin}` 세트도 96×64 에 캐릭터 26~28×40~42px 로, 같은 계열의 저해상도다.

[기준] NPC 본체(`npcbody_*`)는 75×72 에 캐릭터 ~68px, 2.2등신
(머리 30px / 몸통 24px / 다리 14px), 15색 이내, 선택적 아웃라인, 하드엣지 셀셰이딩.
플레이어만 품질이 낮은 것이 문제였으므로 **NPC 와 같은 규격·기법**으로 그린다.

[차별화 규칙] NPC 는 탁한 팔레트, 플레이어는 화면에서 가장 먼저 눈에 띄는 팔레트.
  · 남캐: 짙은 청록 튜닉 + 금색 포인트, 검은 머리, 붉은 망토
  · 여캐: 자주빛 로브 + 금색 포인트, 밤색 머리, 긴 치맛자락

[출력] public/assets/player/m_idle0.png … f_idle0.png (75×72, 투명 배경)
사용: python3 scripts/make_player_sprites.py
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/player")

# ── 캔버스 (npcbody 와 동일) ─────────────────────────────────────────────
W, H = 75, 72
FEET_Y = H - 3            # 발바닥을 바닥에서 2~3px 띄운다

# ── 팔레트 (소재당 2~3톤, 하드엣지) ──────────────────────────────────────
P = {
    "m": {
        "skin":    "#f0d3ad", "skin_sh": "#c9a377",
        "hair":    "#2b2430", "hair_hi": "#463a4e",
        "tunic":   "#1f6f6b", "tunic_sh": "#154b48", "tunic_hi": "#2f948e",
        "trim":    "#d9a63c", "trim_sh": "#a97c22",
        "pants":   "#2c2a35", "pants_sh": "#1c1b23",
        "boot":    "#6d4327", "boot_sh": "#4a2c19",
        "cape":    "#8e2f34", "cape_sh": "#5f1e22",
        "outline": "#141019",
        "eye":     "#241b2b", "eye_hi": "#f4f6ff",
    },
    "f": {
        "skin":    "#f5dcbb", "skin_sh": "#d0ae86",
        "hair":    "#5b2b3a", "hair_hi": "#8a4358",
        "robe":    "#6b3a72", "robe_sh": "#48274d", "robe_hi": "#8e5295",
        "trim":    "#e2b955", "trim_sh": "#b08c2e",
        "skirt":   "#4d2a57", "skirt_sh": "#341c3b",
        # [개선] 여캐 다리-신발 명도차 부족 지적 -> 다리를 밝히고 신발을 더 어둡게
        "leg":     "#d9a883", "leg_sh": "#b08462",
        "boot":    "#2e1a22", "boot_sh": "#1d1016",
        "cape":    "#3d6f8e", "cape_sh": "#28506a",
        "outline": "#170f1d",
        "eye":     "#2b1f33", "eye_hi": "#f7f9ff",
    },
}


class Canvas:
    """픽셀 단위 그리기 헬퍼 — 좌표는 (x, y) 정수."""

    def __init__(self, c):
        self.c = c
        self.img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.px = self.img.load()

    def dot(self, x, y, key):
        if 0 <= x < W and 0 <= y < H:
            r, g, b = (int(self.c[key][i:i + 2], 16) for i in (1, 3, 5))
            self.px[x, y] = (r, g, b, 255)

    def rect(self, x0, y0, x1, y1, key):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, key)

    def hline(self, x0, x1, y, key):
        for x in range(x0, x1 + 1):
            self.dot(x, y, key)

    def vline(self, x, y0, y1, key):
        for y in range(y0, y1 + 1):
            self.dot(x, y, key)

    def ellipse(self, cx, cy, rx, ry, key):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx) / max(1, rx)
                dy = (y - cy) / max(1, ry)
                if dx * dx + dy * dy <= 1.0:
                    self.dot(x, y, key)


def draw_head(cv, g, cx, top):
    """머리: 폭 30, 높이 26 (npcbody 비율 — 전체의 약 40%)."""
    # 후광(헤어 볼륨) — 머리카락 덩어리를 실루엣보다 1px 크게
    cv.ellipse(cx, top + 13, 16, 14, "outline")
    cv.ellipse(cx, top + 13, 15, 13, "hair")
    # 얼굴 — 납작한 크림 면(폭>높이)
    cv.rect(cx - 10, top + 10, cx + 10, top + 23, "skin")
    # 얼굴 그늘(턱 아래)
    cv.hline(cx - 9, cx + 9, top + 24, "skin_sh")
    # 앞머리 — 이마를 덮는 머리카락
    cv.rect(cx - 11, top + 6, cx + 11, top + 11, "hair")
    cv.hline(cx - 8, cx + 8, top + 12, "hair_hi")
    # 옆머리 (어깨까지)
    cv.vline(cx - 13, top + 8, top + 22, "hair")
    cv.vline(cx + 13, top + 8, top + 22, "hair")
    cv.vline(cx - 14, top + 9, top + 19, "hair_sh" if False else "hair")
    cv.vline(cx + 14, top + 9, top + 19, "hair")
    # 정수리 뾰족 포인트 1개 (npcbody 스타일)
    cv.dot(cx - 2, top - 1, "hair")
    cv.dot(cx - 1, top - 2, "hair")
    cv.dot(cx, top - 1, "hair")
    # 귀
    cv.dot(cx - 11, top + 17, "skin")
    cv.dot(cx + 11, top + 17, "skin")
    # 눈 — 2×2, 눈꺼풀 1px
    for ex in (cx - 6, cx + 3):
        cv.rect(ex, top + 15, ex + 1, top + 16, "eye")
        cv.dot(ex, top + 15, "eye_hi")
    # 눈썹 (남캐는 굵게, 여캐는 얇게)
    if g == "m":
        cv.hline(cx - 7, cx - 4, top + 13, "hair")
        cv.hline(cx + 3, cx + 6, top + 13, "hair")
    else:
        cv.hline(cx - 7, cx - 5, top + 13, "hair")
        cv.hline(cx + 4, cx + 6, top + 13, "hair")
    # 코
    cv.dot(cx - 1, top + 18, "skin_sh")
    # 입
    cv.hline(cx - 2, cx + 1, top + 21, "outline")


def draw_body(cv, g, cx, y0):
    """몸통 24px — 어깨선·허리·장식."""
    tunic = "tunic" if g == "m" else "robe"
    tunic_sh = "tunic_sh" if g == "m" else "robe_sh"
    tunic_hi = "tunic_hi" if g == "m" else "robe_hi"
    # 목
    cv.rect(cx - 3, y0, cx + 3, y0 + 1, "skin_sh")
    # 어깨~허리 (폭 22 → 18 로 좁아지는 사다리꼴)
    for i in range(20):
        half = 11 - (i * 3) // 20
        cv.hline(cx - half, cx + half, y0 + 2 + i, tunic)
    # 어깨 하이라이트 / 옆구리 그늘
    cv.hline(cx - 10, cx - 6, y0 + 3, tunic_hi)
    cv.vline(cx - 11, y0 + 3, y0 + 10, tunic)
    cv.vline(cx + 11, y0 + 3, y0 + 10, tunic)
    cv.vline(cx - 9, y0 + 12, y0 + 20, tunic_sh)
    cv.vline(cx + 8, y0 + 12, y0 + 20, tunic_sh)
    # 가슴 장식(금색 트림 V)
    for i in range(5):
        cv.dot(cx - 5 + i, y0 + 5 + i, "trim")
        cv.dot(cx + 5 - i, y0 + 5 + i, "trim")
    # 벨트
    cv.hline(cx - 9, cx + 9, y0 + 20, "trim_sh")
    cv.hline(cx - 9, cx + 9, y0 + 21, "trim")
    cv.rect(cx - 2, y0 + 20, cx + 2, y0 + 21, "trim_sh")
    # 망토(한쪽 어깨) — 실루엣 차별화
    cv.vline(cx - 12, y0 + 4, y0 + 19, "cape")
    cv.vline(cx - 13, y0 + 6, y0 + 16, "cape_sh")
    return y0 + 22


def draw_arms(cv, g, cx, y0, y1):
    """팔 — 어깨에서 시작해 손까지. 5~6px 굵기(npcbody 규칙)."""
    tunic = "tunic" if g == "m" else "robe"
    tunic_sh = "tunic_sh" if g == "m" else "robe_sh"
    for side in (-1, 1):
        ax = cx + side * 12
        # 상완 (소매)
        cv.rect(ax - 2, y0 + 3, ax + 2, y0 + 10, tunic)
        cv.vline(ax + side * 2, y0 + 4, y0 + 10, tunic_sh)
        # 소매 끝 트림
        cv.hline(ax - 2, ax + 2, y0 + 11, "trim")
        # 전완 (피부)
        cv.rect(ax - 2, y0 + 12, ax + 2, y0 + 16, "skin")
        cv.vline(ax + side * 2, y0 + 12, y0 + 16, "skin_sh")
        # 손 — 1px 어두운 마감으로 "끝"을 명확히
        cv.rect(ax - 2, y0 + 17, ax + 2, y0 + 19, "skin")
        cv.hline(ax - 2, ax + 2, y0 + 20, "skin_sh")


def draw_legs(cv, g, cx, y0):
    """다리 14px + 부츠, 좌우 간격으로 분리."""
    for side in (-1, 1):
        lx = cx + side * 5
        if g == "m":
            pants, pants_sh = "pants", "pants_sh"
        else:
            # [개선] 여캐는 살색 다리 + 아주 어두운 신발로 명도차 확보(발이 묻히지 않게)
            pants, pants_sh = "leg", "leg_sh"
        # 허벅지
        cv.rect(lx - 3, y0, lx + 3, y0 + 7, pants)
        cv.vline(lx + side * 3, y0, y0 + 7, pants_sh)
        # 정강이
        cv.rect(lx - 3, y0 + 8, lx + 3, y0 + 12, pants_sh if g == "m" else pants)
        # 부츠
        cv.rect(lx - 3, y0 + 13, lx + 3, y0 + 16, "boot")
        cv.hline(lx - 3, lx + 3, y0 + 16, "boot_sh")
        # 발 — 바닥 쪽으로 1px 확장
        cv.hline(lx - 4, lx + 3, y0 + 17, "boot_sh")
    if g == "f":
        # 치맛자락 — 다리 위를 덮어 여캐 실루엣 차별화
        for i in range(6):
            half = 11 + i // 2
            cv.hline(cx - half, cx + half, y0 + i, "skirt")
        cv.hline(cx - 12, cx + 12, y0 + 6, "skirt_sh")


def build(g):
    c = P[g]
    cv = Canvas(c)
    cx = W // 2
    head_top = 2
    head_h = 26
    body_y = head_top + head_h            # 몸통 시작
    body_end = draw_body(cv, g, cx, body_y)
    draw_arms(cv, g, cx, body_y, body_end)
    draw_legs(cv, g, cx, body_end)
    draw_head(cv, g, cx, head_top)
    # npcbody 규칙: 밝은 실루엣에만 검은 1px 아웃라인 → 몸통 좌우 어깨선에만
    for y in range(body_y + 3, body_end):
        for x in (cx - 12, cx + 12):
            if cv.px[x, y][3] == 0:
                cv.dot(x, y, "outline")
    return cv.img


def main():
    os.makedirs(OUT, exist_ok=True)
    for g in ("m", "f"):
        img = build(g)
        bb = img.getbbox()
        assert bb, f"{g}: 빈 이미지"
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        print(f"{g}: 캐릭터 {w}x{h} (캔버스 {W}x{H}) — 머리비 {26/h:.0%}")
        p = os.path.join(OUT, f"{g}_idle0.png")
        img.save(p)
        print(f"  → {p}")


if __name__ == "__main__":
    main()
