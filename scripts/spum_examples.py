#!/usr/bin/env python3
"""v4.2.0 — SPUM.7z 내부에서 예제/데모 이미지 탐색 (조합 검증 참조용)"""
import py7zr

with py7zr.SevenZipFile("/home/z/my-project/upload/SPUM.7z", mode="r") as z:
    names = z.getnames()
print(f"total {len(names)}")
hits = [n for n in names if any(k in n.lower() for k in ("demo", "example", "preview", "sample", "screenshot"))]
for h in hits[:40]:
    print(h)
print("---루트/상위 구조---")
tops = sorted(set(n.split("/")[0] + ("/" + n.split("/")[1] if "/" in n else "") for n in names))
for t in tops[:30]:
    print(t)
