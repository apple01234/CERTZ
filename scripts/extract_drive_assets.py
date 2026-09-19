#!/usr/bin/env python3
"""Extract all 3 Google Drive asset archives and produce an inventory."""
import py7zr, os, sys, collections

DRIVE = "/home/z/my-project/upload/drive"
OUT = "/home/z/my-project/upload/drive_extracted"
os.makedirs(OUT, exist_ok=True)

archives = ["file1_real.bin", "file2_real.bin", "file3_real.bin"]

def list_archive(path):
    """Return list of file paths inside archive."""
    with py7zr.SevenZipFile(path, mode="r") as z:
        return [i.filename for i in z.list() if not i.is_directory]

def extract_all(path, dest):
    with py7zr.SevenZipFile(path, mode="r") as z:
        z.extractall(dest)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        for a in archives:
            p = os.path.join(DRIVE, a)
            try:
                names = list_archive(p)
                print(f"\n=== {a}: {len(names)} entries ===")
                # top 2 levels summary
                c = collections.Counter()
                exts = collections.Counter()
                for n in names:
                    parts = n.replace("\\", "/").split("/")
                    c["/".join(parts[:2])] += 1
                    if "." in parts[-1]:
                        exts[parts[-1].rsplit(".", 1)[1].lower()] += 1
                print("-- extensions:", dict(exts.most_common(12)))
                for k, v in c.most_common(30):
                    print(f"  {v:5d}  {k}")
            except Exception as e:
                print(f"{a}: ERROR {e}")
    elif cmd == "extract":
        for a in archives:
            p = os.path.join(DRIVE, a)
            dest = os.path.join(OUT, a.replace("_real.bin", ""))
            os.makedirs(dest, exist_ok=True)
            print(f"extracting {a} -> {dest} ...", flush=True)
            try:
                extract_all(p, dest)
                n = sum(len(f) for _, _, f in os.walk(dest))
                print(f"  done: {n} files")
            except Exception as e:
                print(f"  ERROR: {e}")
        print("ALL DONE")
