#!/usr/bin/env python3
"""Extract usable PNG assets from the 3 VFX 7z archives into a staging folder."""
import py7zr
import os
import shutil

BASE = "/home/z/my-project/upload/drive"
OUT = "/home/z/my-project/upload/vfx_extract"

os.makedirs(OUT, exist_ok=True)

total = 0
for name in ["file1_real.bin", "file2_real.bin", "file3_real.bin"]:
    path = os.path.join(BASE, name)
    tag = name.split("_")[0]
    with py7zr.SevenZipFile(path, mode="r") as z:
        names = z.getnames()
        # Only PNG files (usable in web), skip tiny ones and .meta
        targets = [n for n in names if n.lower().endswith(".png")]
        print(f"{name}: {len(targets)} PNGs of {len(names)} entries")
        # Extract all to temp then filter
        tmp = os.path.join(OUT, "_tmp_" + tag)
        os.makedirs(tmp, exist_ok=True)
        z.extract(path=tmp, targets=targets)
        # Copy PNGs to flat staging with package prefix
        for n in targets:
            src = os.path.join(tmp, n)
            if not os.path.isfile(src):
                continue
            sz = os.path.getsize(src)
            if sz < 300:  # skip tiny placeholder images
                continue
            rel = n.replace("/", "_").replace(" ", "_")
            dst = os.path.join(OUT, f"{tag}__{rel}")
            shutil.copy2(src, dst)
            total += 1
        shutil.rmtree(tmp, ignore_errors=True)

print(f"\nTotal extracted: {total} PNGs -> {OUT}")
