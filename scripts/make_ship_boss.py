#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
유령선 보스 (미드가르드 — behemoth 슬롯) 픽셀아트 생성
6열 × 7행, 셀 256×171 (2x 드로잉 후 다운스케일)
행: 0=idle(부유) 1=walk(항해) 2=atk(대포) 3=death(침몰) 4=sp1(일제사격) 5=sp2(수龙발) 6=sp3(유령화염)
"""
from PIL import Image, ImageDraw, ImageFilter
import math, random, os

OUT = "/home/z/my-project/public/assets"
CW, CH = 256, 171      # 최종 셀
S = 2                   # 드로잉 배율
W, H = CW * S, CH * S   # 512x342

# ---------------- 팔레트 ----------------
HULL_D  = (52, 36, 26, 255)    # 선체 어두운 판
HULL_M  = (82, 58, 40, 255)    # 판 중간
HULL_L  = (108, 80, 54, 255)   # 판 밝은 모서리
SEAM    = (30, 20, 14, 255)    # 판 사이
TRIM    = (96, 255, 214, 255)  # 유령 청록 트림
TRIM_D  = (40, 140, 118, 255)
MAST    = (44, 30, 20, 255)
YARD    = (64, 46, 30, 255)
SAIL_M  = (186, 206, 200, 255) # 낡은 돛
SAIL_D  = (138, 160, 156, 255)
SAIL_HL = (224, 238, 232, 255)
FLAG    = (110, 255, 220, 255)
PORT    = (16, 12, 10, 255)
FLASH_C = (255, 250, 210, 255)
FLASH_O = (255, 210, 120, 200)
WISP    = (150, 255, 230, 160)
WISP_C  = (225, 255, 248, 220)
FOAM    = (140, 226, 210, 150)

def rot(px, py, cx, cy, deg):
    a = math.radians(deg)
    dx, dy = px - cx, py - cy
    return cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a)

def poly(d, pts, fill):
    d.polygon([(float(x), float(y)) for x, y in pts], fill=fill)

def draw_hull(d, deck_y, tilt=0.0):
    """선체 — 좌현(bow)이 왼쪽. deck_y: 갑판 기준 y"""
    cx, cy = W / 2, H / 2
    # 갑판 라인 (bow 높게, stern 더 높음)
    bow_x, stern_x = 56, 470
    deck_pts = [(bow_x, deck_y - 8)]
    for i in range(1, 10):
        t = i / 9
        x = bow_x + (stern_x - bow_x) * t
        y = deck_y - 8 - 10 * math.sin(t * math.pi) - 8 * t  # 완만한 S 커브
        deck_pts.append((x, y))
    keel_y = deck_y + 62
    # 선체 외곽 (갑판→용골)
    hull_pts = list(deck_pts)
    hull_pts += [(stern_x + 12, keel_y - 18), (stern_x - 30, keel_y), (300, keel_y + 6),
                 (160, keel_y + 2), (86, keel_y - 14), (bow_x + 6, deck_y + 34)]
    poly(d, hull_pts, HULL_M)
    # 판자 (수평 스트립 + 이음새)
    top_y = min(p[1] for p in hull_pts)
    y = top_y + 6
    row = 0
    while y < keel_y + 4:
        h2 = 11 if row % 2 == 0 else 9
        # 스트립을 폴리곤 클리핑 흉내: 양끝 x를 선체 폭에 맞춰 조임
        t0 = (y - deck_y) / (keel_y - deck_y)
        inset = int(max(0, 90 * t0 * t0)) if t0 > 0 else 0
        x0, x1 = bow_x + 4 + inset, stern_x + 8 - inset
        if x1 > x0:
            d.rectangle([x0, y, x1, y + h2 - 2], fill=HULL_M if row % 2 else HULL_D)
            d.line([(x0, y + h2 - 1), (x1, y + h2 - 1)], fill=SEAM, width=2)
            # 세로 이음새
            for sx in range(x0 + 30, x1, 74 + (row % 3) * 11):
                d.line([(sx, y), (sx, y + h2 - 2)], fill=SEAM, width=1)
        y += h2
        row += 1
    # 갑판 상단 라인 + 트림 발광
    d.line([(p[0], p[1]) for p in deck_pts], fill=HULL_L, width=3)
    for p in deck_pts:
        d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=TRIM)
    # bow 장식 (용두 — 청록 발광)
    bx, by = deck_pts[0]
    poly(d, [(bx - 16, by - 26), (bx + 6, by - 2), (bx - 2, by + 2), (bx - 12, by - 8)], TRIM_D)
    poly(d, [(bx - 13, by - 22), (bx + 2, by - 3), (bx - 5, by - 1)], TRIM)
    # 선미 랜턴
    d.ellipse([stern_x + 6, deck_y - 26, stern_x + 18, deck_y - 14], fill=TRIM_D)
    d.ellipse([stern_x + 8, deck_y - 24, stern_x + 16, deck_y - 16], fill=TRIM)
    # 대포 포문 3개
    for px_ in (180, 268, 356):
        py_ = deck_y + 26
        d.ellipse([px_ - 9, py_ - 7, px_ + 9, py_ + 7], fill=(20, 15, 12, 255))
        d.ellipse([px_ - 9, py_ - 7, px_ + 9, py_ + 7], outline=(12, 9, 7, 255), width=2)
        d.rectangle([px_ - 14, py_ - 3, px_ + 2, py_ + 3], fill=PORT)

def draw_masts(d, base_deck_y, billow=0.0, tilt=0.0, broken=False):
    """돛대 2개 + 찢어진 돛"""
    cx, cy = W / 2, H / 2
    def mast(mx, top, sail_w, sail_h, yard_y):
        x0, y0 = mx, base_deck_y - 6
        x1, y1 = rot(mx, top, mx, y0, tilt if not broken else tilt * 4)
        d.line([(x0, y0), (x1, y1)], fill=MAST, width=6)
        tx, ty = x1, y1
        if not broken:
            # 크로스야드
            d.line([(tx - sail_w // 2, ty + 14), (tx + sail_w // 2, ty + 14)], fill=YARD, width=4)
            # 돛 — 바람(왼쪽)으로 부풀며 아래 찢어진 지그재그
            lw, rw = tx - sail_w // 2, tx + sail_w // 2
            ly = ty + 16
            by_ = ly + sail_h
            pts = [(lw, ly)]
            steps = 8
            for i in range(steps + 1):
                t = i / steps
                xx = lw + (rw - lw) * t
                bulge = math.sin(t * math.pi) * (10 + billow * 14)
                pts.append((xx, by_ - bulge + (4 if i % 2 == 0 else -2)))
            pts.append((rw, ly))
            poly(d, pts, SAIL_M)
            # 찢어진 홀 + 그림자
            for i in range(2):
                hx = lw + (rw - lw) * (0.3 + 0.35 * i)
                poly(d, [(hx, by_ - 14), (hx + 12, by_ - 2), (hx + 4, by_ - 16)], (30, 40, 38, 0))
            d.line([(lw, ly), (rw, ly)], fill=SAIL_D, width=3)
            d.line([(lw, ly + 6), (rw - 6, ly + 6)], fill=SAIL_HL, width=2)
        # 깃대 장식 + 깃발
        if not broken:
            d.polygon([(tx, ty - 22), (tx + 16, ty - 16), (tx, ty - 10)], fill=FLAG)
        return tx, ty
    mast(168, 96, 118, 96, 0)
    mx, my = mast(330, 58, 148, 120, 0)
    if not broken:
        # 까마귀 둥지
        d.rectangle([mx - 14, my + 26, mx + 14, my + 36], fill=HULL_D)
        d.rectangle([mx - 12, my + 24, mx + 12, my + 28], fill=HULL_M)
        # 밧줄
        for (ex, ey) in [(66, base_deck_y - 14), (452, base_deck_y - 22)]:
            d.line([(mx, my + 8), (ex, ey)], fill=(70, 52, 36, 255), width=2)

def draw_ghost_flames(d, seed, intensity=1.0, base_deck_y=150):
    """선체 주위 유령 화염 위스프"""
    rnd = random.Random(seed)
    n = int(7 * intensity)
    for _ in range(n):
        x = rnd.uniform(60, W - 60)
        y = rnd.uniform(base_deck_y + 18, base_deck_y + 66)
        r = rnd.uniform(4, 13) * (0.7 + intensity * 0.4)
        dy = rnd.uniform(-r * 2.2, -r * 1.2)
        d.ellipse([x - r, y - r + dy * 0.4, x + r, y + r + dy * 0.4], fill=WISP)
        d.ellipse([x - r * 0.5, y - r * 0.5 + dy, x + r * 0.5, y + r * 0.5 + dy], fill=WISP_C)
    # 수면 포말
    for i in range(5):
        x = rnd.uniform(50, W - 50)
        y = base_deck_y + 70 + rnd.uniform(-4, 6)
        d.ellipse([x - 16, y - 3, x + 16, y + 3], fill=FOAM)

def draw_flash(d, x, y, scale=1.0):
    """대포 화염 — 방사형 섬광"""
    for r, col, n in [(46, FLASH_O, 10), (30, FLASH_C, 8)]:
        for i in range(n):
            a = (2 * math.pi * i) / n + 0.3
            rr = r * scale * (0.7 + 0.5 * ((i * 37) % 5) / 5)
            x2, y2 = x + math.cos(a) * rr, y + math.sin(a) * rr * 0.7
            d.line([(x, y), (x2, y2)], fill=col, width=int(6 * scale))
    d.ellipse([x - 16 * scale, y - 12 * scale, x + 16 * scale, y + 12 * scale], fill=FLASH_C)

def draw_smoke(d, x, y, seed, k=1):
    rnd = random.Random(seed)
    for i in range(6 * k):
        r = rnd.uniform(8, 20)
        dx, dy = rnd.uniform(-30, 30), rnd.uniform(-34, -6)
        a = max(0, 120 - i * 14)
        d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r], fill=(170, 180, 178, a))

def draw_spout(d, x, y_base, hgt, seed=1):
    """청록 물기둥"""
    rnd = random.Random(seed)
    w_top = max(6, hgt * 0.24)
    poly(d, [(x - w_top * 1.4, y_base), (x - w_top, y_base - hgt), (x + w_top, y_base - hgt),
             (x + w_top * 1.4, y_base)], (110, 225, 205, 210))
    poly(d, [(x - w_top * 0.7, y_base), (x - w_top * 0.5, y_base - hgt * 0.92), (x + w_top * 0.5, y_base - hgt * 0.92),
             (x + w_top * 0.7, y_base)], (170, 245, 232, 220))
    for _ in range(int(hgt / 14)):
        px_ = x + rnd.uniform(-w_top * 1.8, w_top * 1.8)
        py_ = y_base - rnd.uniform(0, hgt * 1.15)
        r = rnd.uniform(2, 6)
        d.ellipse([px_ - r, py_ - r, px_ + r, py_ + r], fill=(150, 235, 218, 180))

def make_frame(row, idx, base_deck_y):
    """셀 프레임 하나 생성 (S배 캔버스)"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W / 2, H / 2

    if row == 0:  # idle 부유
        bob = [0, -5, -9, -5, -1, 3][idx]
        roll = [-1.2, 0.4, 1.3, 0.5, -0.7, -1.5][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.0, tilt=roll * 0.4)
        draw_hull(ds, base_deck_y, tilt=roll)
        img_s = img_s.rotate(roll, resample=Image.BICUBIC, center=(cx, cy))
        img.alpha_composite(img_s, (0, bob))
        draw_ghost_flames(d, seed=idx, intensity=0.55, base_deck_y=base_deck_y)
    elif row == 1:  # walk 항해
        bob = [-9, -3, 4, 9, 3, -4][idx]
        roll = [-2.2, -0.6, 1.8, 2.4, 0.4, -1.8][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.5 + 0.5 * math.sin(idx / 6 * 2 * math.pi), tilt=roll * 0.5)
        draw_hull(ds, base_deck_y, tilt=roll)
        img_s = img_s.rotate(roll, resample=Image.BICUBIC, center=(cx, cy))
        img.alpha_composite(img_s, (0, bob))
        # 항해 물결 꼬리
        for i in range(3):
            d.ellipse([40 + i * 30, base_deck_y + 72 + (idx % 2) * 3, 96 + i * 30, base_deck_y + 80], fill=FOAM)
        draw_ghost_flames(d, seed=idx + 10, intensity=0.75, base_deck_y=base_deck_y)
    elif row == 2:  # atk 대포 발사 (bow 포문)
        rec = [0, 8, 14, 10, 5, 0][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.3, tilt=0.5)
        draw_hull(ds, base_deck_y, tilt=-1.0 if idx in (1, 2, 3) else 0.0)
        img_s = img_s.rotate(-1.0 if idx in (1, 2) else 0.0, resample=Image.BICUBIC, center=(cx, cy))
        img.alpha_composite(img_s, (rec, 0))
        if 0 <= idx <= 3:
            sc = [1.0, 1.35, 1.1, 0.6][idx]
            draw_flash(d, 150 - rec * 0.5, base_deck_y + 28, sc)
        if idx >= 2:
            draw_smoke(d, 160, base_deck_y + 16, seed=idx, k=1)
    elif row == 3:  # death 침몰
        sink = [0, 16, 34, 54, 76, 100][idx]
        tilt = [0, -3, -7, -12, -18, -24][idx]
        alpha = [255, 240, 220, 190, 150, 110][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=-0.3, tilt=tilt, broken=idx >= 2)
        draw_hull(ds, base_deck_y, tilt=tilt)
        img_s = img_s.rotate(tilt, resample=Image.BICUBIC, center=(cx, cy))
        if alpha < 255:
            a = img_s.getchannel("A").point(lambda v: v * alpha // 255)
            img_s.putalpha(a)
        img.alpha_composite(img_s, (0, sink))
        # 침수 — 수면이 선체를 덮음
        wl = base_deck_y + 70 - sink * 0.55
        if 40 < wl < H:
            d.rectangle([0, wl, W, H], fill=(24, 52, 66, 150))
            d.line([(0, wl), (W, wl)], fill=(140, 226, 210, 170), width=3)
        # 떠오르는 혼
        rnd = random.Random(idx)
        for _ in range(3 + idx):
            x = rnd.uniform(80, W - 80)
            y = base_deck_y - rnd.uniform(10, 60) - idx * 8
            r = rnd.uniform(3, 8)
            d.ellipse([x - r, y - r, x + r, y + r], fill=WISP_C)
    elif row == 4:  # sp1 일제 사격
        rec = [0, 10, 12, 8, 4, 0][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.2, tilt=-0.6)
        draw_hull(ds, base_deck_y)
        img_s = img_s.rotate(-0.6, resample=Image.BICUBIC, center=(cx, cy))
        img.alpha_composite(img_s, (rec, 0))
        for px_ in (180, 268, 356):
            if idx <= 2:
                sc = [0.9, 1.25, 0.8][idx]
                draw_flash(d, px_ - 20 - rec * 0.4, base_deck_y + 28, sc)
        if idx >= 1:
            draw_smoke(d, 250, base_deck_y + 14, seed=idx + 30, k=2)
    elif row == 5:  # sp2 용솟음
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.4, tilt=1.0)
        draw_hull(ds, base_deck_y, tilt=1.0)
        img_s = img_s.rotate(1.0, resample=Image.BICUBIC, center=(cx, cy))
        img.alpha_composite(img_s, (0, [0, -3, -6, -6, -3, 0][idx]))
        hgt = [26, 96, 150, 172, 110, 46][idx]
        draw_spout(d, 108, base_deck_y + 74, hgt, seed=idx)
        if idx >= 3:
            draw_spout(d, 400, base_deck_y + 74, hgt * 0.6, seed=idx + 7)
    else:  # sp3 유령 화염 폭발
        inten = [0.4, 1.0, 1.6, 2.0, 1.4, 0.8][idx]
        img_s = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ds = ImageDraw.Draw(img_s)
        draw_masts(ds, base_deck_y, billow=0.0, tilt=0.0)
        draw_hull(ds, base_deck_y)
        img.alpha_composite(img_s, (0, 0))
        draw_ghost_flames(d, seed=idx + 50, intensity=inten, base_deck_y=base_deck_y)
        if idx in (2, 3):
            rnd = random.Random(idx)
            for _ in range(10):
                x, y = rnd.uniform(60, W - 60), rnd.uniform(60, base_deck_y + 60)
                r = rnd.uniform(5, 14)
                d.ellipse([x - r, y - r * 1.6, x + r, y + r * 0.6], fill=WISP)
                d.ellipse([x - r * 0.4, y - r * 1.2, x + r * 0.4, y + r * 0.2], fill=WISP_C)
    return img

def build_ship():
    sheet = Image.new("RGBA", (CW * 6, CH * 7), (0, 0, 0, 0))
    for r in range(7):
        for c in range(6):
            fr = make_frame(r, c, base_deck_y=150 * S).resize((CW, CH), Image.LANCZOS)
            sheet.alpha_composite(fr, (c * CW, r * CH))
    path = f"{OUT}/bsw_behemoth.webp"
    sheet.save(path, "WEBP", quality=88, alpha_quality=100, method=4)
    print(f"  ✓ bsw_behemoth.webp {sheet.size[0]}x{sheet.size[1]} {os.path.getsize(path)//1024}KB")
    # 검증용 몽타주
    bg = Image.new("RGBA", sheet.size, (24, 24, 36, 255))
    bg.alpha_composite(sheet)
    bg.convert("RGB").save("/tmp/bossbuild/ship_check.jpg", quality=85)

if __name__ == "__main__":
    build_ship()
