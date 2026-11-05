#!/usr/bin/env python3
"""플레이어 기본 외형 전신 세트 생성 — npcbody 규격 (지시 #7).

[왜 이 스크립트가 필요한가]
기본 남캐는 `bodyPrefix=""` → FA 아틀라스(`fa/p1.png` idle 프레임)를 쓴다.
그 프레임은 64×85 안에 캐릭터가 **18×36px** 이고, 실제로는 사람이 아니라
"청보라색 외계 생물"(큰 원형 머리 + 1px 촉수 팔다리 + 노란 사각 눈)로 보인다.
`ch{m|f}{skin}` 세트도 96×64 에 26~28×40~42px 로 같은 계열의 저해상도다.
반면 NPC 본체(`npcbody_*`)는 75×72 에 캐릭터 ~68px, 2.2등신으로 훨씬 상세하다.
→ **플레이어만 품질이 낮은 것**이 문제였으므로 NPC와 같은 규격·기법으로 다시 그린다.

[출력 규격] 기존 `{prefix}_{anim}{i}.png` 체계를 그대로 따른다(96×64 캔버스, 발밑 정렬).
  필요한 세트: idle 0-3, walk 0-3, walkup 0-3, walkside 0-3, atk 0-3, atkup 0-3, atkdown 0-3
  접두사: chm2(남 기본) / chf2(여 기본) — `resolveBodyPrefix` 의 기본 피부 인덱스가 2다.

[비율 기준] npcbody 실측: 머리(머리카락 포함) ~30px / 몸통 ~24px / 다리 ~14px, 2.2등신.
  머리 폭은 몸통보다 약간 넓게(실루엣 안정). 목은 생략(치비 관례)하되 어깨선은 만든다.
  얼굴: 눈 2×2 + 하이라이트, 눈썹, 코 1px, 입 1~2px — 이목구비를 실제로 넣는다.

[방향 처리]
  down(정면) : 얼굴 정면, 몸 대칭
  up(뒷모습) : 얼굴 없음, 머리카락 뒤통수 + 망토
  side(측면) : 얼굴 1/2, 팔 하나만 보이게, 다리 스트라이드

사용: python3 scripts/make_player_sprites.py
"""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets")

# ── 캔버스 (기존 hero_* / ch*_* 와 동일 규격) ──────────────────────────────
W, H = 96, 64
CX = W // 2
FEET = H - 4          # 발밑 여백 4px (기존 시트와 동일한 관례)

# ── 팔레트 ────────────────────────────────────────────────────────────────
P = {
    "m": {
        "skin": "#f0d3ad", "skin_sh": "#c9a377", "skin_hi": "#fbe8cc",
        "hair": "#3b3342", "hair_sh": "#241e2a", "hair_hi": "#5c4d63",
        "cloth": "#1f6f6b", "cloth_sh": "#154b48", "cloth_hi": "#2f948e",
        "trim": "#d9a63c", "trim_sh": "#a97c22",
        "pants": "#3a3846", "pants_sh": "#26242f",
        "boot": "#6d4327", "boot_sh": "#4a2c19",
        "cape": "#8e2f34", "cape_sh": "#5f1e22",
        "outline": "#141019", "eye": "#241b2b", "eye_hi": "#f4f6ff",
    },
    "f": {
        "skin": "#f5dcbb", "skin_sh": "#d0ae86", "skin_hi": "#fdeed6",
        "hair": "#5b2b3a", "hair_sh": "#3a1a26", "hair_hi": "#8a4358",
        "cloth": "#6b3a72", "cloth_sh": "#48274d", "cloth_hi": "#8e5295",
        "trim": "#e2b955", "trim_sh": "#b08c2e",
        "pants": "#d9a883", "pants_sh": "#b08462",   # 살색 다리
        "boot": "#2e1a22", "boot_sh": "#1d1016",
        "cape": "#3d6f8e", "cape_sh": "#28506a",
        "outline": "#170f1d", "eye": "#2b1f33", "eye_hi": "#f7f9ff",
    },
}


class Cv:
    def __init__(self, pal):
        self.p = pal
        self.img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def rgb(self, k):
        h = self.p[k].lstrip("#")
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

    def px(self, x, y, k):
        if 0 <= x < W and 0 <= y < H:
            self.img.putpixel((x, y), self.rgb(k))

    def rect(self, x0, y0, x1, y1, k):
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle([x0, y0, x1, y1], fill=self.rgb(k))

    def hline(self, x0, x1, y, k):
        for x in range(x0, x1 + 1):
            self.px(x, y, k)

    def vline(self, x, y0, y1, k):
        for y in range(y0, y1 + 1):
            self.px(x, y, k)

    def ellipse(self, cx, cy, rx, ry, k):
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=self.rgb(k))


# ── 몸 높이 배분 (npcbody 비율: 머리 40% / 몸통 33% / 다리 20%) ────────────
TOTAL = 56          # 캐릭터 전체 높이 (캔버스 64 중 발밑 4 여백)
HEAD_TOP = FEET - TOTAL
HEAD_H = 22
BODY_H = 19
LEG_H = 15


