#!/usr/bin/env python3
"""
gen_tiles.py — 매끄럽게 반복되는(seamless) 지형 타일 텍스처 생성기

왜 직접 생성하는가
──────────────────
CERTZ 는 스테이지가 20챕터 × 10구역 + 재림 15구역인데 지형 타일이 8종뿐이었다.
그래서 DLC 행성에 가도 지형이 1기와 똑같이 보였다(유저 지적:
"DLC 챕터면 분위기 및 에셋들이 전부 달라야 되는거 아님??").
외부 팩(Kenney 등)은 화풍이 16px 픽셀아트라 현재 256px 회화풍 타일과 섞으면
이질감이 크다. 그래서 **기존 타일의 팔레트 규율을 실측해 그 위에서** 생성한다.

설계 원칙
─────────
1) 완전 심리스 — 타일 경계에서 이웃 타일과 이어져야 한다.
   → 모든 노이즈를 **주기 함수**(sin/cos 정수배)로만 구성한다.
     FFT/타일링 기법 대신 주파수를 타일 크기의 정수배로 고정하면 수학적으로
     경계가 정확히 일치한다(모듈로 연산에서 위상이 2π 정수배 = 동일값).
2) 팔레트 규율 — 타일당 3~5색. 실측한 기존 타일의 S(채도)/V(명도) 대역을 지킨다.
3) 옥타브 노이즈 — 큰 구조(바위/풀밭 덩어리) + 작은 결(입자)을 2~3옥타브로 겹쳐
   저해상도 티가 나지 않게 한다.
4) 256×256 출력, 최종 webp q=92 (기존 타일과 동일 포맷/해상도).

사용: python3 tools/gen_tiles.py
출력: public/assets/tile_<name>.webp
"""
from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageFilter

SIZE = 256
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")


# ──────────────────────────────────────────────────────────────────────────────
# 심리스 노이즈
# ──────────────────────────────────────────────────────────────────────────────
def seamless_noise(seed: int, octaves: int = 4, base_freq: int = 4) -> list[list[float]]:
    """타일 경계에서 정확히 이어지는 0~1 노이즈 필드.

    주파수를 정수배로만 쓰므로 f(0) == f(SIZE) 가 수학적으로 보장된다.

    ⚠️ vc194 — 종전엔 옥타브마다 사인파 5개만 겹쳐 "구겨진 천" 같은 부드러운
    얼룩이 나왔다(비전 검증 지적: "구겨진 천/잎맥 질감", "반복감 큼").
    실제 흙·돌은 **날카로운 경계와 방향성**이 있어야 지형으로 읽힌다.
    → 방향별 사인파 수를 늘리고(9개), 고주파 옥타브 가중을 높여
      결(grain)이 살아나게 한다. 저주파는 유지해 큰 덩어리도 남긴다.
    """
    rnd = random.Random(seed)
    field = [[0.0] * SIZE for _ in range(SIZE)]

    total_amp = 0.0
    for o in range(octaves):
        freq = base_freq * (2**o)
        # 옥타브가 올라갈수록 가중을 덜 줄인다 → 고주파 결이 남는다
        amp = 1.0 / (1.0 + o * 0.55)
        waves = []
        # 방향성 사인파를 늘려 결을 만든다
        for _ in range(9):
            kx = rnd.randint(1, freq)
            ky = rnd.randint(1, freq)
            ph = rnd.uniform(0, math.tau)
            waves.append((kx, ky, ph))
        for y in range(SIZE):
            ty = y / SIZE * math.tau
            row = field[y]
            for x in range(SIZE):
                tx = x / SIZE * math.tau
                v = 0.0
                for kx, ky, ph in waves:
                    v += math.sin(tx * kx + ty * ky + ph)
                row[x] += (v / len(waves)) * amp
        total_amp += amp

    # 0~1 정규화 후 대비 강화 (결을 세운다)
    lo = min(min(r) for r in field)
    hi = max(max(r) for r in field)
    span = max(1e-6, hi - lo)
    inv = 1.0 / span
    for y in range(SIZE):
        row = field[y]
        for x in range(SIZE):
            t = (row[x] - lo) * inv
            # S 커브 — 중간톤을 밀어내 경계를 또렷하게
            row[x] = t * t * (3 - 2 * t)
    return field


