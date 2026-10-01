#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.4.14 (#5/#6) — 여캐 6종 3차 재생성. 유저 지시 "여캐 모양 이상함" + "SPUM 외 다양한 에셋 사용".

이전 시도(gen_v1412 SPUM 합성, gen_v1413 남캐 베이스 합성) 결과가 여전히 "이상하다"고 판정.
새 접근: 베이스 합성을 버리고, 깔끔한 chibi(2-head) 여캐를 PIL ImageDraw로 직접 그린다.

· 캔버스: 96×64 (기존과 동일 — 게임 판정/애니 규격 불변)
· 비율: 2-head chibi — 머리=약 24×24, 몸통=약 16×28, 다리=약 16×10
· 특징: 큰 머리 + 큰 눈 + 작은 입 + 긴 머리카락(어깨 아래) + A라인 드레스 + 얇은 허리
· 6종 색 팔레트 유지 (진홍/보라/숲/백은/흑의/하늘)
· 각 프레임마다 약간씩 다른 포즈 (idle=미세 숨쉬기 / walk=다리 번갈림 / atk=팔 뻗기)

출력: public/assets/chf{0..5}_{28프레임}.webp
"""
import os
from PIL import Image, ImageDraw

OUT = "/home/z/my-project/public/assets"

FRAMES = []
for pre in ["idle", "walk", "walkside", "walkup", "atk", "atkdown", "atkup"]:
    for i in range(4):
        FRAMES.append(f"{pre}{i}")

# 6종 색 팔레트 — 기존 gen_v1413과 동일
PRESETS = [
    # 0: 진홍 전사
    {"name":"red_warrior","hair":(74,42,24),"hair_hi":(124,82,52),"dress":(168,38,42),"dress_hi":(220,76,80),"dress_shade":(108,22,28),"skin":(242,198,162),"skin_shade":(198,148,116),"eye":(40,20,16),"trim":(228,184,86)},
    # 1: 보라 마법사
    {"name":"purple_mage","hair":(228,216,206),"hair_hi":(255,248,238),"dress":(108,64,156),"dress_hi":(168,118,210),"dress_shade":(68,36,108),"skin":(240,200,170),"skin_shade":(190,148,120),"eye":(40,30,60),"trim":(212,184,240)},
    # 2: 숲 궁수
    {"name":"forest_ranger","hair":(118,76,42),"hair_hi":(168,120,80),"dress":(74,130,64),"dress_hi":(120,180,102),"dress_shade":(44,84,38),"skin":(242,198,168),"skin_shade":(190,148,120),"eye":(60,40,20),"trim":(196,168,90)},
    # 3: 백은 성직자
    {"name":"silver_cleric","hair":(220,182,92),"hair_hi":(252,222,144),"dress":(232,232,238),"dress_hi":(255,255,255),"dress_shade":(174,174,188),"skin":(242,200,172),"skin_shade":(192,148,118),"eye":(80,60,30),"trim":(228,188,110)},
    # 4: 흑의 도적
    {"name":"dark_rogue","hair":(48,36,32),"hair_hi":(92,72,62),"dress":(40,36,52),"dress_hi":(74,68,92),"dress_shade":(16,14,22),"skin":(240,200,172),"skin_shade":(190,148,118),"eye":(180,60,200),"trim":(140,110,200)},
    # 5: 하늘 왕녀
    {"name":"sky_princess","hair":(226,210,220),"hair_hi":(255,245,250),"dress":(124,184,224),"dress_hi":(180,220,245),"dress_shade":(78,130,170),"skin":(242,200,172),"skin_shade":(190,148,118),"eye":(60,80,120),"trim":(228,200,120)},
]

W, H = 96, 64

def draw_px(d, x, y, c, w=1, h=1):
    """픽셀 그리기 헬퍼 (ImageDraw.rectangle 사용)"""
    if len(c) == 3:
        c = c + (255,)
    d.rectangle([x, y, x+w-1, y+h-1], fill=c)

def draw_chibi(im, preset, frame_type, frame_idx):
    """
    캔버스 96×64에 chibi 여캐릭터 그리기
    캐릭터 영역: x=38~58 (중심 ~48), y=18~56
    머리: y=18~32 (14px 높이, 18px 폭)
    몸: y=32~46 (14px 높이)
    다리: y=46~56 (10px 높이)
    """
    d = ImageDraw.Draw(im)
    p = preset
    # 프레임별 미세 변화
    breath = 0 if frame_type != "idle" else (1 if frame_idx in [0,3] else 0)
    walk_off = 0
    if frame_type.startswith("walk"):
        walk_off = (frame_idx % 2) * 2  # 0, 2, 0, 2 (다리 번갈림)
    atk_off = 0
    if frame_type.startswith("atk"):
        atk_off = frame_idx  # 0,1,2,3 — 점진적 팔 뻗기

    cx = 48  # 캐릭터 중심 x
    # === 1. 머리카락 뒷배경 (롱헤어 — 어깨 아래로 뻗음) ===
    # 양옆으로 뻗는 긴 머리 — y=18~42
    hair_left_x = cx - 10
    hair_right_x = cx + 8
    for y in range(18, 42):
        # 양옆 2픽셀 폭으로 긴 머리
        for x_off in range(-2, 0):
            draw_px(d, hair_left_x + x_off, y, p["hair"])
        for x_off in range(0, 2):
            draw_px(d, hair_right_x + x_off, y, p["hair"])
    # 하이라이트 (한쪽만)
    for y in range(20, 36):
        draw_px(d, hair_right_x, y, p["hair_hi"])

    # === 2. 머리 (큰 둥근 머리 — chibi 핵심) ===
    head_x0, head_x1 = cx - 8, cx + 7
    head_y0, head_y1 = 18 - breath, 32 - breath
    # 머리 외곽 (hair)
    for y in range(head_y0, head_y1):
        for x in range(head_x0, head_x1):
            draw_px(d, x, y, p["hair"])
    # 얼굴 피부 (머리 안쪽) — y=22~30, x좁힘
    face_x0, face_x1 = cx - 6, cx + 5
    face_y0, face_y1 = 22 - breath, 30 - breath
    for y in range(face_y0, face_y1):
        for x in range(face_x0, face_x1):
            draw_px(d, x, y, p["skin"])
    # 그림자 (오른쪽 얼굴)
    for y in range(face_y0, face_y1):
        draw_px(d, face_x1 - 1, y, p["skin_shade"])

    # === 3. 눈 (큰 chibi 눈 — 2×3 픽셀) ===
    eye_y = 26 - breath
    # 왼쪽 눈
    for dx in range(-3, -1):
        for dy in range(0, 3):
            draw_px(d, cx + dx, eye_y + dy, p["eye"])
    # 오른쪽 눈
    for dx in range(1, 3):
        for dy in range(0, 3):
            draw_px(d, cx + dx, eye_y + dy, p["eye"])
    # 눈 하이라이트
    draw_px(d, cx - 2, eye_y, (255, 255, 255, 255))
    draw_px(d, cx + 1, eye_y, (255, 255, 255, 255))

    # === 4. 입 (작은 1픽셀) ===
    draw_px(d, cx, 30 - breath, p["eye"])

    # === 5. 몸통 (드레스 — A라인) ===
    # 상의: y=32~42, x좁음 (cx-5 ~ cx+5)
    body_y0, body_y1 = 32, 42
    for y in range(body_y0, body_y1):
        # 드레스는 y가 커질수록 폭이 넓어짐 (A라인)
        half_w = 5 + (y - body_y0)  # 5, 6, 7, ...
        for x in range(cx - half_w, cx + half_w + 1):
            draw_px(d, x, y, p["dress"])
        # 하이라이트 (왼쪽 가장자리)
        draw_px(d, cx - half_w, y, p["dress_hi"])
        # 그림자 (오른쪽 가장자리)
        draw_px(d, cx + half_w, y, p["dress_shade"])

    # 허리 belt (트림 색)
    for x in range(cx - 5, cx + 6):
        draw_px(d, x, 38, p["trim"])

    # === 6. 다리/스커트 하단 (y=42~56) ===
    # 스커트 하단 — A라인 가장 넓은 부분
    skirt_y0, skirt_y1 = 42, 50
    for y in range(skirt_y0, skirt_y1):
        half_w = 8 + (y - skirt_y0)  # 8, 9, 10, ...
        for x in range(cx - half_w, cx + half_w + 1):
            draw_px(d, x, y, p["dress_shade"])
        # 하이라이트
        draw_px(d, cx - half_w + 1, y, p["dress"])

    # 다리 (스커트 아래 — y=50~56)
    leg_y0, leg_y1 = 50, 56
    # 왼쪽 다리 (walk_off만큼 아래로)
    leg_l_offset = walk_off
    leg_r_offset = (2 - walk_off) if frame_type.startswith("walk") else 0
    for y in range(leg_y0, leg_y1):
        # 왼쪽 다리
        for x in range(cx - 3, cx):
            if y + leg_l_offset < leg_y1:
                draw_px(d, x, y + leg_l_offset, p["skin_shade"])
        # 오른쪽 다리
        for x in range(cx + 1, cx + 4):
            if y + leg_r_offset < leg_y1:
                draw_px(d, x, y + leg_r_offset, p["skin_shade"])

    # 신발 (트림 색)
    for x in range(cx - 3, cx):
        draw_px(d, x, 56 - 1 + leg_l_offset if leg_l_offset < 2 else 55, p["trim"])
    for x in range(cx + 1, cx + 4):
        draw_px(d, x, 56 - 1 + leg_r_offset if leg_r_offset < 2 else 55, p["trim"])

    # === 7. 팔 (atk 프레임에선 앞으로 뻗음) ===
    arm_y = 36
    if frame_type.startswith("atk"):
        # 공격 — 팔을 앞으로 뻗음
        arm_len = 4 + atk_off  # 4, 5, 6, 7
        for x_off in range(arm_len):
            draw_px(d, cx + 5 + x_off, arm_y, p["skin"])
            draw_px(d, cx + 5 + x_off, arm_y + 1, p["skin_shade"])
        # 무기 (트림 색 — 검/봉 등)
        for x_off in range(arm_len, arm_len + 3):
            draw_px(d, cx + 5 + x_off, arm_y, p["trim"])
            draw_px(d, cx + 5 + x_off, arm_y + 1, p["trim"])
    else:
        # 평상시 — 팔은 몸통 옆에 붙임
        draw_px(d, cx - 6, arm_y, p["skin"])
        draw_px(d, cx - 6, arm_y + 1, p["skin_shade"])
        draw_px(d, cx + 6, arm_y, p["skin"])
        draw_px(d, cx + 6, arm_y + 1, p["skin_shade"])
        draw_px(d, cx - 7, arm_y + 2, p["skin_shade"])
        draw_px(d, cx + 7, arm_y + 2, p["skin_shade"])

    # === 8. 머리카락 앞부분 (뱅 — 이마 위) ===
    for x in range(cx - 5, cx + 6):
        draw_px(d, x, 22 - breath, p["hair"])
        draw_px(d, x, 21 - breath, p["hair_hi"])  # 윤곽선

    # === 9. 머리 위쪽 (머리카락 상단 — 둥근 형태) ===
    for x in range(cx - 7, cx + 8):
        draw_px(d, x, 19 - breath, p["hair"])
    for x in range(cx - 6, cx + 7):
        draw_px(d, x, 18 - breath, p["hair_hi"])

def main():
    print("[v1.4.14] 여캐 6종 3차 재생성 — chibi 직접 드로잉 (SPUM 비사용)")
    for idx, p in enumerate(PRESETS):
        n_done = 0
        for frame in FRAMES:
            im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ft = frame.rstrip("0123456789")
            fi = int(frame[-1])
            draw_chibi(im, p, ft, fi)
            im.save(f"{OUT}/chf{idx}_{frame}.webp", "WEBP", lossless=True, quality=100, method=0)
            n_done += 1
        print(f"  chf{idx} ({p['name']}): {n_done}/{len(FRAMES)} 프레임 ✓")
    print("완료")

if __name__ == "__main__":
    main()
