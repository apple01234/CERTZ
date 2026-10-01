#!/usr/bin/env python3
"""v4.1.9 — 메이지 프리팹 파츠 디버그: SpriteRenderer 목록 + 위치/피벗/z 출력"""
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
import importlib.util
spec = importlib.util.spec_from_file_location("spum", "/home/z/my-project/scripts/spum_compose.py")
spum = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spum)

PREFAB = "/home/z/my-project/asset_work/spum/SPUM/Resources/Addons/BasicPack/2_Prefab/Human/SPUM_20240911215639493.prefab"
import os
if not os.path.exists(PREFAB):
    # 메이지 후보 프리팹 찾기 — premium_assets 매핑: Human_639493 = SPUM_...474?
    import glob
    for pf in sorted(glob.glob("/home/z/my-project/asset_work/spum/SPUM/Resources/Addons/BasicPack/2_Prefab/Human/*.prefab")):
        base = os.path.splitext(os.path.basename(pf))[0][-6:]
        if base == "639493":
            PREFAB = pf
            break
print("prefab:", PREFAB)

texdb = spum.build_db()
docs = spum.parse_prefab(PREFAB)
gos, transforms, srs = spum.get_component_docs(docs)
go_sr = {}
for k, v in srs.items():
    go_sr.setdefault(v["go"], k)

roots = [k for k, v in transforms.items() if not v["father"] or v["father"] not in transforms]

def walk(tfid, depth, px, py):
    tf = transforms[tfid]
    x = px + tf["pos"][0] * tf["scale"][0] * spum.PPU
    y = py - tf["pos"][1] * tf["scale"][1] * spum.PPU
    go = tf["go"]
    name = gos.get(go, {}).get("name", "?")
    line = "  " * depth + f"{name} pos=({x:.1f},{y:.1f}) scl={tf['scale']}"
    if go in go_sr:
        sr = srs[go_sr[go]]
        td = texdb.get(sr["guid"])
        if td:
            sps = td["sprites"]
            if sr["iid"] in sps:
                sp = sps[sr["iid"]]
                line += f" | {os.path.basename(td['path'])}:{sp['name']} rect={tuple(int(v) for v in sp['rect'])} pivot={sp['pivot']} col={tuple(round(c,2) for c in sr['color'])} flip={sr['flipx']}"
            else:
                line += f" | {os.path.basename(td['path'])}:FULL(iid미상 {sr['iid']}) root_pivot={td['root_pivot']}"
        else:
            line += f" | !guid미상 {sr['guid'][:8]}"
    print(line)
    for ch in tf["children"]:
        if ch in transforms:
            walk(ch, depth + 1, x, y)

for r in roots:
    walk(r, 0, 0, 0)
