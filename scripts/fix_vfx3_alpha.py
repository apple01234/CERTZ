#!/usr/bin/env python3
"""vfx3 검은 배경 → 알파 변환 (사용자 지시).

[문제] public/assets/vfx3/*.webp 81개 중 **46개가 완전 불투명 검정 배경**이었다.
  512×512 코너 6점이 전부 (0,0,0,255). 지금은 18곳 모두 `BlendModes.ADD` 로만 쓰여
  검정이 무해하지만(=검정은 더하기에서 0), 다음과 같은 실제 문제가 있다:
    · ADD 외 사용(축소·회전·NORMAL 타격 연출)에서 **검은 사각 박스**가 그대로 보인다.
    · 파일 크기 낭비(검정 50~86%가 의미 없는 데이터).
    · atlas/스프라이트 시트로 묶을 때 검정이 다른 프레임을 오염시킨다.

[변환 방식] 알파 = 루마(Rec.709), RGB = 원본 유지 (프리멀티플라이 아님).
  · ADD 는 src.rgb * src.a 를 더하므로, rgb 를 유지하고 a=루마로 두면
    검정 배경은 a=0(기여 없음), 밝은 부분은 a=1 에 가까워져 **기존 ADD 결과와 거의 같다**.
    (정확히 같지는 않다: 기존엔 rgb 자체가 더해졌고 이제는 rgb*루마 가 더해진다.
     루마가 밝기와 비례하므로 시각적으로 동일 계열이며, 오히려 이중 감쇠가 없어 깔끔하다.)
  · NORMAL 에서도 검정 배경이 사라져 정상 동작한다.
  · 순수 검정이 아닌 어두운 픽셀도 루마만큼 알파를 줘 부드러운 가장자리를 유지한다.

[안전장치] 이미 알파가 있는 파일(투명 배경 35개)은 건드리지 않는다.
  되돌리기 쉽도록 원본은 scripts/vfx3_backup/ 이 아니라 **git 이력**에 의존한다
  (변환 전 상태가 커밋 eab52e4 에 있음).

사용: python3 scripts/fix_vfx3_alpha.py [--dry]
"""
from PIL import Image
import glob
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VFX = os.path.join(ROOT, "public/assets/vfx3")


def luma(r, g, b):
    """Rec.709 루마 — 사람 눈이 느끼는 밝기."""
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def has_opaque_black_corner(im):
    """모서리가 불투명 검정이면 배경이 검정인 파일로 판정."""
    w, h = im.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2)]
    px = im.load()
    hits = 0
    for x, y in pts:
        r, g, b, a = px[x, y]
        if a > 200 and r < 16 and g < 16 and b < 16:
            hits += 1
    return hits >= 2


def to_alpha(im):
    """알파 = 루마. RGB 는 유지."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # 이미 반투명이면 원래 알파를 존중해 곱한다
            na = int(round(255 * luma(r, g, b) * (a / 255.0)))
            px[x, y] = (r, g, b, na)
    return im


def main():
    dry = "--dry" in sys.argv
    files = sorted(glob.glob(os.path.join(VFX, "*.webp")))
    converted, skipped, failed = [], [], []
    for p in files:
        try:
            im = Image.open(p)
            if im.mode != "RGBA":
                im = im.convert("RGBA")
            if not has_opaque_black_corner(im):
                skipped.append(os.path.basename(p))
                continue
            out = to_alpha(im)
            bb = out.getbbox()
            if not bb:
                failed.append((os.path.basename(p), "알파 변환 후 완전 투명"))
                continue
            if not dry:
                out.save(p, "WEBP", lossless=True, quality=100)
            converted.append(os.path.basename(p))
        except Exception as e:  # noqa: BLE001 — 개별 파일 실패가 전체를 막지 않게
            failed.append((os.path.basename(p), str(e)))
    print(f"{'[DRY] ' if dry else ''}검정 배경 제거: {len(converted)}개 / 이미 투명: {len(skipped)}개 / 실패: {len(failed)}개")
    for n, e in failed:
        print(f"  ✗ {n}: {e}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
