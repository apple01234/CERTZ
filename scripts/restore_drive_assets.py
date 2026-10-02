#!/usr/bin/env python3
"""v1.4.27 — 유저 Drive Assets.zip(34팩) 원본 복구 스크립트
upload/drive_restore/extracted/Assets/*.zip → research/assetpacks/<팩명>/ 2차 해제
용도: 원본 보관(게임 통합분은 public/assets에 이미 존재) + 향후 추가 변환 소스 확보
"""
import os, subprocess, sys

SRC = "/home/z/my-project/upload/drive_restore/extracted/Assets"
DST = "/home/z/my-project/research/assetpacks"

os.makedirs(DST, exist_ok=True)
ok, fail = [], []
for name in sorted(os.listdir(SRC)):
    path = os.path.join(SRC, name)
    if not os.path.isfile(path):
        continue
    stem = name
    for ext in (".zip", ".rar", ".7z"):
        if stem.lower().endswith(ext):
            stem = stem[: -len(ext)]
            break
    outdir = os.path.join(DST, stem)
    os.makedirs(outdir, exist_ok=True)
    r = subprocess.run(["unzip", "-qo", path, "-d", outdir],
                       capture_output=True, text=True, timeout=600)
    if r.returncode == 0:
        ok.append(name)
    else:
        fail.append((name, (r.stderr or "").strip()[:120]))
        # rar 등 실패 시 디렉토리 비우기 시도 유지(원본 zip은 보존됨)

print(f"OK {len(ok)} / FAIL {len(fail)}")
for n in ok:
    print("  ✓", n)
for n, e in fail:
    print("  ✗", n, "→", e)
