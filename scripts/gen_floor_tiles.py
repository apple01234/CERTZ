#!/usr/bin/env python3
"""v3.0.19 — 바닥 타일 재생성: 단색 사각형 → 시밀리스 픽셀아트 텍스처
사용자 피드백: "타일맵이 전혀 잔디 같지가 않아"

생성 규칙 (전 타일 공통):
- 256x256 시밀리스 (tileSprite 반복 이음새 0) — 내부에 64px 그리드 4x4 유지
  → "정사각형 타일 규칙적 배열" (기존 지시 #17) + 잔디 질감 동시 충족
- 서브타일(64px)마다 밝기 ±4% 미세 변화 — 벽지 반복감 제거
- 그리드 경계 1px 음영 베벨 — 타일 칸이 규칙적으로 보이게
- 잔디 계열: 톤 패치(3단) + 풀잎 스트로크(1x2/1x3, 어두운/밝은 톤) + 하이라이트 스펙
- 테마별 디테일: 마그마 용암 균열/눈 반짝/동굴·슬레이트 균열/헬·심연 스펙
- 전부 랩어라운드 드로잉 → 어느 방향으로 이어 붙여도 이음새 없음
- 시드 고정 → 재생성해도 동일 결과
"""
from PIL import Image
import random

OUT = "/home/z/my-project/public/assets"
T = 256          # 텍스처 크기
CELL = 64        # 타일 그리드 크기

# ---------------- 공통 유틸 ----------------

def wrap(px):
    """좌표를 텍스처 안으로 랩 (시밀리스 핵심)"""
    return px % T

def put(px_img, x, y, c):
    px_img[wrap(x), wrap(y)] = c

