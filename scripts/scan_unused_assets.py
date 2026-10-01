#!/usr/bin/env python3
# 미사용 에셋 스캐너 — public/assets 파일명(확장자 제외)이 src/ 코드에 참조되는지 전수 검사
import os, re, subprocess

ROOT = "/home/z/my-project"
ASSETS = f"{ROOT}/public/assets"

# 코드 전부 읽기 (src + server.js + public/*.html)
code = []
for base, dirs in [("src", None), (".", ["server.js"]), ("public", ["assets"])]:
    for dp, dns, fns in os.walk(f"{ROOT}/{base}"):
        if dirs:
            dns[:] = [d for d in dns if d in dirs]
        for fn in fns:
            if fn.endswith((".ts", ".tsx", ".js", ".html", ".css", ".json")):
                try:
                    code.append(open(os.path.join(dp, fn), encoding="utf-8", errors="ignore").read())
                except Exception:
                    pass
blob = "\n".join(code)

fams = {}
for fn in sorted(os.listdir(ASSETS)):
    p = os.path.join(ASSETS, fn)
    if not os.path.isfile(p):
        continue
    stem = fn.rsplit(".", 1)[0]
    # 접미 프레임 번호(_idle0/_walk3/_atkdown2 등) 제거 → 패밀리 키 추정
    fam = re.sub(r"_(idle|walk|walkup|walkside|walkdown|atk|atkup|atkdown|atkup|run|runup|runside|rundown|up|down|side|2|3|4|5|6|7|8|9|0)\d*$", "", stem)
    fam = re.sub(r"\d+$", "", fam)
    fams.setdefault(fam, []).append(fn)

unused_fams, used_fams, unused_files = [], [], []
for fam, files in sorted(fams.items()):
    # 패밀리명 OR 개별 파일명이 코드에 등장하는지
    fam_hit = re.search(rf"['\"\`/\.]{re.escape(fam)}['\"\`\. ]", blob) is not None or (fam in blob)
    if fam_hit:
        used_fams.append(fam)
    else:
        any_hit = any(re.search(re.escape(f.rsplit('.',1)[0]), blob) for f in files)
        if any_hit:
            used_fams.append(fam)
        else:
            unused_fams.append(fam)
            unused_files.extend(files)

print(f"패밀리 총 {len(fams)} / 사용 {len(used_fams)} / 미사용 {len(unused_fams)}")
print(f"미사용 파일 총 {len(unused_files)}개")
print("--- 미사용 패밀리 (파일수) ---")
for fam in unused_fams:
    print(f"  {fam} ({len(fams[fam])})")
