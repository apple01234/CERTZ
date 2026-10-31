#!/usr/bin/env python3
"""
fix_lossy_tiles.py — 열화된 webp 타일을 PNG 원본에서 복원 (지시서 #11 "종이 쪼가리")

문제
----
BootScene 이 `ASSET_LIST` 를 **항상 `.webp` 로** 로드한다:

    for (const key of ASSET_LIST) this.load.image(key, `${key}.webp`);

그런데 저장소에는 같은 이름의 **256px PNG 원본**이 따로 있고, 일부 `.webp` 는
PNG 를 저품질로 재인코딩한 **열화본**이다. 실측:

    tile_magma  png 107색 → webp   7색   (93% 손실)
    tile_hel    png 129색 → webp  49색
    tile_ice    png 193색 → webp 129색
    tile_abyss  png  67색 → webp  39색
    tile_stone  png  70색 → webp  39색

7색짜리 타일이 화면에 깔리면 단색 판때기처럼 보인다 — 이것이 "왜 종이 쪼가리임?"의 정체다.

해결
----
PNG 원본이 있는 타일은 **무손실 webp** 로 다시 만든다(quality 100, method 6, exact).
손실 webp 는 같은 해상도에서도 색이 뭉개지므로 `lossless=True` 가 필수다.

부가: BootScene 이 PNG 우선으로 로드하도록 바꾸면(별도 수정) 앞으로 이런 열화가
화면에 나가지 않는다. 이 스크립트는 **이미 열화된 파일 자체를 복구**한다.

사용
    python3 tools/fix_lossy_tiles.py            # 미리보기
    python3 tools/fix_lossy_tiles.py --apply    # 실제 덮어쓰기(원본은 .tile_backup/)
"""
import os
import sys
import shutil
from PIL import Image

ROOT = "/root/workspace/CERTZ/public/assets"
BACKUP = os.path.join(ROOT, ".tile_backup")
THRESHOLD = 0.85  # webp 색 수가 png 의 70% 미만이면 열화로 판정


def colors(p):
    return len(Image.open(p).convert("RGB").getcolors(maxcolors=1_000_000) or [])


def main():
    apply = "--apply" in sys.argv
    os.makedirs(BACKUP, exist_ok=True)

    pngs = sorted(f[:-4] for f in os.listdir(ROOT) if f.startswith("tile_") and f.endswith(".png"))
    rows = []
    for key in pngs:
        png = os.path.join(ROOT, key + ".png")
        web = os.path.join(ROOT, key + ".webp")
        a = colors(png)
        b = colors(web) if os.path.exists(web) else None
        bad = b is not None and b < a * THRESHOLD
        rows.append((key, a, b, bad))

    print(f"{'타일':22s} {'png색':>6s} {'webp색':>7s} {'판정':>8s}")
    todo = []
    for key, a, b, bad in rows:
        mark = "열화" if bad else ("webp없음" if b is None else "정상")
        print(f"{key:22s} {a:>6d} {str(b if b is not None else '-'):>7s} {mark:>8s}")
        if bad:
            todo.append(key)

    if not todo:
        print("\n복구할 타일 없음")
        return

    print(f"\n복구 대상 {len(todo)}개: {', '.join(todo)}")
    if not apply:
        print("(미리보기 — 실제 적용은 --apply)")
        return

    for key in todo:
        png = os.path.join(ROOT, key + ".png")
        web = os.path.join(ROOT, key + ".webp")
        bak = os.path.join(BACKUP, key + ".webp.orig")
        if os.path.exists(web) and not os.path.exists(bak):
            shutil.copy2(web, bak)
        im = Image.open(png).convert("RGBA")
        if im.size != (256, 256):
            im = im.resize((256, 256), Image.LANCZOS)
        # lossless — 손실 압축이 색을 뭉개는 것이 원인이므로 반드시 무손실
        im.save(web, "WEBP", lossless=True, quality=100, method=6, exact=True)

    print("\n=== 복구 후 ===")
    for key in todo:
        a = colors(os.path.join(ROOT, key + ".png"))
        b = colors(os.path.join(ROOT, key + ".webp"))
        ok = "OK" if b >= a * THRESHOLD else "여전히 부족"
        print(f"  {key:22s} png {a:>4d} → webp {b:>4d}색  {ok}")
    print(f"\n원본 백업: {BACKUP}/*.webp.orig")


if __name__ == "__main__":
    main()
