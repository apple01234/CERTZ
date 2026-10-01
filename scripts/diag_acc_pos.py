#!/usr/bin/env python3
"""진단: 어태치 치장(왕관/리본/후광/날개)이 게임에서 실제로 어디에 그려지는가 합성
좌표계: 96x64 프레임, origin=center(48,32) → player.y = 프레임 y32
WorldScene.update 오프셋을 그대로 재현 (front 기준, scaleY=1)
"""
from PIL import Image, ImageDraw

S = 6  # 6x 확대
W, H = 96 * S, 64 * S + 40

def load(p):
    return Image.open(f"public/assets/{p}.webp").convert("RGBA")

def paste_at(base, im, cx, cy):
    """게임처럼 이미지 중심(cx,cy)에 붙이기 (프레임 좌표 → 확대 좌표)"""
    w, h = im.size
    px = int((cx - w / 2) * S)
    py = int((cy - h / 2) * S)
    base.alpha_composite(im.resize((w * S, h * S), Image.NEAREST), (px, py))

cases = [
    ("acc_crown", 48, 32 - 19, "crown y-19"),
    ("acc_ribbon", 48 + 8, 32 - 15, "ribbon x+8 y-15"),
    ("acc_halo", 48, 32 - 26, "halo y-26"),
    ("acc_wings_devil", 48, 32 - 5, "wings y-5 (BEHIND)"),
]

# 1행: 앞모습(idle) — 날개만 뒤(depth), 나머지 앞
# 2행: 날개를 등 위치(y-12) + 더 크게 + 좌우로 살짝 벌려 그릴 경우 비교
sheet = Image.new("RGBA", (W * 2 + 60, H), (24, 24, 32, 255))
d = ImageDraw.Draw(sheet)

for row, (behind_mode) in enumerate([False, True]):
    for col, (acc, cx, cy, label) in enumerate(cases):
        ox = 20 + col * (W + 20)
        oy = 10 + row * H
        ch = load("chf0_idle0")
        accimg = load(acc)
        cell = Image.new("RGBA", (W, H - 40), (30, 30, 40, 255))
        # 바닥선 (feet y=55)
        dline = ImageDraw.Draw(cell)
        dline.line([(0, 55 * S), (W, 55 * S)], fill=(90, 90, 110, 255), width=2)
        if behind_mode and acc.startswith("acc_wings"):
            # 개선안: 등 중심(프레임 y=25)에 폭을 좌우로 벌려 +1.35배
            accimg2 = accimg.resize((int(26 * 1.35) * S, int(14 * 1.35) * S), Image.NEAREST)
            px = int((48 - accimg2.size[0] / (2 * S)) * S)
            py = int((25 - accimg2.size[1] / (2 * S)) * S)
            cell.alpha_composite(accimg2, (px, py))
            cell.alpha_composite(ch.resize((W, 64 * S), Image.NEAREST), (0, 0))
        else:
            cell.alpha_composite(ch.resize((W, 64 * S), Image.NEAREST), (0, 0))
            paste_at(cell, accimg, cx, cy)
        sheet.alpha_composite(cell, (ox, oy))
        d.text((ox, oy + (H - 40) + 2), f"{'NEW ' if behind_mode else 'CUR '}{label}", fill=(255, 220, 120, 255))

sheet.save("scripts/diag_acc_pos.png")
print("saved scripts/diag_acc_pos.png", sheet.size)
