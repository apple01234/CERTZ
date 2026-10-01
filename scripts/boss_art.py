#!/usr/bin/env python3
# v1.4.9 — 보스 아트 후처리: 흰 배경 제거(경계 연결 성분만) → 원본과 동일 픽셀 규격으로 변환
# - 게임 영향 0: Boss.ts 히트박스는 텍스처 width/height 비례 → 원본과 똑같은 크기로 리사이즈해 판정 불변
# - idle1 프레임: 밝기 +7% 마이크로 변조(2프레임 flicker 생동감)
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

RAW = os.environ.get("BOSS_RAW_DIR", "/home/z/my-project/scripts/boss_raw")
OUT = "/home/z/my-project/public/assets"

# 원본 규격 (게임 판정 유지용)
DIMS = {
    "boss": (111, 126), "boss2": (94, 144), "boss3": (110, 180),
    "boss_nidhog": (124, 140), "boss_surt": (94, 144), "boss_fenrir": (145, 75),
    "boss_skoll": (151, 78), "boss_gram": (69, 81), "boss_abudditos": (110, 180),
}

def border_connected_white(rgb: np.ndarray, thr_base: int = 238) -> np.ndarray:
    """경계에서 연결된 근사 흰색 영역만 True — 몸통 내부의 흰 무늬는 보존
    v2 — 경계 중위값 자동 적응: 배경이 순백이 아닌 미세 회색(236 등) 배경도 제거"""
    border_min = np.concatenate([
        rgb[0, :, :].min(axis=1), rgb[-1, :, :].min(axis=1),
        rgb[:, 0, :].min(axis=1), rgb[:, -1, :].min(axis=1),
    ])
    thr = int(min(thr_base, np.median(border_min) - 10))
    white = rgb.min(axis=2) >= thr
    reach = np.zeros_like(white)
    reach[0, :] = white[0, :]
    reach[-1, :] = white[-1, :]
    reach[:, 0] = white[:, 0]
    reach[:, -1] = white[:, -1]
    while True:
        dil = (
            np.roll(reach, 1, 0) | np.roll(reach, -1, 0)
            | np.roll(reach, 1, 1) | np.roll(reach, -1, 1)
        )
        new = reach | (white & dil)
        if new.sum() == reach.sum():
            return reach
        reach = new

def fit_pad(im: Image.Image, ow: int, oh: int) -> Image.Image:
    """잘라내기 금지 — 전체 실루엣을 보존하며 타깃 박스에 맞춰 축소 + 투명 패딩 중앙 정렬
    (텍스처 규격은 원본과 동일 → Boss.ts 판정 불변, 보스만 약간 작아질 뿐)"""
    w, h = im.size
    scale = min(ow / w, oh / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    canvas.paste(im, ((ow - nw) // 2, (oh - nh) // 2), im)
    return canvas

def process(key: str) -> bool:
    raw_path = f"{RAW}/{key}_raw.png"
    if not os.path.exists(raw_path):
        print(f"[missing] {key}")
        return False
    ow, oh = DIMS[key]
    im = Image.open(raw_path).convert("RGB")
    rgb = np.array(im)
    bw = border_connected_white(rgb)
    border_white_ratio = float(bw[0, :].mean() + bw[-1, :].mean() + bw[:, 0].mean() + bw[:, -1].mean()) / 4
    alpha = np.where(bw, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.1))
    a = np.array(a_img)
    a[a > 246] = 255  # 내부는 완전 불투명 유지
    rgba = np.dstack([rgb, a])
    cut = Image.fromarray(rgba)
    bbox = cut.getbbox()
    if bbox:
        pad = 3
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
        x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
        cut = cut.crop((x0, y0, x1, y1))
    cut = fit_pad(cut, ow, oh)

    idle0 = cut
    idle1 = ImageEnhance.Brightness(idle0).enhance(1.07)
    idle1 = ImageEnhance.Contrast(idle1).enhance(1.02)

    idle0.save(f"{OUT}/{key}_idle0.png")
    idle1.save(f"{OUT}/{key}_idle1.png")
    idle0.save(f"{OUT}/{key}_idle0.webp", quality=90, method=6)
    idle1.save(f"{OUT}/{key}_idle1.webp", quality=90, method=6)
    kb = os.path.getsize(f"{OUT}/{key}_idle0.webp") / 1024
    print(f"[ok] {key}: {ow}x{oh} webp {kb:.0f}KB (테두리 흰색비 {border_white_ratio:.2f})")
    return True

ok = all([process(k) for k in DIMS])
print("=== 전부 성공 ===" if ok else "=== 일부 실패 ===", file=sys.stderr)
sys.exit(0 if ok else 1)