def seamless_cells(seed: int, cells: int, jitter: float = 0.85) -> list[list[float]]:
    """보로노이 근사 — 돌바닥/자갈/벽돌의 '덩어리' 느낌.

    격자 셀 중심을 흔들고, 각 픽셀에서 가장 가까운 셀까지의 거리를 값으로 쓴다.
    격자 자체가 주기적이므로 경계에서도 이어진다.
    """
    rnd = random.Random(seed + 977)
    pts = []
    step = SIZE / cells
    for cy in range(cells):
        for cx in range(cells):
            px = (cx + 0.5 + rnd.uniform(-jitter, jitter) * 0.5) * step
            py = (cy + 0.5 + rnd.uniform(-jitter, jitter) * 0.5) * step
            pts.append((px, py))

    field = [[0.0] * SIZE for _ in range(SIZE)]
    for y in range(SIZE):
        row = field[y]
        for x in range(SIZE):
            best = 1e9
            for px, py in pts:
                # 토러스 거리(감싸기) — 경계 심리스
                dx = abs(x - px)
                dy = abs(y - py)
                if dx > SIZE / 2:
                    dx = SIZE - dx
                if dy > SIZE / 2:
                    dy = SIZE - dy
                d = dx * dx + dy * dy
                if d < best:
                    best = d
            row[x] = math.sqrt(best) / (step * 0.75)
    # 0~1 클램프
    for y in range(SIZE):
        row = field[y]
        for x in range(SIZE):
            row[x] = min(1.0, max(0.0, row[x]))
    return field


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return (
        int(lerp(c1[0], c2[0], t)),
        int(lerp(c1[1], c2[1], t)),
        int(lerp(c1[2], c2[2], t)),
    )


def ramp(colors, t):
    """색 목록을 t(0~1)로 보간 — 팔레트 램프."""
    if t <= 0:
        return colors[0]
    if t >= 1:
        return colors[-1]
    seg = len(colors) - 1
    f = t * seg
    i = int(f)
    return mix(colors[i], colors[min(i + 1, len(colors) - 1)], f - i)


