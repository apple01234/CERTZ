#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v3.0.8 디자인 개편 2차 — 히어로/몬스터 스프라이트 전면 교체
소스: Mystic Woods 플레이어(히어로), 32rogues monsters.png(몬스터 42종)
규약: 파일명·프레임 수·캔버스 크기 100% 보존 (기능 로직 0 변경)
애님: 정적 셀 → 하단 앵커 스쿼시 사이클로 idle/run/atk 프레임 합성
"""
from PIL import Image, ImageEnhance
import colorsys, os, shutil

ROOT = '/home/z/my-project'
SRC_MW = f'{ROOT}/upload/extracted/mystic_woods_free_2.2/sprites/characters/player.png'
SRC_32R = f'{ROOT}/upload/extracted/32rogues-0.5.0/32rogues/monsters.png'
OUT = f'{ROOT}/public/assets'
BACKUP = f'{ROOT}/tmp_design/backup_assets'

os.makedirs(BACKUP, exist_ok=True)

mw = Image.open(SRC_MW).convert('RGBA')
m32 = Image.open(SRC_32R).convert('RGBA')

def cell(sheet, cx, cy, cs=32):
    return sheet.crop((cx*cs, cy*cs, cx*cs+cs, cy*cs+cs))

def tight(img):
    """아트 bbox로 타이트 크롭"""
    b = img.getbbox()
    return img.crop(b) if b else img

def dominant_hue(img):
    """채도 있는 픽셀의 원형 가중 평균 hue (없으면 None)"""
    import math
    px = img.load()
    cs, sn, tw = 0.0, 0.0, 0.0
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a = px[x,y]
            if a < 128: continue
            h,s,v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s > 0.15 and v > 0.15:
                cs += math.cos(h*2*math.pi)*s; sn += math.sin(h*2*math.pi)*s; tw += s
    if tw < 1e-6:
        return None
    return (math.atan2(sn, cs) / (2*math.pi)) % 1.0

def duotone(img, rgb, blend=0.85, val=1.0):
    """휘도 기반 듀오톤 틴트 — 저채도 아트도 확실한 테마색 (rgb: 0-1)"""
    out = Image.new('RGBA', img.size, (0,0,0,0))
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a = px[x,y]
            if a == 0: continue
            lum = (0.3*r + 0.59*g + 0.11*b) / 255
            f = 0.22 + 0.95*lum
            r2 = r*(1-blend) + rgb[0]*255*f*blend
            g2 = g*(1-blend) + rgb[1]*255*f*blend
            b2 = b*(1-blend) + rgb[2]*255*f*blend
            po[x,y] = (min(255,round(r2*val)), min(255,round(g2*val)), min(255,round(b2*val)), a)
    return out

def hue_shift(img, dh=0.0, sat=1.0, val=1.0, hue_to=None):
    """픽셀아트 안전 색상이동 (투명 보존). hue_to 지정 시 지배 hue를 목표로 강회전"""
    if hue_to is not None:
        base = dominant_hue(img)
        dh = (hue_to - base) % 1.0 if base is not None else 0.0
    if abs(dh) < 1e-3 and abs(sat-1) < 1e-3 and abs(val-1) < 1e-3:
        return img
    px = img.load()
    out = Image.new('RGBA', img.size, (0,0,0,0))
    po = out.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a = px[x,y]
            if a == 0:
                continue
            h,s,v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            h = (h + dh) % 1.0
            s = max(0.0, min(1.0, s*sat))
            v = max(0.0, min(1.0, v*val))
            r2,g2,b2 = colorsys.hsv_to_rgb(h,s,v)
            po[x,y] = (int(r2*255), int(g2*255), int(b2*255), a)
    return out

def brighten(img, f=1.18):
    """밝기 강조 (atk 러시 프레임)"""
    out = Image.new('RGBA', img.size, (0,0,0,0))
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a = px[x,y]
            if a == 0: continue
            po[x,y] = (min(255,int(r*f)), min(255,int(g*f)), min(255,int(b*f)), a)
    return out

def squash(img, fh=1.0, fw=1.0):
    """하단 중앙 앵커 스쿼시"""
    if abs(fh-1) < 1e-3 and abs(fw-1) < 1e-3:
        return img
    w, h = max(1,round(img.width*fw)), max(1,round(img.height*fh))
    s = img.resize((w, h), Image.NEAREST)
    return s

def paste_bottom_center(canvas, art, cx_px, bottom_px):
    canvas.alpha_composite(art, (int(cx_px - art.width/2), int(bottom_px - art.height)))

def backup(name):
    src = f'{OUT}/{name}'
    dst = f'{BACKUP}/{name}'
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)

# ---------------------------------------------------------------- HERO
# MW player: 32x48 셀 (9x10행). 행0 idle아래 / 행3 걷기아래 / 행4 걷기좌 /
#            행5 걷기위 / 행6 공격아래 / 행7 공격좌 / 행8 공격위
# 프레임 = 밴드 내 빈 열 경계로 분리된 클러스터 (좌→우 순)
HERO_ROWS = {'idle': 0, 'walk': 3, 'walkside': 4, 'walkup': 5,
             'atkdown': 6, 'atk': 7, 'atkup': 8}

def band_frames(sheet, row, cell_h=48, expect=4):
    """48px 밴드에서 빈 열 경계로 프레임 클러스터 추출"""
    y0, y1 = row*cell_h, (row+1)*cell_h
    band = sheet.crop((0, y0, sheet.width, y1))
    px = band.load()
    colhas = [any(px[x,y][3] > 0 for y in range(band.height)) for x in range(band.width)]
    clusters, start = [], None
    for x in range(band.width):
        if colhas[x] and start is None:
            start = x
        elif not colhas[x] and start is not None:
            clusters.append(band.crop((start, 0, x, band.height))); start = None
    if start is not None:
        clusters.append(band.crop((start, 0, band.width, band.height)))
    # 미세 조각(슬래시 파편) 제거: 폭 6px 미만 버림
    clusters = [c for c in clusters if c.width >= 6]
    if len(clusters) > expect:
        # 앞에서 expect개만 (잔여 파편은 무시)
        clusters = clusters[:expect]
    while len(clusters) < expect:
        clusters.append(clusters[-1])
    return [tight(c) for c in clusters]

def gen_hero():
    print('=== HERO: Mystic Woods player (32x48 밴드) ===')
    S, BOTTOM, CW, CH = 2.0, 57, 96, 64
    for name, row in HERO_ROWS.items():
        flip = name in ('walkside', 'atk')  # 시트=좌향 → 게임 규약=우향
        frames = band_frames(mw, row)
        for i in range(4):
            art = frames[i]
            if flip:
                art = art.transpose(Image.FLIP_LEFT_RIGHT)
            art = art.resize((round(art.width*S), round(art.height*S)), Image.NEAREST)
            if art.height > BOTTOM:  # 상단 클립 (발 기준 유지)
                art = art.crop((0, art.height-BOTTOM, art.width, art.height))
            cv = Image.new('RGBA', (CW, CH), (0,0,0,0))
            paste_bottom_center(cv, art, 48, BOTTOM)
            fn = f'hero_{name}{i}.png'
            backup(fn)
            cv.save(f'{OUT}/{fn}')
        print(f'  hero_{name}0..3 ✓ ({frames[0].width}x{frames[0].height}원본)')

# ---------------------------------------------------------------- MONSTERS
# (src cell, tint|None, val)  tint=(r,g,b) 0-1 듀오톤 테마색, None=원본
MAP = {
    # --- x2 패밀리 (idle2/run4/atk1)
    'x2_frog':       ((1,2), None,             1.0),   # big slime 녹색
    'x2_rat':        ((11,6),None,             1.0),   # giant rat
    'x2_bat':        ((6,6), None,             1.05),  # giant bat
    'x2_firebird':   ((3,8), (1.0,0.5,0.15),   1.1),   # cockatrice→화염
    'x2_frostfly':   ((4,6), (0.6,0.85,1.0),   1.08),  # giant ant→빙결
    'x2_snail':      ((0,2), (0.72,0.6,0.45),  0.9),   # small slime→달팽이 갈색
    'x2_stonegolem': ((2,7), (0.68,0.66,0.6),  0.95),  # rock golem 석색
    'x2_darkhound':  ((10,6),(0.5,0.35,0.7),   0.75),  # warg→암흑보라
    'x2_reeffish':   ((1,6), (0.3,0.8,0.85),   1.05),  # lampreymander→청록
    # --- 늑대 계열 (warg 파생)
    'wolf':          ((10,6),None,             1.0),
    'frostwolf':     ((10,6),(0.55,0.8,1.0),   1.12),
    'emberwolf':     ((10,6),(1.0,0.45,0.12),  1.12),
    'helhound':      ((5,6), (0.8,0.22,0.16),  0.85),  # lycanthrope→흑적
    # --- 정예/정령
    'minion':        ((0,4), None,             1.0),   # skeleton
    'spider':        ((8,6), None,             1.0),   # giant spider
    'golem':         ((2,7), (0.72,0.58,0.42), 0.95),  # rock golem 갈색
    'icegolem':      ((2,7), (0.6,0.85,1.0),   1.15),
    'runegolem':     ((2,7), (0.72,0.55,1.0),  1.08),
    'wraith':        ((2,5), None,             1.0),
    'swampbeast':    ((3,6), (0.5,0.65,0.42),  0.9),   # manticore→늪
    'firespirit':    ((1,11),(1.0,0.6,0.15),   1.25),  # imp→화염정령
    # --- x3 패밀리 (idle4/run4/atk1)
    'x3_swampy':     ((1,7), (0.55,0.65,0.4),  0.85),  # wendigo→늪
    'x3_imp':        ((1,11),None,             1.0),
    'x3_icezombie':  ((4,4), (0.7,0.88,1.0),   1.1),   # zombie→빙결
    'x3_tinyzombie': ((5,4), None,             0.95),  # ghoul
    'x3_ogre':       ((2,1), None,             1.0),   # troll
    'x3_chort':      ((1,3), None,             1.0),   # unholy cardinal 적색 유지
    'x3_necromancer':((2,4), None,             1.0),   # lich
    'x3_maskedorc':  ((0,0), None,             1.0),
    'x3_orcwarrior': ((3,0), None,             1.0),
    'x3_orcshaman':  ((1,0), None,             1.0),
    'x3_wogol':      ((0,3), None,             1.0),   # faceless monk
    'x3_goblin':     ((2,0), None,             1.0),
    'x3_bigzombie':  ((4,4), None,             1.0),   # zombie 대형
    # --- 보스 (idle2, 자동 피트)
    'boss':          ((2,7), (0.55,0.68,0.85), 1.05),  # rock golem→수호자 석청
    'boss2':         ((7,7), (0.85,0.35,0.3),  0.95),  # minotaur→베헤모스 암적
    'boss3':         ((4,8), (0.6,0.45,0.9),   0.95),  # basilisk→심연보라
    'boss_nidhog':   ((2,8), (0.35,0.8,0.75),  1.0),   # dragon→니드호그 청록
    'boss_surt':     ((4,0), (1.0,0.55,0.2),   1.15),  # warchief→수르트 화염
    'boss_fenrir':   ((10,6),(0.45,0.55,0.72), 0.85),  # warg→펜리르 냉암
    'boss_skoll':    ((10,6),(1.0,0.82,0.3),   1.2),   # warg→스코울 금색
    'boss_gram':     ((3,4), (0.6,0.78,1.0),   1.05),  # deathknight→그램 냉기
    'boss_abudditos':((2,12),(0.65,0.5,0.95),  1.05),  # writhing→아부디토스
}

IDLE_FS = [1.0, 0.94]
RUN_FS  = [1.0, 0.90, 1.0, 0.96]
RUN_FW  = [1.0, 1.06, 1.0, 1.03]

def fit_scale(art, box_w, box_h):
    s = min(box_w / art.width, box_h / art.height)
    if s >= 1.0:
        si = int(s)
        if si >= 1 and (s - si) < 0.3:
            return float(si)
    return max(0.5, s)

def gen_monster(key, cellxy, tint, val):
    base0 = f'{OUT}/{key}_idle0.png'
    if not os.path.exists(base0):
        print(f'  !! {key} idle0 없음 — 스킵')
        return
    cv0 = Image.open(base0).convert('RGBA')
    cw, ch = cv0.size
    bbox = cv0.getbbox() or (0, 0, cw, ch)
    bw, bh = bbox[2]-bbox[0], bbox[3]-bbox[1]
    bcx, bbot = (bbox[0]+bbox[2])/2, bbox[3]

    art = tight(cell(m32, *cellxy))
    if tint:
        art = duotone(art, tint, blend=0.85, val=val)
    elif val != 1.0:
        art = hue_shift(art, 0.0, 1.0, val)
    s = fit_scale(art, bw, bh)
    aw, ah = max(1, round(art.width*s)), max(1, round(art.height*s))
    base = art.resize((aw, ah), Image.NEAREST)

    def frame(fh, fw, bright=None):
        f = squash(base, fh, fw)
        if bright:
            f = brighten(f, bright)
        # 캔버스 클램프
        if f.width > cw:
            f = f.crop((0, 0, cw, f.height))
        if f.height > ch:
            f = f.crop((0, f.height-ch, f.width, f.height))
        cv = Image.new('RGBA', (cw, ch), (0,0,0,0))
        paste_bottom_center(cv, f, bcx, bbot)
        return cv

    n_idle = sum(1 for i in range(9) if os.path.exists(f'{OUT}/{key}_idle{i}.png'))
    n_run  = sum(1 for i in range(9) if os.path.exists(f'{OUT}/{key}_run{i}.png'))
    n_atk  = sum(1 for i in range(9) if os.path.exists(f'{OUT}/{key}_atk{i}.png'))
    for i in range(n_idle):
        cv = frame(IDLE_FS[i % 2], 1.0)
        backup(f'{key}_idle{i}.png'); cv.save(f'{OUT}/{key}_idle{i}.png')
    for i in range(n_run):
        cv = frame(RUN_FS[i % 4], RUN_FW[i % 4])
        backup(f'{key}_run{i}.png'); cv.save(f'{OUT}/{key}_run{i}.png')
    for i in range(n_atk):
        cv = frame(1.06, 1.04, bright=1.22)
        backup(f'{key}_atk{i}.png'); cv.save(f'{OUT}/{key}_atk{i}.png')
    print(f'  {key}: idle{n_idle}/run{n_run}/atk{n_atk} canvas{cw}x{ch} s={s:.2f} ✓')

if __name__ == '__main__':
    import sys
    if '--monster-only' not in sys.argv:
        gen_hero()
    for k, v in MAP.items():
        gen_monster(k, *v)
    print('== 전체 완료 ==')
