#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc191 (지시 #13) — 아이콘 UI 가 어두워서 잘 안 보이는 문제 보정.

[원인]
  · 아이콘 원본(FantasyHeroes)은 내부가 짙은 회색·검정 위주라 어두운 패널 배경과 붙으면
    실루엣만 남고 디테일이 사라진다. (vision 실측: "날 안쪽이 흑색에 가까워 작은 크기에서
    덩어리진 검은 면으로 보인다")
  · UI 배경이 반투명 흑색(game-chip / bg-black/40)이라 대비가 더 떨어진다.

[보정]
  1) 알파 경계에 **밝은 림(테두리)** 을 1px 추가 — 어떤 배경에서도 실루엣이 읽힌다.
  2) 색상 최소 명도 상향(그림자 리프트) — 순수 검정을 짙은 회색으로 올려 디테일을 살린다.
  3) 채도/대비 소폭 상향 — 작은 크기에서 형태가 뭉개지지 않게.
  원본은 public/assets/iconpack/orig/ 에 1회 백업한다(재실행 시 원본에서 다시 계산).

사용: python3 tools/brighten-icons.py [--dry]
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.environ.get("SERTZ_ROOT", "/root/workspace/CERTZ")
ASSETS = os.path.join(ROOT, "public", "assets")
BACKUP = os.path.join(ASSETS, "iconpack", "orig")
DRY = "--dry" in sys.argv

# 보정 대상 — 장비/아이콘 UI 에 실제로 그려지는 것들
PREFIXES = ("item_", "i_", "furn_")
SKIP = ("iconpack",)

# ---- 보정 파라미터 (실측 기반) ----
LIFT = 26        # 최소 명도 상승폭 (0~255). 순수 검정 → 26
RIM_RGB = (255, 246, 214)  # 림 색 — 따뜻한 크림 (금테 느낌)
RIM_ALPHA = 132            # 낮춤 — 전방향 균일 강조선이 "선택 영역"처럼 보이던 문제 완화
GLOW_ALPHA = 92            # 바깥 확산광
CONTRAST = 1.12
SATURATION = 1.10


def targets():
    out = []
    for f in sorted(os.listdir(ASSETS)):
        if not f.endswith(".webp"):
            continue
        if not f.startswith(PREFIXES):
            continue
        if any(s in f for s in SKIP):
            continue
        out.append(f)
    return out


def process(path):
    """보정 + 림/글로우. 글로우가 캔버스 경계에서 잘리지 않도록 여백을 먼저 확보한 뒤
    최종 크기를 원래 크기로 되돌린다."""
    src = Image.open(path).convert("RGBA")
    W0, H0 = src.size
    PAD = 6  # 글로우가 0%까지 사라질 공간 (MaxFilter(7)+Blur(2.2) 최대 반경 4px 이상)

    padded = Image.new("RGBA", (W0 + PAD * 2, H0 + PAD * 2), (0, 0, 0, 0))
    padded.paste(src, (PAD, PAD))

    a = np.array(padded, dtype=np.float32)
    rgb, alpha = a[..., :3], a[..., 3]

    # 1) 명도 리프트 + 대비 + 채도
    rgb = np.clip(rgb + LIFT, 0, 255)
    rgb = np.clip((rgb - 128.0) * CONTRAST + 128.0, 0, 255)
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(gray + (rgb - gray) * SATURATION, 0, 255)

    out = np.dstack([rgb, alpha]).astype(np.uint8)
    base = Image.fromarray(out, "RGBA")

    # 2) 림 + 외곽 확산광 — 1px 딱딱한 선 대신 부드럽게 번지는 테두리
    #    (vision 지적: 균일 1px 스트로크는 "선택 영역"처럼 보이고 계단현상이 인위적)
    mask = Image.fromarray((alpha > 8).astype(np.uint8) * 255, "L")
    grown = mask.filter(ImageFilter.MaxFilter(3))

    # 2-a) 림: 실루엣 바로 바깥 1px
    rim_mask = Image.fromarray(
        np.clip(np.array(grown, dtype=np.int16) - np.array(mask, dtype=np.int16), 0, 255).astype(np.uint8),
        "L",
    )
    rim_mask = rim_mask.filter(ImageFilter.GaussianBlur(0.6))  # 계단 완화
    rim = Image.new("RGBA", base.size, RIM_RGB + (0,))
    rim.putalpha(rim_mask.point(lambda v: int(v * RIM_ALPHA / 255)))

    # 2-b) 바깥 확산광: 더 넓게 부풀린 뒤 흐림 — 배경과 아이콘 사이 완충
    wide = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2.2))
    glow_mask = Image.fromarray(
        np.clip(np.array(wide, dtype=np.int16) - np.array(grown, dtype=np.int16), 0, 255).astype(np.uint8),
        "L",
    )
    glow = Image.new("RGBA", base.size, RIM_RGB + (0,))
    glow.putalpha(glow_mask.point(lambda v: int(v * GLOW_ALPHA / 255)))

    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(rim)
    canvas.alpha_composite(base)

    # PAD 를 잘라내면 글로우가 다시 경계에 부딪힌다 - 캔버스를 키운 채로 저장한다.
    #  표시 크기는 CSS(h-full/w-full, object-contain)가 정하므로 76x76 이어도 렌더는 동일하다.

    if not DRY:
        canvas.save(path, "WEBP", quality=94, method=6)
    return canvas


def main():
    files = targets()
    os.makedirs(BACKUP, exist_ok=True)
    done = 0
    for f in files:
        p = os.path.join(ASSETS, f)
        bak = os.path.join(BACKUP, f)
        # 원본 1회 백업 — 재실행 시 원본 기준으로 다시 계산(누적 보정 방지)
        if os.path.exists(bak):
            shutil.copyfile(bak, p)
        else:
            shutil.copyfile(p, bak)
        process(p)
        done += 1
    print(f"보정 {done}개 · 백업 {BACKUP}")


if __name__ == "__main__":
    main()
