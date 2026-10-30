#!/usr/bin/env python3
"""tile_repaint.py — "종이 쪼가리" 타일을 픽셀아트 지형으로 재생성 (vc206, 지시 #11)

## 진단 (비전 분석 + 픽셀 계측)
현재 `public/assets/tile_*.webp` 26종의 문제:
  ① **구겨진 종이 주름** — 사선 방향 부드러운 노이즈(perlin-like)가 지형이 아니라
     구겨서 편 종이/가죽처럼 보인다. 흙·재·콘크리트에는 **입자 스페클**이 필요하다.
  ② **과도한 블러** — 업스케일 흔적으로 가장자리가 뭉개지고 픽셀 그리드가 사라졌다.
  ③ **재활용 패턴** — basalt/blood/cave/cave_wet/cobble/dark/deep 이 동일 점박이에
     색만 바꾼 버전이라 지형 구분이 불가능하다.
  ④ **의미 불일치** — brick 에 벽돌 줄눈이 없고, cobble 에 개별 돌이 없고,
     bone 에 뼈가 없고, cave_wet 에 젖은 반사가 없다.

## 해결
지형별 **고유 구조**를 코드로 그린다:
  · brick/ruin/metal → 줄눈 있는 벽돌/판재 격자
  · cobble/stone/basalt → 이산적 돌 + 어두운 틈 + 좌상단 하이라이트
  · grass/forest → 잎 스페클 + 명암 얼룩
  · dirt/sand/ash/bone → 입자 스페클(방향성 없는 알갱이)
  · snow/ice → 부드러운 결정 스페클 + 푸른 그늘
  · magma/lava → 균열선 + 발광
  · water/deep → 물결 띠
  · cave_wet → 물웅덩이 반사 하이라이트

## 출력
  · 64×64 원본 픽셀아트를 4× nearest 업스케일 → 256×256 (Phaser 타일과 동일 규격)
  · 시임리스(사방 wrap) — 인접 타일 경계가 보이지 않아야 한다
  · `public/assets/tile_<name>.webp` 덮어쓰기 (백업은 .tile_backup)
"""
import os, math, random
from PIL import Image, ImageDraw

OUT = "/root/workspace/CERTZ/public/assets"
TILE = 64          # 원본 픽셀아트 해상도
UP = 4             # 표시 배율 → 256
VARIANTS = 3       # 반복 노출 완화 — 타일당 3장을 만들어 맵 셀마다 선택한다
SEED = 20261030

