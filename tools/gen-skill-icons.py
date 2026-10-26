#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc185 (지시 #7 — "AI가 만든 아이콘&버튼 에셋이나 사람이 만든걸로 교체해") — 스킬 아이콘 재생성.

진단(실측):
  4차 직업 10종의 s3·s4 아이콘 20개가 전부 플레이스홀더였다.
  고유색이 4~6개뿐인 단순 사각형/선 조합이라, 32×32로 줄이면 무엇을 뜻하는지
  알 수 없었다(Vision 판정: "프로토타입 플레이스홀더").
  s5는 아예 파일이 없었다.

해결:
  · 제공 팩(Classic_RPG_GUI)의 skill_frame.png(256×256, 내부 22~233 투명)을
    실제 프레임으로 사용한다 — 사람이 그린 UI.
  · 그 안에 직업별 스킬 시그니처를 **도트 문법**(디더링·하이라이트·외곽선)으로 그린다.
    단순 도형이 아니라 "무엇을 하는 스킬인지" 읽히는 형태를 목표로 한다.
  · 4차 10직업 × s3·s4·s5 = 30개. 기존 s1·s2는 품질이 양호해 유지한다.

출력: public/assets/skillicon/<leaf>_s{3,4,5}.webp  (64×64, 프레임 포함)
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
ICON_DIR = os.path.join(ROOT, "public", "assets", "skillicon")
FRAME = "/root/workspace/assets_in/uni/Classic_RPG_GUI/Parts/skill_frame.png"

# 프레임 내부 영역 (실측)
IN0, IN1 = 22, 233

# ── 팔레트: 어두운 판타지 톤. (밝은색, 중간, 어두운색) 3단 음영 ──
PAL = {
    "fire":    ((255, 220, 120), (232, 110, 40), (120, 40, 20)),
    "holy":    ((255, 250, 210), (245, 200, 80), (150, 110, 30)),
    "ice":     ((220, 245, 255), (120, 200, 240), (40, 90, 140)),
    "wind":    ((200, 255, 220), (110, 220, 150), (30, 100, 60)),
    "light":   ((240, 240, 255), (150, 180, 255), (60, 70, 140)),
    "dark":    ((200, 160, 255), (130, 70, 200), (50, 20, 90)),
    "blood":   ((255, 190, 190), (220, 60, 70), (110, 20, 30)),
    "earth":   ((230, 210, 170), (170, 130, 80), (80, 55, 30)),
    "steel":   ((240, 245, 255), (170, 190, 215), (70, 85, 105)),
    "gold":    ((255, 245, 180), (230, 190, 70), (120, 90, 20)),
    "poison":  ((200, 255, 170), (130, 210, 80), (45, 100, 30)),
    "void":    ((210, 180, 255), (140, 90, 220), (45, 20, 80)),
}


