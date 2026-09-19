#!/usr/bin/env python3
"""List contents of the 3 Google Drive 7z archives"""
import py7zr
import os

base = "/home/z/my-project/upload/drive"
for name in ["file1_real.bin", "file2_real.bin", "file3_real.bin"]:
    path = os.path.join(base, name)
    print(f"\n{'='*70}")
    print(f"=== {name} ({os.path.getsize(path)/1024/1024:.1f} MB) ===")
    print('='*70)
    try:
        with py7zr.SevenZipFile(path, mode='r') as z:
            names = z.getnames()
            print(f"Total entries: {len(names)}")
            # Show top-level structure
            top = {}
            for n in names:
                parts = n.split('/')
                key = parts[0] if len(parts) > 1 else "(root files)"
                top.setdefault(key, 0)
                top[key] += 1
            print("\nTop-level structure:")
            for k, v in sorted(top.items(), key=lambda x: -x[1])[:30]:
                print(f"  {k}: {v} entries")
            # Show sample files
            print("\nSample entries (first 40):")
            for n in names[:40]:
                print(f"  {n}")
            # Show file extensions breakdown
            exts = {}
            for n in names:
                ext = os.path.splitext(n)[1].lower()
                exts[ext] = exts.get(ext, 0) + 1
            print("\nExtensions:")
            for k, v in sorted(exts.items(), key=lambda x: -x[1])[:20]:
                print(f"  {k}: {v}")
    except Exception as e:
        print(f"ERROR: {e}")
