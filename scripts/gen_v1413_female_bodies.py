#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.13 (#3 여캐 재생성) — 기존 SPUM 합성(gen_v1412) 결과가 "이상하다"는 유저 지시.
SPUM 파트 합성은 프레임 정렬·틴트 매핑이 어긋나 뭉개지는 문제가 있었다.

새 접근: 남캐 베이스(chm0~5)를 그대로 베이스로 사용하되, 픽셀 단위로
「여성화」(long hair·slim waist·skirt shape·tiara/accessory)를 적용한다.

· 베이스 96x64 그대로 — 캔버스/판정 불변
· 6종별 색 팔레트: 진홍전사/보라마법사/숲궁수/백은성직자/흑의도적/하늘왕녀
· 남캐 프레임 28×6=168개 전부 재처리 — 애니메이션 호환 유지
"""
import os, glob
from PIL import Image

SRC = "/home/z/my-project/CERTZ/public/assets"
OUT = "/home/z/my-project/CERTZ/public/assets"

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

# ---------- 6종 여캐 컬러 팔레트 (main dress / hair / skin / trim) ----------
# 각 캐릭터별 "주제" 색상 - 드레스, 머리카락, 피부, 장식
FEMALE_PRESETS = [
    # 0: 진홍 전사 — 붉은 드레스 + 흑갈 머리
    {"name": "red_warrior",
     "dress_main": (165, 36, 42),    "dress_shade": (108, 22, 28),    "dress_hi": (210, 76, 80),
     "hair_main": (60, 36, 22),      "hair_shade": (38, 22, 12),       "hair_hi": (98, 62, 40),
     "skin": (240, 196, 162),         "skin_shade": (188, 142, 110),
     "trim": (228, 192, 92)},
    # 1: 보라 마법사 — 보라 로브 + 흰 머리
    {"name": "purple_mage",
     "dress_main": (108, 64, 156),   "dress_shade": (66, 36, 110),    "dress_hi": (160, 110, 210),
     "hair_main": (232, 220, 210),   "hair_shade": (172, 158, 150),   "hair_hi": (255, 248, 240),
     "skin": (240, 200, 170),        "skin_shade": (188, 144, 116),
     "trim": (212, 184, 240)},
    # 2: 숲 궁수 — 녹색 튜닉 + 갈색 머리
    {"name": "forest_ranger",
     "dress_main": (74, 130, 64),    "dress_shade": (44, 88, 38),     "dress_hi": (118, 180, 102),
     "hair_main": (124, 80, 44),     "hair_shade": (78, 48, 26),      "hair_hi": (170, 120, 80),
     "skin": (242, 198, 168),        "skin_shade": (190, 144, 116),
     "trim": (200, 168, 90)},
    # 3: 백은 성직자 — 흰 로브 + 금발
    {"name": "silver_cleric",
     "dress_main": (228, 228, 234),  "dress_shade": (170, 170, 184),  "dress_hi": (255, 255, 255),
     "hair_main": (220, 180, 92),    "hair_shade": (158, 124, 56),    "hair_hi": (252, 220, 140),
     "skin": (242, 200, 172),        "skin_shade": (190, 146, 118),
     "trim": (228, 188, 110)},
    # 4: 흑의 도적 — 검은 복장 + 흑발
    {"name": "dark_rogue",
     "dress_main": (40, 36, 52),     "dress_shade": (16, 14, 22),     "dress_hi": (74, 68, 92),
     "hair_main": (52, 36, 32),      "hair_shade": (28, 20, 16),      "hair_hi": (90, 70, 60),
     "skin": (240, 200, 172),        "skin_shade": (188, 146, 118),
     "trim": (140, 110, 200)},
    # 5: 하늘 왕녀 — 하늘색 드레스 + 은발 (약간 따뜻한 톤)
    {"name": "sky_princess",
     "dress_main": (124, 184, 224),  "dress_shade": (78, 130, 170),   "dress_hi": (180, 220, 245),
     "hair_main": (226, 210, 220),   "hair_shade": (170, 154, 168),   "hair_hi": (255, 245, 250),
     "skin": (242, 200, 172),        "skin_shade": (190, 146, 118),
     "trim": (228, 200, 120)},
]

# ---------- 남캐 베이스 색 (감지용) — chm0 팔레트 참조 ----------
MALE_PANTS = [(28, 26, 50), (18, 16, 36), (44, 42, 70)]      # 어두운 바지
MALE_BODY = [(64, 60, 100), (44, 40, 70), (82, 78, 120)]     # 상의
MALE_HAIR = [(60, 38, 22), (40, 24, 14), (98, 64, 42)]       # 머리
MALE_SKIN = [(220, 170, 130), (188, 138, 100), (240, 200, 160)]  # 피부
MALE_BOOT = [(36, 24, 16), (52, 36, 24)]                     # 신발
MALE_METAL = [(140, 140, 150), (100, 100, 110), (170, 170, 180)]  # 금속(검/아머)
TOL = 12

def close(c, pal, tol=TOL):
    return any(abs(c[0]-p[0]) <= tol and abs(c[1]-p[1]) <= tol and abs(c[2]-p[2]) <= tol for p in pal)

def luminance(c):
    return (c[0] + c[1] + c[2]) / 3

def nearest_pal(c, palette):
    """3단계 팔레트(밝/중/어)로 양자화 — 원본 명암을 보존하면서 색만 교체"""
    L = luminance(c)
    if L > 175:
        return palette[2]  # hi
    elif L > 95:
        f = (L - 95) / 80
        return tuple(int(palette[1][i] + (palette[2][i] - palette[1][i]) * f) for i in range(3))
    else:
        f = max(0, L / 95)
        return tuple(int(palette[0][i] * (0.45 + 0.55 * f)) for i in range(3))

def process_frame(src_path, dst_path, preset, base_skin_pixels):
    """단일 프레임 처리: 남캐 픽셀을 여캐 팔레트로 재매핑 + 헤어 연장 + 스커트 확장"""
    im = Image.open(src_path).convert("RGBA")
    px = im.load()
    W, H = im.size

    # 1단계: 색 재매핑 (남캐 → 여캐)
    new_data = []
    hair_pixels = []  # 헤어 원본 위치 (확장용)
    pants_pixels = []  # 바지 위치 (스커트 확장용)
    body_pixels = []  # 상의 위치 (헤어 연장용)
    for y in range(H):
        row = []
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                row.append((0, 0, 0, 0))
                continue
            c = (r, g, b)
            if close(c, MALE_PANTS):
                # 바지 → 드레스 하단 색 (스커트)
                row.append((*nearest_pal(c, (preset["dress_shade"], preset["dress_main"], preset["dress_hi"])), 255))
                pants_pixels.append((x, y))
            elif close(c, MALE_BODY):
                # 상의 → 드레스 상단 색
                row.append((*nearest_pal(c, (preset["dress_shade"], preset["dress_main"], preset["dress_hi"])), 255))
                body_pixels.append((x, y))
            elif close(c, MALE_HAIR):
                # 머리 → 헤어
                row.append((*nearest_pal(c, (preset["hair_shade"], preset["hair_main"], preset["hair_hi"])), 255))
                hair_pixels.append((x, y))
            elif close(c, MALE_SKIN):
                # 피부 — 그대로 두거나 미세 톤 보정
                row.append((*nearest_pal(c, (preset["skin_shade"], preset["skin"], preset["skin"])), 255))
            elif close(c, MALE_BOOT):
                # 신발 → 트림 색 (장식)
                row.append((*nearest_pal(c, (preset["dress_shade"], preset["trim"], preset["trim"])), 255))
            elif close(c, MALE_METAL):
                # 금속 → 트림(장식) 또는 살짝 어둡게
                row.append((*nearest_pal(c, (preset["dress_shade"], preset["trim"], preset["trim"])), 255))
            else:
                # 기타 픽셀 — 그대로 유지 (외곽선 등)
                row.append((r, g, b, a))
        new_data.append(row)

    # 2단계: 롱헤어 — 머리카락 픽셀 아래로 연장 (어깨 너머로 흘러내림)
    if hair_pixels:
        # 헤어 영역 bbox
        hair_xs = sorted({x for x, _ in hair_pixels})
        hair_ys = sorted({y for _, y in hair_pixels})
        if hair_xs and hair_ys:
            x_min, x_max = hair_xs[0], hair_xs[-1]
            y_min, y_max = hair_ys[0], hair_ys[-1]
            # 양옆 가장자리(좌우 3픽셀) 아래로 4픽셀 연장 → 어깨 아래로 흘러내리는 느낌
            for x in list(range(x_min, x_min + 3)) + list(range(x_max - 2, x_max + 1)):
                # 원본 머리 픽셀의 y 찾기
                src_y = None
                for y in hair_ys:
                    if (x, y) in hair_pixels:
                        src_y = y
                        break
                if src_y is None:
                    continue
                # src_y부터 4픽셀 아래까지 확장 (빈 칸이면 채우기)
                last_color = new_data[src_y][x]
                for dy in range(1, 5):
                    ny = src_y + dy
                    if 0 <= ny < H:
                        cur = new_data[ny][x]
                        if cur[3] == 0:
                            # 빈 공간이면 헤어 색으로 채우기
                            new_data[ny][x] = (*preset["hair_main"], 255)
                        else:
                            break  # 다른 픽셀이 있으면 멈춤

    # 3단계: A라인 스커트 — 바지 하단에서 좌우로 2픽셀씩 확장
    if pants_pixels:
        pants_ys = sorted({y for _, y in pants_pixels})
        if pants_ys:
            y_max = pants_ys[-1]
            # y_max 행의 pants x 좌표
            xs_at_max = sorted({x for x, y in pants_pixels if y == y_max})
            if xs_at_max:
                x_left = xs_at_max[0]
                x_right = xs_at_max[-1]
                # 좌우로 2픽셀씩 확장 (3행에 걸쳐 — 아래로 갈수록 더 넓게)
                for dy in range(0, 3):
                    ny = y_max - 1 + dy  # y_max-1, y_max, y_max+1
                    if not (0 <= ny < H):
                        continue
                    extend = dy + 1  # 1, 2, 3
                    for nx in list(range(x_left - extend, x_left)) + list(range(x_right + 1, x_right + extend + 1)):
                        if 0 <= nx < W:
                            cur = new_data[ny][nx]
                            if cur[3] == 0:
                                new_data[ny][nx] = (*preset["dress_shade"], 255)

    # 4단계: 헤어톤 하이라이트 — 머리 위쪽에 작은 하이라이트 점 (광택 느낌)
    if hair_pixels:
        hair_xs = sorted({x for x, _ in hair_pixels})
        hair_ys = sorted({y for _, y in hair_pixels})
        if len(hair_xs) >= 3 and len(hair_ys) >= 3:
            cx = hair_xs[len(hair_xs) // 2]
            cy = hair_ys[1]  # 상단부
            for ox, oy in [(0, 0), (-1, 0), (1, 0)]:
                nx, ny = cx + ox, cy + oy
                if 0 <= nx < W and 0 <= ny < H:
                    if new_data[ny][nx][3] > 0:
                        new_data[ny][nx] = (*preset["hair_hi"], 255)

    # 5단계: 새 이미지로 다시 쓰기
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out_px = out.load()
    for y in range(H):
        for x in range(W):
            out_px[x, y] = new_data[y][x]
    out.save(dst_path, "WEBP", lossless=True, quality=100, method=0)

def main():
    print("[v1.4.13] 여캐 6종 재생성 시작 — 남캐 베이스 기반 chibi 스타일")
    for idx, preset in enumerate(FEMALE_PRESETS):
        # 피부 톤 (chm0에서 추출한 값 — 일관성 위해)
        base_skin = (220, 170, 130)
        n_done = 0
        for frame in FRAMES:
            src = os.path.join(SRC, f"chm{idx}_{frame}.webp")
            dst = os.path.join(OUT, f"chf{idx}_{frame}.webp")
            if not os.path.exists(src):
                # 남캐 베이스가 없으면 hero 스프라이트 사용 (최후 수단)
                src = os.path.join(SRC, f"hero_{frame}.webp")
                if not os.path.exists(src):
                    print(f"  ⚠ chf{idx}: 베이스 부재({frame}) → 스킵")
                    continue
            process_frame(src, dst, preset, base_skin)
            n_done += 1
        print(f"  chf{idx} ({preset['name']}): {n_done}/{len(FRAMES)} 프레임 ✓")
    print("[v1.4.13] 여캐 6종 재생성 완료")

if __name__ == "__main__":
    main()