# ── 팔레트 (지형별 base/shadow/light/accent) ────────────────────────────────
PALETTES = {
    # 이름: (base, shadow, light, accent)
    "grass":   ((0x5d, 0x9c, 0x3f), (0x3f, 0x71, 0x2a), (0x86, 0xc4, 0x5c), (0xb8, 0xe0, 0x84)),
    "grass2":  ((0x4e, 0x86, 0x4a), (0x33, 0x60, 0x34), (0x74, 0xad, 0x62), (0xa6, 0xd2, 0x8a)),
    "forest":  ((0x37, 0x6b, 0x33), (0x24, 0x4a, 0x25), (0x57, 0x91, 0x46), (0x8c, 0xbd, 0x63)),
    "moss":    ((0x4a, 0x7a, 0x35), (0x30, 0x54, 0x24), (0x6c, 0xa0, 0x4c), (0x9c, 0xc8, 0x6e)),
    "dirt":    ((0x7a, 0x59, 0x3b), (0x56, 0x3d, 0x28), (0x9e, 0x78, 0x50), (0xc0, 0x9a, 0x6c)),
    "dirt_pack": ((0x63, 0x47, 0x30), (0x44, 0x30, 0x20), (0x86, 0x63, 0x44), (0xa8, 0x82, 0x5a)),
    "sand":    ((0xc9, 0xb0, 0x7a), (0xa2, 0x8b, 0x5a), (0xe4, 0xd0, 0x9c), (0xf4, 0xe6, 0xbc)),
    "desert":  ((0xbf, 0x9c, 0x68), (0x98, 0x78, 0x4c), (0xdc, 0xbc, 0x8a), (0xef, 0xd6, 0xa8)),
    "ash":     ((0x6b, 0x64, 0x5c), (0x4a, 0x45, 0x3f), (0x8c, 0x84, 0x78), (0xab, 0xa2, 0x93)),
    "bone":    ((0xa8, 0x9c, 0x7c), (0x7f, 0x75, 0x5a), (0xc6, 0xba, 0x98), (0xe0, 0xd6, 0xb4)),
    "snow":    ((0xdd, 0xe8, 0xf2), (0xb4, 0xc6, 0xd8), (0xf4, 0xfa, 0xff), (0xff, 0xff, 0xff)),
    "ice":     ((0xa8, 0xd4, 0xe8), (0x7c, 0xad, 0xc8), (0xd0, 0xee, 0xfa), (0xf2, 0xff, 0xff)),
    "stone":   ((0x7d, 0x7f, 0x86), (0x59, 0x5b, 0x62), (0xa0, 0xa3, 0xaa), (0xc2, 0xc5, 0xcc)),
    "cobble":  ((0x6e, 0x70, 0x79), (0x4b, 0x4d, 0x55), (0x92, 0x95, 0x9e), (0xb4, 0xb7, 0xc0)),
    "basalt":  ((0x45, 0x48, 0x50), (0x2c, 0x2e, 0x35), (0x63, 0x67, 0x70), (0x86, 0x8a, 0x94)),
    "brick":   ((0x8f, 0x4e, 0x40), (0x67, 0x35, 0x2c), (0xb3, 0x6a, 0x57), (0xd0, 0x88, 0x70)),
    "ruin":    ((0x7a, 0x70, 0x5e), (0x55, 0x4e, 0x41), (0x9c, 0x91, 0x7a), (0xbc, 0xb0, 0x96)),
    "metal":   ((0x6a, 0x72, 0x7e), (0x48, 0x4f, 0x59), (0x8c, 0x95, 0xa2), (0xae, 0xb7, 0xc4)),
    "concrete": ((0x8a, 0x8c, 0x89), (0x64, 0x66, 0x64), (0xac, 0xae, 0xaa), (0xc8, 0xca, 0xc6)),
    "cave":    ((0x56, 0x4e, 0x48), (0x38, 0x32, 0x2e), (0x76, 0x6c, 0x63), (0x96, 0x8b, 0x80)),
    "cave_wet": ((0x4c, 0x4e, 0x52), (0x31, 0x33, 0x38), (0x6c, 0x70, 0x76), (0x9e, 0xb8, 0xc4)),
    "dark":    ((0x3a, 0x38, 0x40), (0x24, 0x23, 0x29), (0x52, 0x50, 0x5a), (0x6c, 0x6a, 0x76)),
    "deep":    ((0x2e, 0x46, 0x66), (0x1c, 0x2d, 0x44), (0x46, 0x64, 0x88), (0x6c, 0x90, 0xb8)),
    "water":   ((0x3d, 0x6e, 0x9c), (0x27, 0x4c, 0x70), (0x5c, 0x94, 0xc4), (0x86, 0xbc, 0xe4)),
    "magma":   ((0x5c, 0x22, 0x14), (0x38, 0x12, 0x0a), (0x8a, 0x38, 0x1c), (0xff, 0x9a, 0x30)),
    "lava":    ((0x6e, 0x2a, 0x12), (0x42, 0x15, 0x08), (0xa2, 0x46, 0x1c), (0xff, 0xb0, 0x40)),
    "blood":   ((0x6b, 0x22, 0x24), (0x47, 0x14, 0x18), (0x91, 0x34, 0x36), (0xb8, 0x50, 0x4c)),
    "hel":     ((0x4a, 0x3c, 0x58), (0x2e, 0x24, 0x38), (0x6a, 0x58, 0x7c), (0x94, 0x7e, 0xa8)),
    "morgue":  ((0x54, 0x4c, 0x52), (0x36, 0x30, 0x36), (0x76, 0x6c, 0x74), (0x9c, 0x90, 0x9a)),
    "abyss":   ((0x34, 0x2a, 0x4c), (0x1e, 0x16, 0x30), (0x4e, 0x40, 0x6c), (0x76, 0x64, 0x9c)),
    "nebula":  ((0x3c, 0x3a, 0x74), (0x24, 0x22, 0x4c), (0x5a, 0x58, 0xa0), (0x8c, 0x84, 0xd4)),
    "garden":  ((0x62, 0x8c, 0x4e), (0x43, 0x66, 0x36), (0x86, 0xb4, 0x66), (0xb4, 0xd8, 0x8c)),
    "amber":   ((0xb0, 0x82, 0x3c), (0x86, 0x5c, 0x26), (0xd4, 0xa4, 0x5a), (0xf0, 0xc8, 0x80)),
}

