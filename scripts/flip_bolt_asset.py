#!/usr/bin/env python3
"""v3.0.13 — fx2-bolt(vfx2_bolt.png) 텍스처가 왼쪽을 향해 그려져 있어
회전 적용 시 항상 뒤집혀(거꾸로) 날아가던 문제 수정.
프레임(48x32 × 4) 단위 좌우 반전으로 머리를 오른쪽으로 정렬.
(다른 방향성 투사체 x2_arrow/fx-arcane/fx-darkbolt는 오른쪽 기준 → 코드 변경 불필요)
"""
from PIL import Image

SRC = "public/assets/vfx2_bolt.png"
FW, FH = 48, 32

im = Image.open(SRC).convert("RGBA")
assert im.width % FW == 0, f"가로폭 {im.width}가 프레임폭 {FW}의 배수 아님"
n = im.width // FW
out = Image.new("RGBA", im.size, (0, 0, 0, 0))
for i in range(n):
    frame = im.crop((i * FW, 0, (i + 1) * FW, FH))
    out.paste(frame.transpose(Image.FLIP_LEFT_RIGHT), (i * FW, 0))
out.save(SRC)
print(f"OK: {SRC} 프레임 {n}개 좌우 반전 완료 ({im.size})")
