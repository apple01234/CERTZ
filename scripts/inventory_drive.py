#!/usr/bin/env python3
"""Inventory usable web assets (png/tga/wav) from extracted drive packs."""
import os, collections

ROOTS = {
    "file1": "/home/z/my-project/upload/drive_extracted/file1",
    "file2": "/home/z/my-project/upload/drive_extracted/file2",
    "file3": "/home/z/my-project/upload/drive_extracted/file3",
}

def walk(root):
    for dp, _, fns in os.walk(root):
        for fn in fns:
            yield os.path.join(dp, fn)

if __name__ == "__main__":
    for name, root in ROOTS.items():
        if not os.path.isdir(root):
            print(f"{name}: NOT EXTRACTED YET")
            continue
        exts = collections.Counter()
        sizes = collections.Counter()
        dirs = collections.Counter()
        for p in walk(root):
            fn = os.path.basename(p)
            ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else "?"
            exts[ext] += 1
            try:
                sz = os.path.getsize(p)
                sizes[ext] += sz
            except OSError:
                pass
            rel = os.path.relpath(p, root).split(os.sep)
            if len(rel) >= 2:
                dirs["/".join(rel[:2])] += 1
        print(f"\n===== {name} =====")
        print("counts:", dict(exts.most_common(10)))
        print("bytes MB:", {k: round(v / 1e6, 1) for k, v in sizes.most_common(8)})
        for k, v in sorted(dirs.items()):
            print(f"  {v:5d}  {k}")
