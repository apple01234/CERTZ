#!/usr/bin/env python3
"""
normalize_skill_icons.py — 스킬 아이콘 규격 통일 (지시서 #3)

문제
----
`public/assets/skillicon/` 290개 중
  · 112개가 32×32   (다른 아이콘은 64×64)
  ·   2개가 256×256 (`ultimate_s5`) — 8배
  · 확장자가 .png / .webp 혼재
`SKILL_ICONS`(classes.ts)는 `.webp` 경로만 참조하므로, .png 인 아이콘은
브라우저가 404 를 내고 버튼이 빈 채로 남는다("아이콘이 너무 커서 텍스트가 밀린다"의
실제 원인은 크기 혼재 + 경로 불일치 두 가지).

해결
----
1. 모든 아이콘을 64×64 RGBA 로 리샘플(nearest — 픽셀아트 보존).
2. `.webp` 로 통일 저장(품질 92, 무손실에 가깝게).
3. 원본은 `_orig/` 로 보존(되돌리기 가능).

주의: 이미 64×64 인 파일은 건드리지 않는다(재인코딩 손실 방지).
"""
import os, shutil, glob
from PIL import Image

DIR = "/root/workspace/CERTZ/public/assets/skillicon"
ORIG = os.path.join(DIR, "_orig")
TARGET = (64, 64)


def main():
    os.makedirs(ORIG, exist_ok=True)
    changed, kept, errs = [], 0, []
    files = sorted(f for f in glob.glob(os.path.join(DIR, "*"))
                   if os.path.isfile(f) and not f.endswith(".md"))
    for p in files:
        base = os.path.basename(p)
        stem, ext = os.path.splitext(base)
        try:
            im = Image.open(p)
        except Exception as e:
            errs.append((base, str(e)))
            continue
        # 이미 규격이고 webp 면 그대로 둔다
        if im.size == TARGET and ext.lower() == ".webp":
            kept += 1
            continue
        # 원본 보존
        bak = os.path.join(ORIG, base)
        if not os.path.exists(bak):
            shutil.copy2(p, bak)
        out = os.path.join(DIR, stem + ".webp")
        try:
            conv = im.convert("RGBA").resize(TARGET, Image.NEAREST)
            conv.save(out, "WEBP", quality=92, method=6)
            # 원본이 .png 이고 out 과 다른 파일이면 원본 제거(중복 방지)
            if os.path.abspath(p) != os.path.abspath(out):
                os.remove(p)
            changed.append((base, f"{im.size} -> {TARGET}"))
        except Exception as e:
            errs.append((base, str(e)))
    print(f"통일: {len(changed)}개 / 유지: {kept}개 / 오류: {len(errs)}개")
    for c in changed[:8]:
        print(f"   {c[0]:26s} {c[1]}")
    if len(changed) > 8:
        print(f"   ... 외 {len(changed)-8}개")
    for e in errs[:5]:
        print("   ERR", e)
    # 최종 검증
    bad = []
    for p in glob.glob(os.path.join(DIR, "*")):
        if os.path.isdir(p):
            continue
        try:
            if Image.open(p).size != TARGET:
                bad.append((os.path.basename(p), Image.open(p).size))
        except Exception:
            pass
    print(f"\n최종 비규격: {len(bad)}개")
    for b in bad[:5]:
        print("   ", b)
    print(f"원본 백업: {ORIG}")


if __name__ == "__main__":
    main()
