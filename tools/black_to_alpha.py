#!/usr/bin/env python3
"""#10 — 검은 배경 VFX 에셋의 검은 배경을 투명으로 바꾼다.

이 게임의 VFX 는 Phaser 에서 BlendModes.ADD 로 그려진다. ADD 는
  결과 = 목적지 + (소스 × 소스알파)
이므로 "검은 배경 + 밝은 이펙트" PNG 는 알파를 무시하고 **검은 사각형이 그대로 더해져**
화면에 검은 네모가 보인다.

해결: 검은 배경을 알파 0 으로 만드는 대신, **밝기를 알파로 승격**한다.
  α' = max(R,G,B) / 255 ,  RGB' = 원본 / α'  (색 보존)
이러면 검은 영역은 α=0 이 되어 ADD 에서 아무것도 더하지 않고,
밝은 이펙트는 원래 색과 세기를 유지한다.

사용: python3 tools/black_to_alpha.py <파일...> [--apply]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def convert(src: Path, dst: Path, floor: int = 8) -> tuple[int, int]:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    sp, dp = im.load(), out.load()
    cleared = 0
    for y in range(h):
        for x in range(w):
            r, g, b = sp[x, y]
            a = max(r, g, b)
            if a <= floor:
                dp[x, y] = (0, 0, 0, 0)
                cleared += 1
            else:
                # 색을 원래 밝기로 정규화해 알파로 세기를 옮긴다
                k = 255.0 / a
                dp[x, y] = (
                    min(255, int(r * k)),
                    min(255, int(g * k)),
                    min(255, int(b * k)),
                    a,
                )
    out.save(dst, "WEBP", lossless=True, quality=100, method=6, exact=True)
    return cleared, w * h


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    if not args:
        print("사용: python3 tools/black_to_alpha.py <파일...> [--apply]")
        return 2
    for a in args:
        src = Path(a)
        if not src.exists():
            print(f"  없음: {src}")
            continue
        dst = src.with_suffix(".webp")
        if not apply:
            im = Image.open(src).convert("RGB")
            dark = sum(1 for p in im.getdata() if max(p) <= 8)
            print(f"  {src.name}: 검을픽셀 {dark}/{im.width*im.height} ({dark/(im.width*im.height)*100:.0f}%)")
            continue
        cleared, total = convert(src, dst)
        print(f"  {dst.name}: 투명화 {cleared}/{total} ({cleared/total*100:.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