# ──────────────────────────────────────────────────────────────────────────────
# 타일 정의 — 기존 실측 팔레트(S/V 대역)를 기준으로 확장
# ──────────────────────────────────────────────────────────────────────────────
# 실측: grass S=0.49 V=0.77 / snow S=0.13 V=0.94 / stone S=0.16 V=0.20 /
#       magma S=0.67 V=0.42 / hel S=0.50 V=0.35 / abyss S=0.19 V=0.14
TILES = {
    # ── 1기 확장 ──────────────────────────────────────────────────────────────
    "tile_grass": dict(kind="organic", seed=11, palette=["#3d6b32", "#4f8a3e", "#6fb254", "#8fd06a", "#b4e88a"],
                       cells=0, contrast=1.0, detail=0.35),
    "tile_grass_flower": dict(kind="organic", seed=12, palette=["#3d6b32", "#4f8a3e", "#6fb254", "#8fd06a", "#c8ec9a"],
                              cells=0, contrast=1.0, detail=0.45, speckle="#ffe27a"),
    "tile_forest": dict(kind="organic", seed=13, palette=["#22401f", "#2f5a2a", "#3f7a36", "#57993f", "#76b34f"],
                        cells=0, contrast=1.1, detail=0.5),
    "tile_dirt": dict(kind="organic", seed=14, palette=["#4a3524", "#5e4530", "#77573c", "#8f6b4a", "#a8825c"],
                      cells=0, contrast=0.95, detail=0.4),
    "tile_sand": dict(kind="organic", seed=15, palette=["#a8874e", "#c2a063", "#d8b97c", "#e8cf9a", "#f4e2b8"],
                      cells=0, contrast=0.8, detail=0.3),
    "tile_stone": dict(kind="cells", seed=16, palette=["#181e1e", "#222a2a", "#2e3838", "#3b4646", "#4a5656"],
                       cells=5, contrast=1.15, detail=0.32),
    "tile_cobble": dict(kind="cells", seed=17, palette=["#3a3a40", "#4a4a52", "#5c5c66", "#70707c", "#888896"],
                        cells=7, contrast=1.0, detail=0.28),
    "tile_brick": dict(kind="brick", seed=18, palette=["#4a2e28", "#5e3a32", "#74473c", "#8a564a", "#a06a58"],
                       cells=0, contrast=1.0, detail=0.25),
    # ── 냉기/설원 ─────────────────────────────────────────────────────────────
    "tile_snow": dict(kind="organic", seed=19, palette=["#b8c0e0", "#ccd4ee", "#dee4f8", "#eef2ff", "#ffffff"],
                      cells=0, contrast=0.5, detail=0.22),
    "tile_snow_deep": dict(kind="organic", seed=20, palette=["#9aa8cc", "#b0bedd", "#c6d2ea", "#dae4f6", "#eef4ff"],
                           cells=0, contrast=0.55, detail=0.3),
    "tile_ice": dict(kind="crystal", seed=21, palette=["#7fbfd8", "#9ad4e8", "#b8e6f4", "#d4f4ff", "#f0ffff"],
                     cells=0, contrast=0.7, detail=0.4),
    "tile_frost": dict(kind="crystal", seed=22, palette=["#5a7fa0", "#7699b8", "#93b4cf", "#b0cce4", "#cfe4f4"],
                       cells=0, contrast=0.75, detail=0.45),
    # ── 화산/용암 ─────────────────────────────────────────────────────────────
    "tile_magma": dict(kind="lava", seed=23, palette=["#2e0a10", "#5a1420", "#8a2030", "#c03428", "#f06020"],
                       cells=0, contrast=1.3, detail=0.5),
    "tile_ash": dict(kind="organic", seed=24, palette=["#2a2521", "#3a332d", "#4c443c", "#60564c", "#786c60"],
                     cells=0, contrast=0.9, detail=0.38),
    "tile_basalt": dict(kind="cells", seed=25, palette=["#1c1618", "#2a2226", "#3a3034", "#4c4046", "#60525a"],
                        cells=4, contrast=1.2, detail=0.35),
    # ── 동굴/지하 ─────────────────────────────────────────────────────────────
    "tile_cave": dict(kind="cells", seed=26, palette=["#16141a", "#22202a", "#32303c", "#443f4e", "#5a5464"],
                      cells=6, contrast=1.1, detail=0.3),
    "tile_cave_wet": dict(kind="cells", seed=27, palette=["#101820", "#1a2632", "#263646", "#34485c", "#446076"],
                          cells=6, contrast=1.05, detail=0.42),
    "tile_mushroom": dict(kind="organic", seed=28, palette=["#2a2030", "#3c2e44", "#52405c", "#6c5478", "#8a6e96"],
                          cells=0, contrast=1.0, detail=0.5, speckle="#c8a0ff"),
    # ── 심연/언데드 ───────────────────────────────────────────────────────────
    "tile_abyss": dict(kind="organic", seed=29, palette=["#0e0a14", "#1a1420", "#28202e", "#382c40", "#4a3c54"],
                       cells=0, contrast=1.15, detail=0.35),
    "tile_void": dict(kind="void", seed=30, palette=["#06040a", "#0e0a16", "#181024", "#241834", "#342446"],
                      cells=0, contrast=1.4, detail=0.5),
    "tile_bone": dict(kind="organic", seed=31, palette=["#2a2620", "#3e382e", "#564c3e", "#706450", "#8c7e64"],
                      cells=0, contrast=1.0, detail=0.42),
    "tile_hel": dict(kind="organic", seed=32, palette=["#1a2430", "#263444", "#34485c", "#446078", "#547890"],
                     cells=0, contrast=1.05, detail=0.38),
    # ── 신전/황금 ─────────────────────────────────────────────────────────────
    "tile_marble": dict(kind="crystal", seed=33, palette=["#8a8478", "#a8a294", "#c6c0b0", "#e0dcd0", "#f4f2ea"],
                        cells=0, contrast=0.6, detail=0.28),
    "tile_gold": dict(kind="cells", seed=34, palette=["#6a5010", "#94701c", "#c09a30", "#e4c050", "#fae888"],
                      cells=4, contrast=1.1, detail=0.3),
    "tile_divine": dict(kind="crystal", seed=35, palette=["#b0a070", "#d0c090", "#e8dcb0", "#f8f0d0", "#fffce8"],
                        cells=0, contrast=0.55, detail=0.35),
    # ── 기계/도시 ─────────────────────────────────────────────────────────────
    "tile_metal": dict(kind="cells", seed=36, palette=["#2a303a", "#38404c", "#485260", "#5a6676", "#6e7c8e"],
                       cells=5, contrast=1.0, detail=0.26),
    "tile_rust": dict(kind="organic", seed=37, palette=["#3a2418", "#523422", "#6c4630", "#865a3e", "#a0704e"],
                      cells=0, contrast=1.05, detail=0.44),
    "tile_tech": dict(kind="grid", seed=38, palette=["#141c26", "#1e2a38", "#2a3c4e", "#3a5468", "#4e6e88"],
                      cells=6, contrast=1.0, detail=0.35, speckle="#4ee0d0"),
    "tile_concrete": dict(kind="organic", seed=39, palette=["#3a3a3a", "#4a4a4a", "#5a5a5a", "#6c6c6c", "#808080"],
                          cells=0, contrast=0.85, detail=0.3),
    # ── 꽃/정원 (DLC 노벨 플로스) ─────────────────────────────────────────────
    "tile_garden": dict(kind="organic", seed=40, palette=["#3a6a46", "#4e8858", "#68a86e", "#88c88c", "#aee8ae"],
                        cells=0, contrast=0.95, detail=0.5, speckle="#ff9ec8"),
    "tile_moss": dict(kind="organic", seed=41, palette=["#24402a", "#345636", "#487044", "#5e8c54", "#78a868"],
                      cells=0, contrast=0.95, detail=0.48),
    # ── 하늘/성운 (스타게이트) ────────────────────────────────────────────────
    "tile_starfield": dict(kind="void", seed=42, palette=["#080c1c", "#101830", "#1c2848", "#2c3c68", "#405490"],
                           cells=0, contrast=1.3, detail=0.55, speckle="#ffffff"),
    "tile_nebula": dict(kind="void", seed=43, palette=["#14082a", "#241048", "#3a1c68", "#522e88", "#6c48a8"],
                        cells=0, contrast=1.25, detail=0.6, speckle="#c0a0ff"),
}


