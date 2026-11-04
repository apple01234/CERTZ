#!/usr/bin/env python3
"""CERTZ 에셋 상태 조사 — Scrapling 으로 원격/런타임 자산을 대조한다.

[왜] 인계 문서의 미완료 항목 중 "지역별 일관된 다운로드 에셋"이 있는데,
어떤 키가 실제로 파일이 없어 __MISSING 으로 그려지는지 목록이 없었다.
여기서는 (1) 런타임이 참조하는 obj_* 키와 (2) 실제 파일 존재를 대조해
깨진 참조를 뽑는다. 새 에셋 생성/다운로드는 하지 않는다(조사 전용).
"""
import re
import sys
from pathlib import Path

ROOT = Path("/root/workspace/CERTZ")


def collect_referenced_keys():
    """src 전체에서 obj_*/wx_*/ground_* 로 참조되는 텍스처 키를 모은다."""
    keys = set()
    pat = re.compile(r'"(obj_[a-z0-9_]+|wx_[a-z0-9_]+)"')
    for p in ROOT.glob("src/**/*.ts"):
        try:
            t = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in pat.finditer(t):
            keys.add(m.group(1))
    return keys


def collect_files():
    """public/assets 아래 실제 파일 키를 모은다."""
    have = set()
    for p in ROOT.glob("public/assets/**/*.png"):
        have.add(p.stem)
    for p in ROOT.glob("public/assets/**/*.webp"):
        have.add(p.stem)
    return have


def main():
    refs = collect_referenced_keys()
    files = collect_files()
    missing = sorted(k for k in refs if k not in files)
    print(f"참조 텍스처 키: {len(refs)}")
    print(f"실제 파일 키  : {len(files)}")
    print(f"파일 없음     : {len(missing)}")
    if missing:
        print("\n--- 파일이 없는 참조 (Phaser __MISSING 으로 그려질 수 있음) ---")
        for k in missing:
            # 어느 파일에서 참조하는지
            where = []
            for p in ROOT.glob("src/**/*.ts"):
                try:
                    if f'"{k}"' in p.read_text(encoding="utf-8"):
                        where.append(p.relative_to(ROOT).as_posix())
                except Exception:
                    pass
            print(f"  {k:34} <- {', '.join(where[:2]) or '?'}")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
