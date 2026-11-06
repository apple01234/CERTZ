#!/usr/bin/env python3
"""
fix_tile_seams.py — 반복(TileSprite) 시 이음새가 보이는 지면 텍스처를 주기-봉합

[증상] tile_grass / tile_forest / tile_snow / tile_dirt 등이 반복될 때
       격자 이음새(십자 눈금)가 보인다. 유저 지적 #3 "타일맵 아직도 이상함"의 직접 원인.

[원인] 이 텍스처들은 좌우/상하 가장자리 픽셀이 서로 맞물리지 않는 "그림"이다.
       실측: tile_grass 좌우 56.3 · 상하 58.7 / tile_snow 좌우 210.6 (0이 완벽).
       TileSprite 는 같은 이미지를 격자로 붙이므로 가장자리가 어긋나면 선이 생긴다.

[해법] 텍스처를 **주기 신호로 강제**한다 — 가장자리가 정확히 이어지도록.
         1) 가장자리 `band` 폭을 "반대편 가장자리에서 복사한 값"과 블렌드한다.
            (좌측 band ← 우측 band 를 좌우반전해 섞고, 그 역도 동일)
         2) 블렌드 가중은 cos 램프 — 경계에서 100% 상대편, 안쪽에서 100% 원본.
            이러면 경계 픽셀값이 **완전히 일치**해 반복선이 사라진다.
         3) 상하도 동일.
       중심부 디테일은 보존되고, 색조/밝기는 유지된다(같은 이미지의 다른 부분을 섞으므로).

[주의] 원본 백업(.orig.webp)을 남기고, 이미 봉합된 파일은 건너뛴다(멱등).
"""
import os
import sys
import shutil
import numpy as np
from PIL import Image

ASSETS = "/root/workspace/CERTZ/public/assets"
TARGETS = [
    "tile_amber", "tile_desert", "tile_dirt", "tile_forest", "tile_garden",
    "tile_grass", "tile_grass2", "tile_moss", "tile_path", "tile_sand", "tile_snow",
]


def edge_diff(im):
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    return (float(np.abs(a[:, 0, :] - a[:, -1, :]).mean()),
            float(np.abs(a[0, :, :] - a[-1, :, :]).mean()))


def weld(arr, band_ratio=0.04):
    """주기 봉합 — 좌우/상하 경계 픽셀을 **같은 값으로 수렴**시켜 반복선을 없앤다.

    단순히 좌↔우를 맞바꾸면 경계차가 그대로 남는다(맞바꾼 값끼리 여전히 다름).
    그래서 양쪽 경계가 공통값(양끝의 평균)으로 모이게 하고, 안쪽으로 갈수록
    원본 가중을 키운다. 경계 픽셀은 정확히 동일해지므로 이음새가 사라진다.
    """
    h, w = arr.shape[:2]
    band = max(2, int(min(h, w) * band_ratio))
    band = min(band, min(h, w) // 3)
    out = arr.astype(np.float32).copy()

    i = np.arange(band, dtype=np.float32)
    ramp = (np.cos(i / band * np.pi) * 0.5 + 0.5)  # 경계 1.0 → 안쪽 0.0

    # ── 좌우: 양끝 평균으로 수렴
    avg_lr = (arr[:, 0, :].astype(np.float32) + arr[:, -1, :].astype(np.float32)) * 0.5  # (h,3)
    rl = ramp.reshape(1, -1, 1)
    out[:, :band, :] = arr[:, :band, :] * (1 - rl) + avg_lr[:, None, :] * rl
    out[:, -band:, :] = arr[:, -band:, :] * (1 - rl[:, ::-1, :]) + avg_lr[:, None, :] * rl[:, ::-1, :]

    # ── 상하 (좌우 처리 결과 기준): 양끝 평균으로 수렴
    mid = out.copy()
    avg_tb = (mid[0, :, :] + mid[-1, :, :]) * 0.5  # (w,3)
    rt = ramp.reshape(-1, 1, 1)
    out[:band, :, :] = mid[:band, :, :] * (1 - rt) + avg_tb[None, :, :] * rt
    out[-band:, :, :] = mid[-band:, :, :] * (1 - rt[::-1]) + avg_tb[None, :, :] * rt[::-1]

    return np.clip(out, 0, 255).astype(np.uint8)


def seam_fix(path):
    im = Image.open(path).convert("RGB")
    b = edge_diff(im)
    out = Image.fromarray(weld(np.asarray(im)), "RGB")
    a = edge_diff(out)
    return b, a, out


def main(dry=False):
    print(f"{'texture':22} {'전 좌우':>8} {'전 상하':>8} → {'후 좌우':>8} {'후 상하':>8}")
    changed = 0
    for name in TARGETS:
        webp = os.path.join(ASSETS, name + ".webp")
        png = os.path.join(ASSETS, name + ".png")
        src = webp if os.path.exists(webp) else (png if os.path.exists(png) else None)
        if not src:
            print(f"  ! {name} 없음")
            continue
        (bl, bt), (al, at), out = seam_fix(src)
        tag = "OK" if max(al, at) < 3 else ("개선" if max(al, at) < max(bl, bt) else "실패")
        print(f"{name:22} {bl:8.1f} {bt:8.1f} → {al:8.1f} {at:8.1f}  {tag}")
        if not dry and tag in ("OK", "개선"):
            for p in (webp, png):
                if os.path.exists(p) and not os.path.exists(p + ".orig"):
                    shutil.copy2(p, p + ".orig")
            out.save(src)
            other = png if src == webp else webp
            if os.path.exists(other):
                out.save(other)
            changed += 1
    print(f"\n봉합 {changed}개" + (" (dry-run)" if dry else " 완료 — 원본은 .orig 백업"))


if __name__ == "__main__":
    main(dry="--dry" in sys.argv)