def build_tile(name: str, spec: dict) -> Image.Image:
    pal = [tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in spec["palette"]]
    kind = spec["kind"]
    seed = spec["seed"]
    contrast = spec.get("contrast", 1.0)
    detail = spec.get("detail", 0.35)
    speckle = spec.get("speckle")

    # 기본 노이즈 필드
    if kind == "brick":
        # 벽돌/조적 패턴
        #
        # ⚠️ vc194 — 기하학적 모르타르 선(격자 + 엇갈림)은 심리스가 매우 취약했다.
        #   실험 결과:
        #     rows=8 → V 이음새 비율 3.3e8 (경계가 모르타르 선과 겹침)
        #     rows=4 → V 6.79 (여전히 불일치)
        #   원인은 x/y 경계에서 모르타르 판정이 **비대칭**이 되는 구조적 문제였다.
        #   → 격자를 버리고 이미 심리스가 검증된 **토러스 보로노이(seamless_cells)** 로
        #     조적 느낌을 낸다. 셀 개수를 늘리고 대비를 높이면 벽돌처럼 보인다.
        #     (tile_cobble 이 같은 방식으로 심리스 0.97 을 기록했다)
        f_cells = seamless_cells(seed, 9, jitter=0.35)
        f_noise = seamless_noise(seed + 1, octaves=3, base_freq=10)
        field = [[0.78 * f_cells[y][x] + 0.22 * f_noise[y][x] for x in range(SIZE)] for y in range(SIZE)]
    elif kind in ("cells", "grid"):
        f_cells = seamless_cells(seed, max(2, spec.get("cells", 5)))
        f_noise = seamless_noise(seed + 1, octaves=3, base_freq=8)
        field = [[0.65 * f_cells[y][x] + 0.35 * f_noise[y][x] for x in range(SIZE)] for y in range(SIZE)]
    elif kind == "lava":
        f_noise = seamless_noise(seed, octaves=4, base_freq=3)
        f_vein = seamless_cells(seed + 5, 6)
        field = [[0.55 * f_noise[y][x] + 0.45 * (1 - f_vein[y][x]) for x in range(SIZE)] for y in range(SIZE)]
    elif kind == "crystal":
        f_noise = seamless_noise(seed, octaves=4, base_freq=5)
        f_cells = seamless_cells(seed + 3, 7)
        field = [[0.7 * f_noise[y][x] + 0.3 * (1 - f_cells[y][x]) for x in range(SIZE)] for y in range(SIZE)]
    elif kind == "void":
        f_noise = seamless_noise(seed, octaves=5, base_freq=2)
        field = f_noise
    elif kind == "brick":
        # (위에서 처리됨 — 방어적 폴백)
        field = seamless_noise(seed, octaves=3, base_freq=6)
    else:  # organic
        f_noise = seamless_noise(seed, octaves=4, base_freq=4)
        f_fine = seamless_noise(seed + 7, octaves=3, base_freq=16)
        field = [[0.72 * f_noise[y][x] + 0.28 * f_fine[y][x] for x in range(SIZE)] for y in range(SIZE)]

    # 명암 대비 적용 + 램프 매핑
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        row = field[y]
        for x in range(SIZE):
            t = row[x]
            t = 0.5 + (t - 0.5) * contrast  # 대비
            t = min(1.0, max(0.0, t))
            px[x, y] = ramp(pal, t)

    # 디테일 입자 — 미세한 밝기 변동 (저해상도 티 제거)
    #
    # ⚠️ vc194: 기존 0.12 확률 / ±13 강도는 256px 타일에서 "밋밋한 단색"으로 보였다.
    #   비전 검증에서 "구겨진 천" 지적을 받은 뒤 확률 0.30 / 강도 ±22 로 올렸고,
    #   여기에 **방향성 스트로크**를 더해 흙·돌의 결을 만든다.
    #   (단순 백색잡음만으로는 노이즈가 아니라 "지글거림"으로 보인다)
    if detail > 0:
        rnd = random.Random(seed * 31 + 7)
        p = 0.30
        for y in range(SIZE):
            for x in range(SIZE):
                if rnd.random() < p:
                    r, g, b = px[x, y]
                    d = int((rnd.random() - 0.5) * 44 * detail)
                    px[x, y] = (
                        min(255, max(0, r + d)),
                        min(255, max(0, g + d)),
                        min(255, max(0, b + d)),
                    )
        # 방향성 결 — 짧은 선분을 흩뿌려 자갈/마모 흔적을 만든다.
        # 반드시 wrap(%) 으로 좌표를 감싸 경계 심리스를 유지한다.
        strokes = int(180 * detail)
        for _ in range(strokes):
            x0 = rnd.randrange(SIZE)
            y0 = rnd.randrange(SIZE)
            length = rnd.randint(2, 7)
            dx = rnd.choice([1, 1, 0, -1])
            dy = rnd.choice([0, 1, 1, -1])
            dark = rnd.random() < 0.55
            amt = int((14 + rnd.random() * 20) * detail)
            sign = -1 if dark else 1
            for i in range(length):
                xx = (x0 + dx * i) % SIZE
                yy = (y0 + dy * i) % SIZE
                r, g, b = px[xx, yy]
                px[xx, yy] = (
                    min(255, max(0, r + sign * amt)),
                    min(255, max(0, g + sign * amt)),
                    min(255, max(0, b + sign * amt)),
                )

    # 스펙클 (꽃가루·불씨·별) — 심리스 위치에 점 찍기
    if speckle:
        sc = tuple(int(speckle[i : i + 2], 16) for i in (1, 3, 5))
        rnd = random.Random(seed * 17 + 3)
        n = 26 if kind != "void" else 70
        for _ in range(n):
            cx = rnd.randrange(SIZE)
            cy = rnd.randrange(SIZE)
            rad = rnd.choice([0, 0, 1, 1, 2])
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    if dx * dx + dy * dy > rad * rad + 0.3:
                        continue
                    # 감싸기 → 경계 심리스
                    xx = (cx + dx) % SIZE
                    yy = (cy + dy) % SIZE
                    cr, cg, cb = px[xx, yy]
                    a = 0.75 if (dx == 0 and dy == 0) else 0.35
                    px[xx, yy] = (
                        int(cr + (sc[0] - cr) * a),
                        int(cg + (sc[1] - cg) * a),
                        int(cb + (sc[2] - cb) * a),
                    )

    # 살짝 부드럽게 — 픽셀 경계 완화 (기존 타일도 부드러운 편)
    #
    # ⚠️ vc194 (검증으로 확인한 사실) — **마지막 블러와 인코딩이 이음새의 주범이었다.**
    #
    #   (1) PIL GaussianBlur 는 경계에서 wrap 하지 않는다.
    #       → 블러만 걸어도 타일 끝단이 서로 다른 값으로 번져 이음새가 생긴다.
    #       → numpy np.roll 기반 **원형(wrap) 블러**로 교체.
    #
    #   (2) WebP **손실** 압축은 16×16 매크로블록 단위로 압축하며 타일 wrap 을
    #       고려하지 않는다. 실측: 원본 경계차 1.58 → 손실 저장 후 2.45 (악화).
    #       → 타일은 반드시 **무손실**로 저장해야 한다. 실측 결과 무손실은 원본과
    #         완전히 동일(1.58)했다. 크기는 19~39KB 로 손실판(3~8KB)보다 크지만,
    #         타일은 한 장을 화면 전체에 반복 사용하므로 이음새 제거가 훨씬 중요하다.
    #         (총 33장 ≈ 1MB — 3,851개 에셋 중 무시할 수준)
    #
    #   이 두 가지를 고치기 전에는 33개 타일 전부에서 경계차가 내부차의 2~5배로
    #   측정됐다(스크립트로 33/33 이음새 판정).
    img = periodic_blur(img, radius=1)
    return img