# 지형 표현 방식
STYLE = {
    "brick": "brick", "ruin": "brick", "metal": "brick", "concrete": "brick",
    "cobble": "cobble", "stone": "cobble", "basalt": "cobble",
    "grass": "grass", "grass2": "grass", "forest": "grass", "moss": "grass", "garden": "grass",
    "dirt": "grain", "dirt_pack": "grain", "sand": "grain", "desert": "grain",
    "ash": "grain", "bone": "grain", "amber": "grain",
    "snow": "snow", "ice": "snow",
    "magma": "magma", "lava": "magma",
    "water": "water", "deep": "water",
    "cave": "cave", "cave_wet": "cave", "dark": "cave", "morgue": "cave",
    "blood": "grain", "hel": "cave", "abyss": "cave", "nebula": "water",
}


def wrap_draw(d, fn, w, h):
    """시임리스: 좌표가 경계를 넘으면 반대편에도 그린다."""
    fn(0, 0)
    for ox in (-w, 0, w):
        for oy in (-h, 0, h):
            if ox == 0 and oy == 0:
                continue
            fn(ox, oy)


def put(img, x, y, col):
    """시임리스 픽셀 찍기."""
    w, h = img.size
    img.putpixel((x % w, y % h), col)


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)



def lowfreq_blotch(img, base, amp=0.09, octaves=3, rnd=None):
    """저주파 명암 얼룩 — "종이처럼 평평한" 느낌의 주범을 제거한다.

    비전 진단: "유기질 텍스처 전부가 플랫한 베이스색 + 고주파 점만 존재하고,
    저주파(넓은 영역)의 명암/색 변화가 전혀 없다. 이 평평함이 종이처럼 보이는 이유다."

    시임리스: x/y 를 2π 주기 사인 합으로만 구성 → 타일 경계에서 값이 연속.
    """
    if rnd is None:
        rnd = random.Random(SEED)
    waves = []
    for o in range(octaves):
        f = 2 ** o                      # 1,2,4 주기 (정수배만 → wrap 보장)
        waves.append((f, rnd.uniform(0, math.pi * 2), rnd.uniform(0, math.pi * 2),
                      amp / (o + 1.4)))
    px = img.load()
    for y in range(TILE):
        for x in range(TILE):
            v = 0.0
            for f, phx, phy, a in waves:
                v += a * math.sin((x / TILE) * math.pi * 2 * f + phx) * math.cos((y / TILE) * math.pi * 2 * f + phy)
            if abs(v) < 0.004:
                continue
            c = px[x, y]
            px[x, y] = (max(0, min(255, int(c[0] * (1 + v)))),
                        max(0, min(255, int(c[1] * (1 + v)))),
                        max(0, min(255, int(c[2] * (1 + v)))), 255)
    return img


def tuft(img, x, y, col, rnd, n=6):
    """풀 뭉치 — 균일 점 대신 뭉친 잎 (비전 지적: 점들을 뭉치게 만들 것)"""
    for _ in range(n):
        dx = rnd.randint(-2, 2)
        dy = rnd.randint(-3, 0)
        h = rnd.randint(1, 3)
        for i in range(h):
            put(img, x + dx, y + dy + i, col)