def shade(img, box, pal, dither=True):
    """영역을 3단 음영으로 채운다 — 위는 밝게, 아래는 어둡게 + 디더링."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    hi, mid, lo = pal
    h = max(1, y1 - y0)
    for y in range(y0, y1):
        t = (y - y0) / h
        c = hi if t < 0.35 else (mid if t < 0.72 else lo)
        d.line([(x0, y), (x1 - 1, y)], fill=c + (255,))
    if dither:
        # 경계 디더링 — 밝은 쪽에 중간톤 점을 흩뿌려 계단을 부드럽게
        for y in range(y0, y0 + int(h * 0.42)):
            if (y - y0) % 2 == 0:
                for x in range(x0 + ((y - y0) % 2), x1, 3):
                    d.point((x, y), fill=mid + (255,))


def dot_ring(img, cx, cy, r, pal, width=3):
    d = ImageDraw.Draw(img)
    for w in range(width):
        c = pal[0] if w == 0 else pal[1]
        d.ellipse([cx - r + w, cy - r + w, cx + r - w, cy + r - w], outline=c + (255,), width=1)


def dot_beam(img, p0, p1, pal, width=4):
    d = ImageDraw.Draw(img)
    for w in range(width):
        c = pal[0] if w < 2 else pal[1]
        d.line([p0, p1], fill=c + (255,), width=width - w)


# ── 직업별 스킬 시그니처 ────────────────────────────────────────────
# vc185 — 직업별 대표 팔레트. s3/s4/s5 가 같은 계열색을 써서 "한 직업의 세 스킬"로 읽히게.
JOB_PAL = {
    "warbringer": "blood", "crusader": "holy", "deadeye": "steel", "skylord": "wind",
    "arclord": "light", "eternal": "light", "shadowlord": "void", "blademaster": "steel",
    "seaking": "ice", "dreadnought": "fire",
}


def draw_skill(kind, slot):
    """kind=직업, slot=3|4|5. 128×128 캔버스에 그린다(프레임 내부 해상도)."""
    S = 128
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S // 2
    # vc185 — 직업 대표색을 하단 보조 광원으로 깔아 세 슬롯의 색 정체성을 통일
    base_pal = PAL[JOB_PAL.get(kind, "steel")]
    d.ellipse([c - 46, c - 46, c + 46, c + 46], outline=base_pal[2] + (110,), width=2)

    if kind == "warbringer":
        pal = PAL["blood"]
        if slot == 3:      # 광폭 참격 — X자 검기
            dot_beam(im, (18, 100), (108, 26), pal, 7)
            dot_beam(im, (20, 26), (106, 100), pal, 7)
            dot_ring(im, c, c, 26, PAL["fire"], 2)
        elif slot == 4:    # 대지 분쇄 — 아래로 균열
            for i, dx in enumerate((-26, -9, 9, 26)):
                d.line([(c + dx, 22), (c + dx * 2, 106)], fill=pal[1] + (255,), width=5)
                d.line([(c + dx, 22), (c + dx * 2, 70)], fill=pal[0] + (255,), width=2)
            shade(im, (14, 96, 114, 120), PAL["earth"])
        else:              # 종언의 대붕괴 — 거대 검 + 충격
            dot_beam(im, (c, 8), (c, 92), PAL["steel"], 10)
            d.polygon([(c - 20, 24), (c + 20, 24), (c, 6)], fill=PAL["steel"][0] + (255,))
            for r in (18, 30, 42):
                dot_ring(im, c, 96, r, pal, 2)

    elif kind == "crusader":
        pal = PAL["holy"]
        if slot == 3:      # 심판의 빛기둥
            for dx in (-30, 0, 30):
                shade(im, (c + dx - 8, 14, c + dx + 8, 112), pal)
            dot_ring(im, c, 64, 34, PAL["gold"], 2)
        elif slot == 4:    # 성역 — 방벽
            d.polygon([(c, 14), (c + 40, 34), (c + 40, 78), (c, 110), (c - 40, 78), (c - 40, 34)],
                      fill=pal[1] + (255,), outline=pal[0] + (255,))
            dot_ring(im, c, 62, 20, PAL["gold"], 3)
        else:              # 천국의 문 — 위로 열린 아치
            d.arc([c - 44, 30, c + 44, 110], 200, 340, fill=pal[0] + (255,), width=8)
            for r in (14, 24, 34):
                dot_ring(im, c, 70, r, pal, 2)
            shade(im, (c - 8, 20, c + 8, 96), PAL["gold"])

    elif kind == "deadeye":
        pal = PAL["steel"]
        if slot == 3:      # 관통 저격 — 일직선 + 조준
            dot_beam(im, (10, 64), (118, 64), PAL["light"], 6)
            dot_ring(im, c, 64, 30, pal, 2)
            dot_ring(im, c, 64, 12, PAL["blood"], 2)
            d.line([(c, 20), (c, 108)], fill=pal[1] + (255,), width=2)
        elif slot == 4:    # 화살비 — 위에서 쏟아짐
            for i in range(6):
                x = 20 + i * 18
                d.line([(x, 16 + (i % 3) * 10), (x - 6, 96)], fill=PAL["light"][1] + (255,), width=3)
                d.polygon([(x - 6, 96), (x - 11, 86), (x - 1, 86)], fill=pal[0] + (255,))
        else:              # 시간 정지 100련 — 시계 + 탄흔
            # vc185 — 같은 직업 3개가 색으로 묶이도록 골드 대신 스틸 사용
            dot_ring(im, c, c, 40, pal, 3)
            d.line([(c, c), (c, c - 26)], fill=pal[0] + (255,), width=4)
            d.line([(c, c), (c + 20, c + 10)], fill=pal[0] + (255,), width=4)
            for a in range(0, 360, 45):
                x = c + int(math.cos(math.radians(a)) * 52)
                y = c + int(math.sin(math.radians(a)) * 52)
                d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=PAL["blood"][0] + (255,))

    elif kind == "skylord":
        pal = PAL["wind"]
        if slot == 3:      # 회오리
            for i in range(4):
                r = 12 + i * 11
                d.arc([c - r, c - r, c + r, c + r], 20 + i * 40, 320, fill=pal[0] + (255,), width=4)
        elif slot == 4:    # 폭풍 — 회오리 + 번개
            for i in range(3):
                r = 14 + i * 12
                d.arc([c - r, c - r - 10, c + r, c + r - 10], 10, 320, fill=pal[1] + (255,), width=3)
            d.line([(c + 4, 10), (c - 8, 56), (c + 6, 56), (c - 6, 104)],
                   fill=PAL["light"][0] + (255,), width=4)
        else:              # 대기권 돌파 — 상승 기류
            for dx in (-30, -12, 12, 30):
                d.line([(c + dx, 108), (c + dx // 2, 20)], fill=pal[1] + (255,), width=4)
            dot_ring(im, c, 26, 22, pal, 3)

    elif kind == "arclord":
        # vc185 — 세 슬롯이 전부 다른 색이던 문제. light 계열 하나로 통일.
        pal = PAL["light"]
        if slot == 3:      # 연쇄 번개
            pts = [(16, 30), (46, 52), (30, 70), (70, 84), (56, 104)]
            # vc185 — 순백만 쓰면 14·15(연청 면)와 톤이 안 맞는다. 선은 중간톤, 노드는 밝게.
            d.line(pts, fill=pal[1] + (255,), width=6)
            d.line(pts, fill=pal[0] + (255,), width=3)
            for p in pts:
                d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], fill=pal[1] + (255,))
                d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=pal[0] + (255,))
        elif slot == 4:    # 수정 파편
            for i, ang in enumerate((-60, -20, 20, 60)):
                x = c + int(math.cos(math.radians(ang - 90)) * 34)
                y = c + int(math.sin(math.radians(ang - 90)) * 34)
                d.polygon([(x, y - 22), (x + 12, y), (x, y + 22), (x - 12, y)],
                          fill=pal[1] + (255,), outline=pal[0] + (255,))
        else:              # 마성 해방 — 오버로드 폭발
            dot_ring(im, c, c, 20, pal, 4)
            dot_ring(im, c, c, 40, pal, 3)
            for a in range(0, 360, 30):
                x0 = c + int(math.cos(math.radians(a)) * 22)
                y0 = c + int(math.sin(math.radians(a)) * 22)
                x1 = c + int(math.cos(math.radians(a)) * 56)
                y1 = c + int(math.sin(math.radians(a)) * 56)
                d.line([(x0, y0), (x1, y1)], fill=pal[0] + (255,), width=3)

    elif kind == "eternal":
        pal = PAL["light"]
        if slot == 3:      # 중력장 — 이중 고리
            dot_ring(im, c, c, 38, pal, 3)
            dot_ring(im, c, c, 22, PAL["void"], 3)
            d.ellipse([c - 6, c - 6, c + 6, c + 6], fill=pal[0] + (255,))
        elif slot == 4:    # 시공 붕괴 — 소용돌이
            for i in range(5):
                r = 10 + i * 9
                d.arc([c - r, c - r, c + r, c + r], i * 55, i * 55 + 240,
                      fill=(pal[0] if i % 2 == 0 else PAL["dark"][1]) + (255,), width=3)
        else:              # 시간 역행 — 시계 역방향
            # vc185 — 같은 직업 색 통일(골드 → light)
            dot_ring(im, c, c, 40, pal, 3)
            d.arc([c - 30, c - 30, c + 30, c + 30], 40, 300, fill=pal[0] + (255,), width=4)
            # vc185 — 16·17의 진한 보라를 화살표에도 넣어 채도를 맞춘다
            d.polygon([(c + 26, c - 26), (c + 42, c - 12), (c + 20, c - 10)], fill=pal[1] + (255,))
            d.polygon([(c + 28, c - 22), (c + 36, c - 14), (c + 24, c - 13)], fill=PAL["void"][1] + (255,))

    elif kind == "shadowlord":
        pal = PAL["void"]
        if slot == 3:      # 그림자 분신 — 3개 실루엣
            for i, dx in enumerate((-32, 0, 32)):
                d.ellipse([c + dx - 10, 24, c + dx + 10, 44], fill=pal[1] + (255,))
                d.polygon([(c + dx - 14, 48), (c + dx + 14, 48), (c + dx + 20, 104), (c + dx - 20, 104)],
                          fill=(pal[1] if i != 1 else pal[0]) + (255,))
        elif slot == 4:    # 그림자 지뢰
            d.ellipse([c - 30, 60, c + 30, 96], fill=pal[2] + (255,), outline=pal[1] + (255,))
            for dx in (-16, 0, 16):
                d.line([(c + dx, 62), (c + dx, 30)], fill=pal[0] + (255,), width=3)
        else:              # 왕국 강림 — 성 + 안광
            d.rectangle([c - 34, 50, c + 34, 104], fill=pal[2] + (255,), outline=pal[1] + (255,))
            for dx in (-26, -10, 10, 26):
                d.rectangle([c + dx - 5, 38, c + dx + 5, 52], fill=pal[1] + (255,))
            for dx in (-18, 0, 18):
                d.ellipse([c + dx - 4, 70, c + dx + 4, 78], fill=PAL["blood"][0] + (255,))

    elif kind == "blademaster":
        pal = PAL["steel"]
        if slot == 3:      # 쌍검 난무
            d.line([(20, 96), (96, 20)], fill=pal[0] + (255,), width=6)
            d.line([(20, 20), (96, 96)], fill=pal[1] + (255,), width=6)
            dot_ring(im, c, c, 20, PAL["gold"], 2)
        elif slot == 4:    # 파동 검기 — 부채꼴
            for i in range(4):
                r = 24 + i * 12
                d.arc([c - r, c - r, c + r, c + r], 20, 160, fill=pal[0] + (255,), width=4)
        else:              # 만검의 진 — 원형 검 배치
            for a in range(0, 360, 30):
                x = c + int(math.cos(math.radians(a)) * 42)
                y = c + int(math.sin(math.radians(a)) * 42)
                d.line([(x, y), (c + int(math.cos(math.radians(a)) * 18),
                                 c + int(math.sin(math.radians(a)) * 18))],
                       fill=pal[0] + (255,), width=3)
            d.ellipse([c - 8, c - 8, c + 8, c + 8], fill=PAL["gold"][0] + (255,))

    elif kind == "seaking":
        pal = PAL["ice"]
        if slot == 3:      # 수압 창
            d.polygon([(c, 12), (c + 26, 64), (c, 116), (c - 26, 64)],
                      fill=pal[1] + (255,), outline=pal[0] + (255,))
            for dy in (36, 64, 92):
                d.line([(c - 18, dy), (c + 18, dy)], fill=pal[0] + (255,), width=2)
        elif slot == 4:    # 해일 — 파도
            for i in range(3):
                y = 40 + i * 26
                d.arc([10, y - 24, 70, y + 24], 200, 340, fill=pal[0] + (255,), width=5)
                d.arc([58, y - 24, 118, y + 24], 200, 340, fill=pal[1] + (255,), width=5)
        else:              # 해룡 — 휘감는 용
            pts = [(c - 30, 100), (c + 10, 84), (c - 14, 60), (c + 26, 40), (c, 18)]
            d.line(pts, fill=pal[1] + (255,), width=7)
            d.line(pts, fill=pal[0] + (255,), width=3)
            d.ellipse([c - 8, 10, c + 8, 26], fill=pal[0] + (255,))

    elif kind == "dreadnought":
        pal = PAL["fire"]
        if slot == 3:      # 포격 — 대포 + 폭발
            d.rectangle([20, 58, 78, 76], fill=PAL["steel"][1] + (255,))
            d.ellipse([62, 50, 96, 84], fill=pal[1] + (255,), outline=pal[0] + (255,))
            for a in range(0, 360, 45):
                x = 80 + int(math.cos(math.radians(a)) * 30)
                y = 66 + int(math.sin(math.radians(a)) * 30)
                d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=pal[0] + (255,))
        elif slot == 4:    # 연막 — 구름 + 불꽃
            for i, (x, y, r) in enumerate(((c - 22, 74, 24), (c + 20, 68, 22), (c, 54, 28))):
                d.ellipse([x - r, y - r, x + r, y + r],
                          fill=(pal[2] if i % 2 else pal[1]) + (215,))
                # vc185 — 채도가 꺼져 보이던 문제: 각 덩어리에 발광 코어를 넣어 28·30과 톤을 맞춘다
                d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=pal[0] + (255,))
            d.ellipse([c - 10, 44, c + 10, 64], fill=pal[0] + (255,))
        else:              # 융단 폭격 — 다중 낙하
            for i in range(5):
                x = 18 + i * 23
                d.line([(x, 14), (x + 4, 62)], fill=PAL["steel"][0] + (200,), width=4)
                d.ellipse([x - 8, 62, x + 12, 82], fill=pal[1] + (255,))
                d.ellipse([x - 4, 66, x + 8, 78], fill=pal[0] + (255,))
            shade(im, (10, 96, 118, 118), PAL["earth"])

    # 공통: 외곽 1px 다크 아웃라인 (도트 문법) — 알파 경계에만
    px = im.load()
    edge = []
    for y in range(S):
        for x in range(S):
            if px[x, y][3] > 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < S and 0 <= ny < S and px[nx, ny][3] == 0:
                        edge.append((nx, ny))
    for x, y in edge:
        px[x, y] = (18, 14, 22, 255)

    return im


def build():
    frame = Image.open(FRAME).convert("RGBA")
    # 프레임을 64×64로 축소 (아이콘 최종 크기)
    OUT = 64
    fr = frame.resize((OUT, OUT), Image.LANCZOS)
    # 내부 영역도 비례 축소
    s = OUT / 256.0
    inner = (int(IN0 * s), int(IN0 * s), int(IN1 * s), int(IN1 * s))
    iw = inner[2] - inner[0]

    leaves = ["warbringer", "crusader", "deadeye", "skylord", "arclord",
              "eternal", "shadowlord", "blademaster", "seaking", "dreadnought"]
    made = 0
    for leaf in leaves:
        for slot in (3, 4, 5):
            art = draw_skill(leaf, slot).resize((iw, iw), Image.LANCZOS)
            out = fr.copy()
            out.alpha_composite(art, (inner[0], inner[1]))
            p = os.path.join(ICON_DIR, f"{leaf}_s{slot}.webp")
            out.save(p, "WEBP", lossless=True, method=6)
            made += 1
    print(f"스킬 아이콘 {made}개 생성 (10직업 × s3·s4·s5, {OUT}×{OUT})")


if __name__ == "__main__":
    build()