def draw_legs(cv, g, y0, stride=0, side=False):
    """다리 — stride 로 걷기 표현. side 면 한쪽만."""
    pants = "pants" if g == "m" else "pants"
    pants_sh = "pants_sh"
    legs = [(CX - 3, stride), (CX + 3, -stride)] if not side else [(CX - 1, stride * 3), (CX + 2, -stride * 3)]
    for lx, off in legs:
        top = y0 + abs(off) // 2
        cv.rect(lx - 2, top, lx + 2, y0 + LEG_H - 6, pants)
        cv.vline(lx + (1 if lx > CX else -1), top, y0 + LEG_H - 6, pants_sh)
        # 부츠
        cv.rect(lx - 2, y0 + LEG_H - 5, lx + 2, y0 + LEG_H - 1, "boot")
        cv.hline(lx - 3, lx + 2, y0 + LEG_H, "boot_sh")
    if g == "f":
        # 치마 — 다리 위쪽을 덮어 여캐 실루엣 확보
        for i in range(5):
            half = 8 + i // 2
            cv.hline(CX - half, CX + half, y0 - 3 + i, "cloth")
        cv.hline(CX - 9, CX + 9, y0 + 2, "cloth_sh")


def draw_body(cv, g, y0, side=False, facing="down"):
    """몸통 — 어깨→허리 사다리꼴, 금색 트림, 망토.
    [수정] 뒷모습(up)에는 V넥을 그리지 않는다. V넥은 앞에서만 보이며,
     앞 스프라이트를 복사해 얼굴만 지우면 뒤에 V가 남는 명백한 오류가 된다."""
    cloth, sh, hi = "cloth", "cloth_sh", "cloth_hi"
    # 목
    cv.rect(CX - 2, y0, CX + 2, y0 + 1, "skin_sh")
    # 사다리꼴 몸통
    for i in range(BODY_H - 4):
        half = 9 - (i * 2) // max(1, BODY_H - 4)
        if side:
            half = max(3, half - 1)
        cv.hline(CX - half, CX + half, y0 + 2 + i, cloth)
    # 어깨 하이라이트 / 옆구리 그늘
    cv.hline(CX - 6, CX - 2, y0 + 3, hi)
    cv.vline(CX + (4 if side else 7), y0 + 3, y0 + BODY_H - 4, sh)
    # 가슴 금색 트림 — 앞/측면만 V, 뒷면은 등판이라 직선 밴드
    if facing == "up":
        cv.hline(CX - 5, CX + 5, y0 + 5, "trim")
        cv.hline(CX - 5, CX + 5, y0 + 6, "trim_sh")
    else:
        for i in range(4):
            cv.px(CX - 3 + i, y0 + 5 + i, "trim")
            cv.px(CX + 3 - i, y0 + 5 + i, "trim")
    # 벨트
    cv.hline(CX - 7, CX + 7, y0 + BODY_H - 3, "trim_sh")
    cv.hline(CX - 7, CX + 7, y0 + BODY_H - 2, "trim")
    # 망토(어깨 한쪽) — 실루엣 차별화
    cv.vline(CX - (9 if side else 8), y0 + 4, y0 + BODY_H - 2, "cape")
    cv.vline(CX - (10 if side else 9), y0 + 6, y0 + BODY_H - 4, "cape_sh")


def draw_arm(cv, g, y0, side_pose=False, swing=0):
    """팔 — 소매→피부→손. side 면 하나만."""
    sides = [1] if side_pose else [-1, 1]
    for s in sides:
        ax = CX + s * (8 if s > 0 else -8)
        sy = y0 + 3 + max(0, -swing if s < 0 else swing)
        cv.rect(ax - 1, sy, ax + 1, sy + 6, "cloth")
        cv.hline(ax - 1, ax + 1, sy + 6, "trim")
        cv.rect(ax - 1, sy + 7, ax + 1, sy + 10, "skin")
        cv.hline(ax - 1, ax + 1, sy + 11, "skin_sh")