def gen_tile(name):
    base, shad, lite, acc = PALETTES[name]
    st = STYLE.get(name, "grain")
    rnd = random.Random(SEED + hash(name) % 100000)
    img = Image.new("RGBA", (TILE, TILE), base + (255,))
    # 저주파 얼룩을 **먼저** 깔아 표면에 깊이를 준다 (유기질 지형의 종이 느낌 제거)
    if st in ("grass", "grain", "snow", "cave", "water"):
        lowfreq_blotch(img, base, amp=0.10, octaves=3, rnd=rnd)

    if st == "grass":
        # 베이스 위에 명암 얼룩 + 잎 스페클
        for _ in range(190):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            k = rnd.choice([0.88, 0.94, 1.06, 1.12])
            put(img, x, y, shade(base, k))
        # 잎 — 뭉치(tuft) 단위로 모아 실제 풀처럼 (균일 스프레이 제거)
        for _ in range(26):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            tuft(img, x, y, lite, rnd, n=rnd.randint(4, 8))
            put(img, x, y - 3, shad)
        for _ in range(26):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, acc)

    elif name == "forest":
        # 숲 바닥 — 비전 지적 "어두운 색지에 점 찍은 수준. 수관 그늘·잎 덩어리가 전무"
        for _ in range(8):
            cx, cy = rnd.randrange(TILE), rnd.randrange(TILE)
            rx, ry = rnd.randint(7, 13), rnd.randint(5, 9)
            for dx in range(-rx, rx + 1):
                for dy in range(-ry, ry + 1):
                    if (dx / rx) ** 2 + (dy / ry) ** 2 <= 1:
                        put(img, cx + dx, cy + dy, shade(base, rnd.choice([0.80, 0.85, 0.90])))
        for _ in range(20):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            tuft(img, x, y, lite, rnd, n=rnd.randint(3, 7))
        for _ in range(11):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, acc)
            put(img, x + 1, y + 1, shade(acc, 0.8))

    elif st == "grain":
        # 방향성 없는 입자 스페클 — 주름(사선 노이즈) 대신 알갱이
        for _ in range(520):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            k = rnd.choice([0.84, 0.90, 0.96, 1.05, 1.11, 1.18])
            put(img, x, y, shade(base, k))
        # 자갈 몇 개 (밝은 상단 + 어두운 하단 → 부조)
        for _ in range(14):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            r = rnd.randint(1, 2)
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r:
                        put(img, x + dx, y + dy, lite if dy <= 0 else shad)
        # 사막/모래 — 사구 물결. 비전 지적 "물결선이 경계 교차점마다 ∞/X 모티프를 만들어
        #  타일 격자가 그대로 드러난다" → 위상을 비대칭(0.41, 0.73)으로 두어 코너에 겹치지 않게 하고,
        #  선 두께와 명도를 x 에 따라 변조해 "낙서 같은 균일 선"을 없앤다.
        if name in ("sand", "desert"):
            # 물결이 경계에서 끊기는 원인은 **위상**이 아니라 x 주기가 비정수였기 때문.
            #  x 위상을 2π 정수배로 두면 x=0 과 x=TILE 이 같은 값 → 좌우 경계 연속.
            #  y 는 아래 '바닥 위상'으로 타일마다 다르게 두되, 각 타일 안에서는 상수 오프셋.
            for freq, ph, thick in ((1, 0.0, 2), (2, math.pi / 2, 1)):
                for x in range(TILE):
                    yy = int(TILE * 0.5 + TILE * 0.19 * math.sin((x / TILE) * math.pi * 2 * freq + ph))
                    w = 1 + int(0.9 * (0.5 + 0.5 * math.sin((x / TILE) * math.pi * 4)))
                    for k in range(w + thick - 1):
                        put(img, x, yy + k, lite if k == 0 else shade(base, 0.93 - 0.02 * k))

    elif st == "cobble":
        # 이산적 돌 + 어두운 틈 — 개별 돌이 보여야 한다
        for _ in range(520):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.86, 0.93, 1.04, 1.10])))
        # 64 % 5 != 0 이라 격자가 경계를 넘는다 → wrap 이 되도록 cells=4 사용
        cells = 4
        cs = TILE // cells
        for cy in range(cells):
            for cx in range(cells):
                ox = cx * cs + rnd.randint(1, 3)
                oy = cy * cs + rnd.randint(1, 3)
                rw = cs - rnd.randint(3, 5)
                rh = cs - rnd.randint(3, 5)
                # 틈(어두운 테두리)
                for x in range(ox - 1, ox + rw + 1):
                    for y in range(oy - 1, oy + rh + 1):
                        put(img, x, y, shad)
                # 돌 몸통 — 돌마다 명도 편차를 준다(균일하면 "버튼 타일"처럼 보인다)
                tk = rnd.uniform(0.93, 1.07)
                broken = rnd.random() < 0.16
                for x in range(ox, ox + rw):
                    for y in range(oy, oy + rh):
                        k = tk + (0.05 if (x - ox) < rw * 0.3 else -0.04 if (y - oy) > rh * 0.7 else 0)
                        if broken and (x - ox) + (y - oy) < rw * 0.45:
                            k -= 0.10                     # 깨진 돌
                        put(img, x, y, shade(base, k))
                # 좌상단 하이라이트
                for x in range(ox, ox + max(2, rw - 2)):
                    put(img, x, oy, lite)
                for y in range(oy, oy + max(2, rh - 2)):
                    put(img, ox, y, lite)

    elif st == "brick":
        # 줄눈 있는 벽돌 — brick 의 이름값
        # 64 가 16/8 로 나누어떨어지면 줄눈이 타일 경계와 겹쳐 시임이 생긴다.
        # 비대칭 크기(13×7)로 경계를 피한다.
        bw, bh = 13, 7
        for y in range(TILE):
            for x in range(TILE):
                row = y // bh
                off = (bw // 2) if row % 2 else 0
                bx = (x + off) % bw
                by = y % bh
                if bx < 1 or by < 1:
                    put(img, x, y, shad)          # 줄눈
                elif bx == 1 or by == 1:
                    put(img, x, y, lite)          # 모서리 하이라이트
                else:
                    k = 0.96 + (0.06 if by < bh * 0.4 else -0.05)
                    put(img, x, y, shade(base, k))
        for _ in range(60):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.88, 1.08])))

    elif st == "snow":
        for _ in range(420):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.93, 0.97, 1.0, 1.02])))
        # 푸른 그늘 — 무리지어 칠해야 눈의 굴곡으로 읽힌다(흩뿌리면 종이)
        for _ in range(16):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            for dx in range(-3, 4):
                for dy in range(-2, 3):
                    if dx * dx * 0.6 + dy * dy < 7:
                        put(img, x + dx, y + dy, shade(base, 0.90))
        for _ in range(30):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, acc)

    elif name == "snow":
        # 눈 — "백지 + 얼룩" 탈출: 청회색 드리프트(사구형 그늘) + 1px 스파클
        for _ in range(6):
            cx, cy = rnd.randrange(TILE), rnd.randrange(TILE)
            rx, ry = rnd.randint(9, 16), rnd.randint(4, 7)
            for dx in range(-rx, rx + 1):
                for dy in range(-ry, ry + 1):
                    if (dx / rx) ** 2 + (dy / ry) ** 2 <= 1:
                        put(img, cx + dx, cy + dy, shade(base, rnd.uniform(0.93, 0.97)))
        for _ in range(70):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, (255, 255, 255, 255))
        for _ in range(24):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(shad, 0.95))

    elif st == "magma":
        for _ in range(460):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.85, 0.92, 1.04, 1.12])))
        # 균열선 — 발광
        # 균열선은 짧게 여러 개 — 길게 이으면 경계에서 방향이 튀어 시임이 보인다.
        for _ in range(9):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            for _step in range(rnd.randint(5, 9)):
                put(img, x, y, acc)
                put(img, x + 1, y, shade(acc, 0.8))
                y += 1
                x += rnd.choice([-1, 0, 1])

    elif st == "water":
        for _ in range(300):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.9, 0.96, 1.05])))
        # 물결 띠 — y0(임의 시작 행)를 쓰면 위쪽/아래쪽 경계에서 위상이 끊긴다.
        #  대신 y 위상과 x 위상을 모두 2π 주기로 두어 64 경계에서 값이 연속이 되게 한다.
        for band in range(3):
            ph = band * (math.pi * 2 / 3)
            for x in range(TILE):
                for y in range(TILE):
                    v = math.sin((x / TILE) * math.pi * 2 + ph) * math.sin((y / TILE) * math.pi * 2 + ph)
                    if v > 0.72:
                        put(img, x, y, lite)
                    elif v < -0.72:
                        put(img, x, y, shade(base, 0.88))

    else:  # cave — 바위 바닥 + 습기 반사
        for _ in range(480):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            put(img, x, y, shade(base, rnd.choice([0.82, 0.9, 0.97, 1.06, 1.13])))
        # 자갈 — 반지름 2 이상의 원은 타일 경계에서 잘려 시임이 보인다.
        # 1~2px 알갱이를 여러 개 흩뿌려 wrap 안전하게 만든다.
        for _ in range(34):
            x, y = rnd.randrange(TILE), rnd.randrange(TILE)
            r = rnd.randint(1, 2)
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r:
                        put(img, x + dx, y + dy, shade(base, 0.87))
            put(img, x - 1, y - r, lite)
            put(img, x, y - r, lite)

    # 4× nearest 업스케일 → 256
    out = img.resize((TILE * UP, TILE * UP), Image.NEAREST)
    return out