def hexc(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def shade(c, k):
    """k>0 밝게, k<0 어둡게"""
    if k >= 0:
        return tuple(min(255, int(v + (255 - v) * k)) for v in c)
    return tuple(int(v * (1 + k)) for v in c)

def value_noise(seed, grid_n, lo=-1.0, hi=1.0):
    """랩어라운드 value noise → T x T float 격자 (bil 보간)"""
    rng = random.Random(seed)
    g = [[rng.uniform(lo, hi) for _ in range(grid_n)] for _ in range(grid_n)]
    step = T / grid_n
    out = [[0.0] * T for _ in range(T)]
    for y in range(T):
        gy, fy = divmod(y / step, 1.0)
        gy = int(gy) % grid_n
        gy2 = (gy + 1) % grid_n
        for x in range(T):
            gx, fx = divmod(x / step, 1.0)
            gx = int(gx) % grid_n
            gx2 = (gx + 1) % grid_n
            sx = fx * fx * (3 - 2 * fx)
            sy = fy * fy * (3 - 2 * fy)
            a = g[gy][gx] + (g[gy][gx2] - g[gy][gx]) * sx
            b = g[gy2][gx] + (g[gy2][gx2] - g[gy2][gx]) * sx
            out[y][x] = a + (b - a) * sy
    return out

def quantize(noise, stops):
    """noise [-1,1] → stops 색상 리스트 인덱스 (균등 3분할)"""
    q = [[0] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            v = noise[y][x]
            i = 0 if v < -0.33 else (2 if v > 0.33 else 1)
            q[y][x] = i
    return q

# ---------------- 톤 패치 베이스 ----------------

def base_patches(rng, palette, seed):
    """3톤 패치 배경 + 서브타일 밝기 변화. palette = (dark, mid, light)"""
    n1 = quantize(value_noise(seed, 5), palette)
    n2 = quantize(value_noise(seed + 7, 11), palette)  # 디테일 노이즈
    img = Image.new("RGB", (T, T))
    px = img.load()
    # 서브타일별 밝기 오프셋
    cells = [[rng.uniform(-0.045, 0.045) for _ in range(T // CELL)] for _ in range(T // CELL)]
    for y in range(T):
        cy = y // CELL
        for x in range(T):
            cx = x // CELL
            i = n1[y][x] if rng.random() < 0.72 else n2[y][x]
            c = palette[i]
            if i == 1:  # mid 톤은 노이즈 혼합로 부드럽게
                t = (n2[y][x] + 1) / 2
                c = mix(palette[0], palette[2], 0.35 + t * 0.3)
            k = cells[cy][cx]
            px[x, y] = shade(c, k)
    return img, px

def grid_bevel(px):
    """64px 경계 1px 음영 베벨 — 규칙적 타일 칸 강조 (미세)"""
    dark = (0, 0, 0)
    for p in range(0, T, CELL):
        for i in range(T):
            x0, y0 = wrap(p), wrap(p)
            px[x0, i] = shade(px[x0, i], -0.16)
            px[i, y0] = shade(px[i, y0], -0.16)
            px[wrap(p + 1), i] = shade(px[wrap(p + 1), i], 0.05)
            px[i, wrap(p + 1)] = shade(px[i, wrap(p + 1)], 0.05)
    # 코너는 어둡게 유지
    for p in range(0, T, CELL):
        for q in range(0, T, CELL):
            px[p, q] = shade(dark, -0.0)

def speckle(px, rng, n, colors, seed_off=0):
    """1px 스펙 (랩)"""
    for _ in range(n):
        x, y = rng.randrange(T), rng.randrange(T)
        put(px, x, y, rng.choice(colors))

def blades(px, rng, n, dark, light, seed_off=0):
    """잔디 풀잎 — 1x2/1x3 수직 스트로크, 랩 드로잉"""
    for _ in range(n):
        x, y = rng.randrange(T), rng.randrange(T)
        h = rng.choice((2, 2, 3))
        c = dark if rng.random() < 0.55 else light
        for k in range(h):
            put(px, x, y + k, shade(c, -0.06 * k))
        if rng.random() < 0.3:  # 곁잎
            put(px, x + 1, y + 1, shade(c, -0.1))

def cracks(px, rng, n, colors, max_len=7, horizontal_bias=False):
    """짧은 균열 랜덤워크 (랩)"""
    for _ in range(n):
        x, y = rng.randrange(T), rng.randrange(T)
        c = rng.choice(colors)
        ln = rng.randint(3, max_len)
        dx = dy = 0
        for _ in range(ln):
            put(px, x, y, c)
            if rng.random() < 0.75:
                if horizontal_bias or rng.random() < 0.5:
                    dx = rng.choice((-1, 1))
                else:
                    dy = rng.choice((-1, 1))
            x += dx
            y += dy

# ---------------- 테마 생성기 ----------------

def gen_grass_like(name, seed, base, tuft_dk, tuft_lt):
    """잔디 계열 v2 — 클래식 RPG식:
    ① 베이스 중간톤 + 저대비 모틀링(±7% 밝기 노이즈, 색 전환 없음)
    ② 풀 다발(tuft): 3~5줄기 옆으로 붙인 수직 스트로크 — 어두운 다발 150 + 밝은 다발 70
    ③ 밝은 끝단 하이라이트 + 드문 스펙
    → 노이즈 얼룩이 아니라 '풀잎'이 보이는 질감"""
    rng = random.Random(seed)
    base_c = hexc(base)
    img = Image.new("RGB", (T, T))
    px = img.load()
    # ① 베이스 + 모틀링
    n_lo = value_noise(seed, 4, lo=-1.0, hi=1.0)
    n_hi = value_noise(seed + 3, 16, lo=-1.0, hi=1.0)
    for y in range(T):
        for x in range(T):
            v = n_lo[y][x] * 0.6 + n_hi[y][x] * 0.4  # -1..1
            px[x, y] = shade(base_c, v * 0.07)
    # ② 풀잎 산포 — 지터 그리드(16px 셀)로 빈 구역 없이 균일하게:
    #    셀당 어두운 줄기 4개 + 50% 확률로 밝은 줄기 1개 (클래식 RPG 밀도)
    dk, lt = hexc(tuft_dk), hexc(tuft_lt)
    step = 16
    for gy in range(T // step):
        for gx in range(T // step):
            for _ in range(4):
                x = gx * step + rng.randrange(step)
                y = gy * step + rng.randrange(step)
                h = rng.choice((2, 2, 3))
                top_shift = -1 if rng.random() < 0.25 else 0  # 잎 끝 살짝 기울임
                for k in range(h):
                    put(px, x + (top_shift if k == h - 1 else 0), y - k, shade(dk, -0.05 * k))
            if rng.random() < 0.5:
                x = gx * step + rng.randrange(step)
                y = gy * step + rng.randrange(step)
                for k in range(rng.choice((2, 3))):
                    put(px, x, y - k, shade(lt, -0.04 * k))
    # ③ 특징점 — 키 큰 풀 다발 40개 (5~6줄기, 3~4px) + 하이라이트 스펙
    def tuft(x, y, color, hmax=4):
        for i in range(rng.randint(5, 6)):
            sx = x + i
            h = rng.randint(3, hmax)
            for k in range(h):
                put(px, sx, y - k, shade(color, -0.05 * k))
            if rng.random() < 0.45:
                put(px, sx, y - h, shade(color, 0.28))
    for _ in range(28):
        tuft(rng.randrange(T), rng.randrange(T), dk)
    for _ in range(14):
        tuft(rng.randrange(T), rng.randrange(T), lt, hmax=3)
    speckle(px, rng, 30, [shade(lt, 0.3), shade(dk, -0.12)])
    grid_bevel(px)
    img.save(f"{OUT}/{name}.png")
    print(f"{name}: 256x256 grass v2 done")

def gen_snow(name, seed, pal):
    rng = random.Random(seed)
    palette = tuple(hexc(p) for p in pal)
    img, px = base_patches(rng, palette, seed)
    # 옅은 파란 음영 대시 (눈결 잔물결)
    shade_c = shade(palette[0], -0.08)
    for _ in range(70):
        x, y = rng.randrange(T), rng.randrange(T)
        ln = rng.choice((2, 3))
        for k in range(ln):
            put(px, x + k, y, shade_c)
    speckle(px, rng, 90, [(255, 255, 255), shade(palette[2], 0.35)])
    grid_bevel(px)
    img.save(f"{OUT}/{name}.png")
    print(f"{name}: snow done")

def gen_magma(name, seed, pal):
    rng = random.Random(seed)
    palette = tuple(hexc(p) for p in pal)
    img, px = base_patches(rng, palette, seed)
    speckle(px, rng, 120, [shade(palette[0], -0.15), shade(palette[2], 0.12)])
    # 용암 균열 — 밝은 주황 랜덤워크 + 코어 옅은 노랑
    cracks(px, rng, 16, [hexc("#e0562c"), hexc("#c23e22")], max_len=9)
    for _ in range(16):
        x, y = rng.randrange(T), rng.randrange(T)
        put(px, x, y, hexc("#ffb060"))
    grid_bevel(px)
    img.save(f"{OUT}/{name}.png")
    print(f"{name}: magma done")

def gen_rock(name, seed, pal, crack_cols, speck_n=130, h_bias=False):
    rng = random.Random(seed)
    palette = tuple(hexc(p) for p in pal)
    img, px = base_patches(rng, palette, seed)
    speckle(px, rng, speck_n, [shade(palette[0], -0.18), shade(palette[2], 0.14)])
    cracks(px, rng, 10, [hexc(c) for c in crack_cols], max_len=8, horizontal_bias=h_bias)
    grid_bevel(px)
    img.save(f"{OUT}/{name}.png")
    print(f"{name}: rock done")

def gen_abyss(name, seed, pal):
    rng = random.Random(seed)
    palette = tuple(hexc(p) for p in pal)
    img, px = base_patches(rng, palette, seed)
    speckle(px, rng, 110, [shade(palette[2], 0.2), hexc("#3a2c46"), hexc("#46252e")])
    # 별같은 밝은 점 몇 개
    speckle(px, rng, 12, [hexc("#6a5a8a"), hexc("#7a4a52")])
    cracks(px, rng, 5, [hexc("#120f0e")], max_len=6)
    grid_bevel(px)
    img.save(f"{OUT}/{name}.png")
    print(f"{name}: abyss done")

# ---------------- 실행 (시드 고정 — 재현 가능) ----------------

if __name__ == "__main__":
    # 1) 잔디 — 메인 요청. 중간톤 베이스 + 짙은/밝은 풀 다발
    gen_grass_like("tile_grass", 1901, base="#79c865", tuft_dk="#4f9440", tuft_lt="#9ee084")
    # 2) 알프헤임 — 푸른 잔디 (기존 steel-blue 유지)
    gen_grass_like("tile_dark", 1902, base="#4c7895", tuft_dk="#375a72", tuft_lt="#6b9cba")
    # 3) 마그마
    gen_magma("tile_magma", 1903, ("#5c1c2b", "#6b2133", "#7a2a3d"))
    # 4) 눈
    gen_snow("tile_snow", 1904, ("#c3c6ec", "#d2d3f6", "#e2e4fb"))
    # 5) 동굴
    gen_rock("tile_cave", 1905, ("#221e20", "#282426", "#332d2f"),
             crack_cols=("#151213", "#1b1718"))
    # 6) 슬레이트 (니다벨리르)
    gen_rock("tile_stone", 1906, ("#1e2525", "#232a2a", "#2e3737"),
             crack_cols=("#131818", "#191f1f"), h_bias=True)
    # 7) 헬
    gen_rock("tile_hel", 1907, ("#223349", "#273b54", "#324863"),
             crack_cols=("#16222f", "#1b2a3c"), speck_n=110)
    # 8) 심연
    gen_abyss("tile_abyss", 1908, ("#181514", "#1e1b19", "#282320"))
    print("ALL DONE")
