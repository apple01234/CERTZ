#!/usr/bin/env python3
"""v4.2.0 — SPUM.7z에서 SPUM 트리만 재추출 (예제 SamplePlayer 참조 검증용)"""
import py7zr, os

OUT = "/home/z/my-project/asset_work"
os.makedirs(OUT, exist_ok=True)
with py7zr.SevenZipFile("/home/z/my-project/upload/SPUM.7z", mode="r") as z:
    names = z.getnames()
    targets = [n for n in names if n.startswith("SPUM/")]
    print(f"SPUM 파일 {len(targets)}개 추출 중...")
    z.extract(path=OUT, targets=targets)
print("완료")