def periodic_blur(img: Image.Image, radius: int = 1) -> Image.Image:
    """타일 경계에서 wrap 되는 박스 블러. 심리스 보존.

    3×3(radius=1) 커널을 2패스(가로→세로) 적용해 가우시안 근사.
    """
    import numpy as np

    a = np.asarray(img, dtype=np.float32)
    h, w = a.shape[:2]
    k = radius * 2 + 1

    # 가로 패스 — np.roll 로 순환 시프트
    acc = np.zeros_like(a)
    for d in range(-radius, radius + 1):
        acc += np.roll(a, d, axis=1)
    a = acc / k

    # 세로 패스
    acc = np.zeros_like(a)
    for d in range(-radius, radius + 1):
        acc += np.roll(a, d, axis=0)
    a = acc / k

    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # 이전 실행 산출물 중 삭제된 정의 정리하지 않음(수동 관리)
    made = 0
    for name, spec in TILES.items():
        img = build_tile(name, spec)
        path = os.path.join(OUT_DIR, f"{name}.webp")
        img.save(path, "WEBP", lossless=True, quality=100, method=6)
        made += 1
        print(f"  ✓ {name:22s} {os.path.getsize(path)//1024:>4d}KB")
    print(f"\n{made}개 타일 생성 완료 → {OUT_DIR}")


if __name__ == "__main__":
    main()
