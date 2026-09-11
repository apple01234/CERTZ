#!/usr/bin/env python3
"""얼굴(피부색) 픽셀 무게중심으로 스프라이트 좌/우향 정량 판정.
머리 영역(상단 40%)에서 피부톤 픽셀의 x 무게중심이 몸통 중심보다 왼쪽=좌향."""
from PIL import Image
import numpy as np

def face_dir(path, label):
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(int)
    alpha = a[:, :, 3]
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    opaque = alpha > 128
    ys, xs = np.where(opaque)
    if len(xs) == 0:
        return f"{label}: 빈 이미지"
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    body_cx = (x0 + x1) / 2
    # 피부톤: 밝은 주황/베이지 (Mystic Woods 히어로 피부 ~ (230,190,150)±)
    skin = opaque & (r > 190) & (g > 140) & (g < 215) & (b > 100) & (b < 185) & (r > b + 40)
    # 머리 영역 = 상단 45%
    head_cut = y0 + (y1 - y0) * 0.45
    sys_, sxs_ = np.where(skin)
    head_skin = [(x, y) for x, y in zip(sxs_, sys_) if y < head_cut]
    if not head_skin:
        return f"{label}: 피부 픽셀 검출 실패"
    fx = np.mean([p[0] for p in head_skin])
    rel = fx - body_cx
    verdict = "좌향(얼굴 왼쪽)" if rel < -0.5 else ("우향(얼굴 오른쪽)" if rel > 0.5 else "정면/모호")
    return (f"{label}: 몸중심x={body_cx:.1f} 얼굴x={fx:.1f} 편차={rel:+.1f}px → {verdict} "
            f"[bbox {x1-x0+1}x{y1-y0+1}, 머리피부 {len(head_skin)}px]")

files = [
    ("public/assets/hero_walkside0.webp", "walkside0 (기준:좌향)"),
    ("public/assets/hero_walkside1.webp", "walkside1 (기준:좌향)"),
    ("public/assets/hero_walkside2.webp", "walkside2 (기준:좌향)"),
    ("public/assets/hero_atk0.webp", "atk0"),
    ("public/assets/hero_atk1.webp", "atk1"),
    ("public/assets/hero_atk2.webp", "atk2"),
    ("public/assets/hero_atk3.webp", "atk3"),
    ("public/assets/hero_idle0.webp", "idle0 (기준:정면)"),
]
for p, l in files:
    print(face_dir(p, l))
