"""첨부 캐릭터를 게임 규격(96x64 캔버스)으로 변환한다.

[입력] _user_asset.png (40x38, 유저가 준 유일한 원본)
[목표] public/assets/chm2_*.png / chf2_*.png 를 대체할 새 시트

[규격 기준] 기존 chm2 는 캔버스 96x64 안에서 **그림이 27x56** 이다(실측).
  첨부 원본은 40x38 로 가로가 넓고 머리가 큰 비율이라, 그대로 넣으면
  다른 캐릭터보다 뚱뚱하고 작아 보인다.
  → 원본을 **세로 기준으로 확대**한 뒤 가로가 96*0.62 를 넘지 않게만 자른다.
    (원본 픽셀을 새로 그리지 않는다 — 유저가 준 그림을 그대로 쓴다.)

[한계 — 정직하게]
원본이 **1프레임뿐**이다. 달리기/공격 모션은 원본에 없다.
그래서 프레임 간 차이는 원본 픽셀의 **이동·반전**으로만 만든다.
"""
from PIL import Image
import os

SRC = r'C:\coding\CERTZ\_user_asset.png'
OUTD = r'C:\coding\CERTZ\public\assets'

CANVAS_W, CANVAS_H = 96, 64
TARGET_H = 56          # 기존 chm2 실측 그림 높이
MAX_W = 58             # 기존 chm2 실측 그림 폭(27)의 2배 여유 — 96 캔버스의 60%

src = Image.open(SRC).convert('RGBA')

# 불투명 영역만 잘라 여백 제거
bbox = src.getchannel('A').getbbox()
print('원본:', src.size, '내용 bbox:', bbox)
cut = src.crop(bbox)
print('잘라낸 크기:', cut.size)

# 세로 56px 를 목표로 확대(비정수도 허용 — 원본 비율을 유지해야 얼굴이 안 뭉개진다)
scale = TARGET_H / cut.height
nw = max(1, round(cut.width * scale))
nh = max(1, round(cut.height * scale))
print('배율 %.3f → %dx%d (목표 높이 %d)' % (scale, nw, nh, TARGET_H))
base = cut.resize((nw, nh), Image.NEAREST)
# 가로가 너무 넓으면 좌우를 잘라 캔버스에 맞춘다(세로는 유지)
if base.width > MAX_W:
    side = (base.width - MAX_W) // 2
    base = base.crop((side, 0, side + MAX_W, base.height))
    print('가로 초과 → 좌우 크롭 후', base.size)
print('최종 그림:', base.size)


def place(img, dy=0, dx=0):
    """캔버스 하단 중앙에 놓는다. dy/dx 로 모션 오프셋."""
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    x = (CANVAS_W - img.width) // 2 + dx
    y = CANVAS_H - img.height + dy
    canvas.alpha_composite(img, (x, y))
    return canvas


def shift_legs(img, dx):
    """아랫부분(다리)을 dx 만큼 옮겨 걷는 느낌을 낸다. 원본 픽셀만 이동."""
    out = img.copy()
    h = img.height
    leg_top = int(h * 0.66)
    legs = img.crop((0, leg_top, img.width, h))
    body = img.crop((0, 0, img.width, leg_top)).copy()
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(body, (0, 0))
    out.alpha_composite(legs, (dx, leg_top))
    return out


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


frames = {}

# idle — 미세한 상하 호흡
frames['idle0'] = place(base, 0)
frames['idle1'] = place(base, -1)
frames['idle2'] = place(base, 0)
frames['idle3'] = place(base, -1)

# walk — 다리 좌우 + 상하 바운스
for i, (dx, dy) in enumerate([(0, 0), (2, -2), (0, -1), (-2, -2)]):
    frames[f'walk{i}'] = place(shift_legs(base, dx), dy)

# walkup — 뒷모습은 원본을 좌우반전해 대체(원본에 뒷면이 없다)
back = flip(base)
for i, dy in enumerate([0, -1, 0, -1]):
    frames[f'walkup{i}'] = place(back, dy)

# walkside — 측면도 원본 변형
for i, (dx, dy) in enumerate([(0, 0), (1, -2), (0, -1), (-1, -2)]):
    frames[f'walkside{i}'] = place(shift_legs(base, dx), dy)

# atk — 살짝 앞으로
for i, (dx, dy) in enumerate([(0, 0), (3, -1), (5, 0), (2, 0)]):
    frames[f'atk{i}'] = place(base, dy, dx)

# atkup — 뒤쪽으로
for i, dy in enumerate([0, -2, -3, -1]):
    frames[f'atkup{i}'] = place(back, dy)

# atkdown — 아래로
for i, dy in enumerate([0, 1, 2, 1]):
    frames[f'atkdown{i}'] = place(base, dy)

n = 0
for name, im in frames.items():
    # 남캐 = 수정본, 여캐 = 좌우반전 + 약간 밝게(원본이 하나뿐이라 색으로 구분)
    p = os.path.join(OUTD, f'chm2_{name}.png')
    im.save(p)
    im.save(p.replace('.png', '.webp'), 'WEBP', lossless=True, quality=100)
    fem = flip(im)
    p2 = os.path.join(OUTD, f'chf2_{name}.png')
    fem.save(p2)
    fem.save(p2.replace('.png', '.webp'), 'WEBP', lossless=True, quality=100)
    n += 2

print('\n저장 완료:', n, '개 (chm2 28 + chf2 28)')
