#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.12 (#20 유저 지시 "에셋을 사용해야지 (ai 그림 너가 생성해서 절대 쓰지마) + 보스 애니메이션이 있는
에셋을 선호해야해") — 보스 9종 아트를 "실제 에셋팩 스프라이트"로 전면 교체.

AI 생성 일러스트(v1.4.9/11)를 전부 폐기하고, 게임이 이미 사용 중인 실제 에셋팩에서
보스 스프라이트를 추출·틴트·업스케일한다:

  소스 (전부 실제 에셋 — 50 Monsters Pack(CC) / 0x72 DungeonTileset II(CC0)):
   boss          심연의 수호자  ← x2_stonegolem (장벽 돌골렘)  보라 틴트
   boss2         눈보라의 거수  ← x3_ogre      (광포한 오거)   청백 틴트
   boss3         심연의 군주    ← x3_chort     (악마다라 촐트) 진홍 틴트
   boss_nidhog   탐식의 드래곤  ← x3_bigzombie (거대 시체)     부록 틴트
   boss_surt     화염의 거인    ← x3_orcwarrior(오르크 전사)  잉걸 틴트
   boss_fenrir   탐욕의 늑대    ← x2_darkhound (그늘 이리)     보라 틴트
   boss_skoll    교만의 쌍랑    ← x2_darkhound (그늘 이리)     금색 틴트 (하티는 코드 twin)
   boss_gram     혈안의 문지기  ← x3_wogol     (지옥견 워골)   혈안 틴트
   boss_abudditos 종언의 마룡   ← x2_firebird  (잿불 새)      암홍 틴트 — 날개 실루엣 마룡

· idle0/idle1 2프레임 (실제 시트 프레임 — 애니메이션 있음)
· 캔버스 크기 = 기존 보스와 정확히 동일 (fit_pad) → Boss.ts 히트박스·판정·밸런스 100% 불변
"""
from PIL import Image
import os

SRC = "/home/z/my-project/public/assets"
OUT = "/home/z/my-project/public/assets"

# (보스키, 소스몬스터, 틴트RGB, 목표 캔버스(W,H), 콘텐츠 최대높이비)
BOSSES = [
    ("boss",           "x2_stonegolem", (168, 128, 255), (111, 126)),
    ("boss2",          "x3_ogre",       (140, 190, 255), (94, 144)),
    ("boss3",          "x3_chort",      (255, 92, 110),  (110, 180)),
    ("boss_nidhog",    "x3_bigzombie",  (150, 210, 120), (124, 140)),
    ("boss_surt",      "x3_orcwarrior", (255, 130, 60),  (94, 144)),
    ("boss_fenrir",    "x2_darkhound",  (186, 120, 255), (145, 75)),
    ("boss_skoll",     "x2_darkhound",  (255, 216, 120), (151, 78)),
    ("boss_gram",      "x3_wogol",      (255, 70, 70),   (69, 81)),
    ("boss_abudditos", "x2_firebird",   (255, 60, 88),   (110, 180)),
]

def content(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def tint(im, rgb):
    """휘도 매핑 재염색 — 소스의 명암을 [그림자 → 메인 → 하이라이트] 그라디언트로 사상.
    어두운 소스(이리 등)에서도 틴트색이 선명하게 살아난다."""
    r, g, b = rgb
    shade = tuple(int(c * 0.42) for c in rgb)
    dark = tuple(int(c * 0.22) for c in rgb)
    hi = tuple(min(255, int(c * 1.35 + 40)) for c in rgb)
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            pr, pg, pb, a = px[x, y]
            if a == 0:
                continue
            L = (pr + pg + pb) / 3
            if L < 55:
                t = dark
            elif L < 120:
                f = (L - 55) / 65
                t = tuple(int(dark[i] + (shade[i] - dark[i]) * f) for i in range(3))
            elif L < 190:
                f = (L - 120) / 70
                t = tuple(int(shade[i] + (rgb[i] - shade[i]) * f) for i in range(3))
            else:
                f = min(1.0, (L - 190) / 55)
                t = tuple(int(rgb[i] + (hi[i] - rgb[i]) * f) for i in range(3))
            px[x, y] = (t[0], t[1], t[2], a)
    return out

def fit_pad(im, tw, th):
    """목표 캔버스에 컨텐츠 최대화 배치 (가로세로 비율 유지, 하단 중앙 정렬)"""
    cw, ch = im.size
    sc = min(tw / cw, th / ch)
    nw, nh = max(1, int(cw * sc)), max(1, int(ch * sc))
    im2 = im.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.alpha_composite(im2, ((tw - nw) // 2, th - nh))
    return canvas

def main():
    for boss_key, src_key, tint_rgb, (tw, th) in BOSSES:
        frames = []
        for fi in (0, 1):
            p = f"{SRC}/{src_key}_idle{fi}.webp"
            if not os.path.exists(p):
                print(f"[SKIP] {p} 없음")
                continue
            src = Image.open(p).convert("RGBA")
            c = content(src)
            c = tint(c, tint_rgb)
            # 컨텐츠가 캔버스의 92%를 차지하도록 (패드 여유)
            c = fit_pad(c, int(tw * 0.92), int(th * 0.92))
            canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
            canvas.alpha_composite(c, ((tw - c.width) // 2, th - c.height))
            frames.append(canvas)
        if not frames:
            continue
        # idle1이 없으면 idle0의 밝기 +7% 변형 (기존 보스 관례와 동일)
        while len(frames) < 2:
            im = frames[0].copy()
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, a = px[x, y]
                    if a:
                        px[x, y] = (min(255, int(r * 1.07)), min(255, int(g * 1.07)), min(255, int(b * 1.07)), a)
            frames.append(im)
        frames[0].save(f"{OUT}/{boss_key}_idle0.webp", "WEBP", lossless=True)
        frames[1].save(f"{OUT}/{boss_key}_idle1.webp", "WEBP", lossless=True)
        print(f"[OK] {boss_key} ← {src_key} ({tw}x{th})")
    print("보스 9종 에셋 교체 완료")

if __name__ == "__main__":
    main()