def contiguity_check(img):
    """시임리스 검사 — 좌/우, 상/하 경계 대비가 내부 대비와 비슷해야 한다."""
    px = img.convert("RGB").load()
    w, h = img.size
    def d(a, b):
        return sum(abs(a[i] - b[i]) for i in range(3)) / 3
    # 4× NEAREST 업스케일이므로 인접 1px 은 같은 원본 픽셀이다(대비 0).
    #  원본 1픽셀 이동 = 4px 이므로 반드시 4 간격으로 비교해야 실제 이웃 대비가 나온다.
    ST = UP
    seam_x = sum(d(px[w - 1, y], px[0, y]) for y in range(0, h, ST)) / (h // ST)
    seam_y = sum(d(px[x, h - 1], px[x, 0]) for x in range(0, w, ST)) / (w // ST)
    n = 0
    inner = 0.0
    for x in range(0, w - ST, ST):
        for y in range(0, h, ST):
            inner += d(px[x, y], px[x + ST, y])
            n += 1
    inner = inner / max(1, n)
    return seam_x, seam_y, inner


def gen_tile_variant(name, vi):
    """같은 지형의 변형본 — 시드만 바꿔 배치를 달리한다.

    비전 지적 "3×3 반복이 그대로 드러난다(lava/magma 심함)" 대응.
    팔레트·구조는 동일하고 배치만 달라서 한 맵 안에서 섞어 써도 이질감이 없다.
    """
    global SEED
    old = SEED
    SEED = old + vi * 7919
    try:
        return gen_tile(name)
    finally:
        SEED = old


def main():
    os.makedirs(OUT, exist_ok=True)
    names = sorted(PALETTES.keys())
    report = []
    for n in names:
        # 시임이 가장 적은 후보를 채택 — 시드만 바꿔 3회 시도
        best = None
        for attempt in range(3):
            global SEED
            _saved = SEED
            SEED = 20261030 + attempt * 977
            cand = gen_tile(n)
            SEED = _saved
            sx, sy, inner = contiguity_check(cand)
            score = max(sx, sy) / max(0.05, inner)
            if best is None or score < best[0]:
                best = (score, cand)
        img = best[1]
        path = os.path.join(OUT, f"tile_{n}.webp")
        back = os.path.join(OUT, ".tile_backup", f"tile_{n}.webp")
        if os.path.exists(path) and not os.path.exists(back):
            os.makedirs(os.path.dirname(back), exist_ok=True)
            os.replace(path, back)
        img.save(path, "WEBP", lossless=True, quality=100, method=6)
        # 변형본 tile_<name>_v1..v{ VARIANTS-1 } — 넓은 맵에서 3×3 반복이 보이지 않게
        for vi in range(1, VARIANTS):
            vimg = gen_tile_variant(n, vi)
            vimg.save(os.path.join(OUT, f"tile_{n}_v{vi}.webp"), "WEBP", lossless=True, quality=100, method=6)
        sx, sy, inner = contiguity_check(img)
        cols = len(img.convert("RGB").getcolors(maxcolors=300000) or [])
        report.append((n, os.path.getsize(path), cols, sx, sy, inner))

    print(f"{'타일':12s} {'바이트':>8s} {'색':>5s} {'시임X':>6s} {'시임Y':>6s} {'내부':>6s} 판정")
    bad = 0
    for n, sz, cols, sx, sy, inner in report:
        ok = sx <= inner * 2.2 and sy <= inner * 2.2
        if not ok:
            bad += 1
        print(f"{n:12s} {sz:8d} {cols:5d} {sx:6.2f} {sy:6.2f} {inner:6.2f} {'OK' if ok else 'SEAM!'}")
    print(f"\n총 {len(report)}개 / 시임 불량 {bad}개")


if __name__ == "__main__":
    main()
