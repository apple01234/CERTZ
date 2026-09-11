#!/usr/bin/env python3
# v1.0.13 — wx_snowflake 알파 베이크 (Toon Shaders Pro 팩)
#  원본: 흰 눈결정 + 불투명 검은 배경 → NORMAL 블렌드 파티클로 쓰면 검은 사각형이 보임
#  수정: alpha = max(r,g,b) (루미넌스 마스크) + 어두운 헤일로 방지용 언프리멀티플
#  wx_splat/crater/crack/spark5는 ADD 블렌드 전용이라 검은 배경이 맞음 — 손대지 않는다
from PIL import Image
import numpy as np

SRC = "public/assets/wx_snowflake.webp"
im = Image.open(SRC).convert("RGBA")
a = np.array(im).astype(np.float32)
rgb, alpha = a[:, :, :3], a[:, :, 3]
lum = rgb.max(axis=2)  # 흰 배경 위 흰 도형 — 최대 채널이 알파 마스크
out = np.zeros_like(a)
# 바닥 컷: 배경 노이즈(어두운 회색, lum≈20~28) 제거 + 부드러운 램프 (20→0, 200→255)
lum = np.clip((lum - 20.0) * (255.0 / 180.0), 0, 255)
# 언프리멀티플(어두운 가장자리 헤일로 제거): color = min(255, color / (alpha/255))
mask = lum > 8
for c in range(3):
    ch = rgb[:, :, c]
    ch_u = np.where(mask, np.clip(ch * (255.0 / np.maximum(lum, 1)), 0, 255), ch)
    out[:, :, c] = ch_u
out[:, :, 3] = lum  # 배경(0) → 완전 투명, 눈 결정(밝기) → 불투명도
Image.fromarray(out.astype(np.uint8), "RGBA").save(SRC, "WEBP", quality=92)
print(f"baked: {SRC}  opaque%={float((out[:,:,3] > 10).mean()):.3f}")