def draw_head(cv, g, top, facing="down"):
    """머리 — 폭 22, 높이 22. down/up/side."""
    hy = top + HEAD_H // 2
    # 헤어 볼륨(실루엣)
    cv.ellipse(CX, hy, 13, 11, "outline")
    cv.ellipse(CX, hy, 12, 10, "hair")
    if facing == "up":
        # 뒷모습 — 얼굴 없음. [수정] 앞면과 같은 폭(10)을 유지해 "같은 캐릭터의 뒷모습"으로
        #  보이게 한다. 종전엔 더 작은 원(7)이라 정면과 실루엣이 달라 다른 캐릭터처럼 보였다.
        cv.ellipse(CX, hy + 1, 9, 9, "hair_sh")
        cv.hline(CX - 5, CX + 5, top + 3, "hair_hi")
        # 옆머리도 뒤까지 이어져야 실루엣이 일치한다
        cv.vline(CX - 8, top + 5, top + HEAD_H - 4, "hair")
        cv.vline(CX + 8, top + 5, top + HEAD_H - 4, "hair")
        # 정수리 포인트는 뒤에서도 유지(일관성)
        cv.px(CX - 1, top - 1, "hair")
        cv.px(CX, top - 2, "hair")
        return
    # 얼굴
    if facing == "side":
        cv.rect(CX - 5, top + 7, CX + 6, top + HEAD_H - 2, "skin")
    else:
        cv.rect(CX - 6, top + 7, CX + 6, top + HEAD_H - 2, "skin")
    # 앞머리
    cv.rect(CX - 7, top + 4, CX + 7, top + 7, "hair")
    cv.hline(CX - 5, CX + 5, top + 8, "hair_hi")
    # 옆머리
    cv.vline(CX - 10, top + 5, top + HEAD_H - 4, "hair")
    cv.vline(CX + 10, top + 5, top + HEAD_H - 4, "hair")
    # 이목구비
    eye_y = top + 12
    if facing == "side":
        cv.rect(CX + 1, eye_y, CX + 2, eye_y + 1, "eye")
        cv.px(CX + 1, eye_y, "eye_hi")
        cv.hline(CX - 6, CX - 2, eye_y - 1, "hair")
        cv.px(CX + 4, eye_y + 3, "skin_sh")     # 코
        cv.hline(CX + 2, CX + 4, eye_y + 5, "outline")
    else:
        for ex in (CX - 4, CX + 2):
            cv.rect(ex, eye_y, ex + 1, eye_y + 1, "eye")
            cv.px(ex, eye_y, "eye_hi")
        cv.hline(CX - 5, CX - 3, eye_y - 1, "hair")
        cv.hline(CX + 3, CX + 5, eye_y - 1, "hair")
        cv.px(CX, eye_y + 3, "skin_sh")          # 코
        cv.hline(CX - 1, CX + 1, eye_y + 5, "outline")  # 입
    # 정수리 포인트
    cv.px(CX - 1, top - 1, "hair")
    cv.px(CX, top - 2, "hair")


def build(g, facing="down", pose="idle", f=0):
    """facing: down|up|side, pose: idle|walk|atk, f: 프레임 0..3"""
    cv = Cv(P[g])
    lean = 0
    stride = 0
    if pose == "walk":
        stride = [1, 2, 1, 0][f]
    if pose == "atk":
        lean = [0, 1, 2, 1][f]
    legs_y = FEET - LEG_H
    body_y = legs_y - BODY_H + 2
    head_top = body_y - HEAD_H + 1 + (1 if pose == "walk" and f % 2 else 0)

    draw_legs(cv, g, legs_y, stride=stride, side=(facing == "side"))
    draw_body(cv, g, body_y, side=(facing == "side"), facing=facing)
    draw_arm(cv, g, body_y, side_pose=(facing == "side"), swing=stride)
    draw_head(cv, g, head_top, facing=facing)

    if pose == "atk" and facing != "up":
        # [수정] 검에 손잡이·가드·잡은 손을 명시한다.
        #  종전엔 1px 흰 직선만 있어 "공중에 뜬 막대"로 보였다.
        hx = CX + 9
        hy = body_y + 6
        # 잡은 손(피부) — 검자루를 쥔 위치
        cv.rect(hx - 1, hy - 1, hx + 1, hy + 1, "skin")
        # 자루
        cv.vline(hx, hy, hy + 3, "boot")
        # 가드(코등이)
        cv.hline(hx - 2, hx + 2, hy - 1, "trim_sh")
        # 날 — 손잡이 위로 뻗는다
        for i in range(9):
            cv.px(hx + (i + 1) // 3, hy - 2 - i, "eye_hi" if i % 2 == 0 else "skin_hi")
    return cv.img


FRAMES = {
    "idle": ("down", "idle", 4),
    "walk": ("down", "walk", 4),
    "walkup": ("up", "walk", 4),
    "walkside": ("side", "walk", 4),
    "atk": ("side", "atk", 4),
    "atkup": ("up", "atk", 4),
    "atkdown": ("down", "atk", 4),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for g in ("m", "f"):
        prefix = f"ch{g}2"     # resolveBodyPrefix 기본 피부 인덱스 = 2
        for anim, (facing, pose, count) in FRAMES.items():
            for i in range(count):
                img = build(g, facing, pose, i)
                # idle 은 dy 로 숨쉬기(기존 규격과 동일)
                if anim == "idle" and i % 2 == 1:
                    img = img.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, 1), resample=Image.NEAREST)
                p = os.path.join(OUT, f"{prefix}_{anim}{i}.png")
                img.save(p)
                total += 1
        # 대표 프레임 검증
        im = Image.open(os.path.join(OUT, f"{prefix}_idle0.png"))
        bb = im.getbbox()
        print(f"{prefix}: idle0 캐릭터 {bb[2]-bb[0]}x{bb[3]-bb[1]} (캔버스 {W}x{H})")
    print(f"총 {total}개 프레임 생성 → {OUT}")


if __name__ == "__main__":
    main()
