#!/usr/bin/env python3
"""변환된 VFX GLB 정리 + 카탈로그 병합 (v1.4.41).

배경
----
FBX 586개 중 실제로 이 프로젝트에 쓸 VFX 메시는 **39개**(uni/GameVFX/JMO/Hovl/Toon).
`tools/fbx_to_glb.py` 로 변환하면 파일명이 `원본.fbx__이름.glb` 형태로 나오고,
Blender 3줄 제한 때문에 이름이 잘린다(`cfxr_mesh_disk.fbx__cfxr_mesh_disk` → 63자 컷).

이 스크립트가 하는 일
--------------------
1. `assets3d_vfx/*.glb` → **정규화된 이름**으로 `assets3d/` 에 복사
   (`uni_skull.fbx__uni_skull.glb` → `vfx__uni_skull.glb`)
2. `_report.json` 에 항목을 병합해 게임의 `assets3d.ts` 카탈로그가 자동 인식하게 한다
   (cine3d 는 `assets3d/` 의 GLB 를 이름으로 직접 참조한다)

  python3 tools/merge_vfx_glb.py --dry-run
  python3 tools/merge_vfx_glb.py --apply
"""
import argparse
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "assets3d_vfx")
DST = os.path.join(ROOT, "public", "assets3d")
REPORT = os.path.join(DST, "_report.json")

PREFIX = "vfx__"


def norm_name(fname: str) -> str:
    """`uni_skull.fbx__uni_skull.glb` → `vfx__uni_skull`"""
    base = fname[:-4]  # .glb
    if "__" in base:
        base = base.split("__", 1)[1]  # 뒤쪽(메시 이름)를 취한다
    base = re.sub(r"[^A-Za-z0-9_]+", "_", base).strip("_").lower()
    return PREFIX + base


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.apply and not a.dry_run:
        ap.print_help()
        return 1

    if not os.path.isdir(SRC):
        print(f"소스 없음: {SRC}")
        return 2

    files = sorted(f for f in os.listdir(SRC) if f.endswith(".glb"))
    renamed, collisions = [], []
    seen = {}
    for f in files:
        key = norm_name(f)[len(PREFIX):]
        if key in seen:
            collisions.append((key, seen[key], f))
            continue
        seen[key] = f
        renamed.append((f, f"{PREFIX}{key}.glb"))

    print(f"변환 결과 {len(files)}개 → 정규화 {len(renamed)}개 (중복 {len(collisions)})")
    for old, new in renamed:
        size = os.path.getsize(os.path.join(SRC, old))
        print(f"  {old[:44]:44s} → {new:34s} {size:>7d}B")
        if a.apply:
            shutil.copyfile(os.path.join(SRC, old), os.path.join(DST, new))
    for key, a1, a2 in collisions:
        print(f"  중복 {key}: {a1} / {a2}")

    if a.apply:
        # _report.json 병합 — 기존 항목 보존, 신규만 추가
        try:
            report = json.load(open(REPORT, encoding="utf-8"))
        except Exception:
            report = {"summary": {}, "items": []}
        items = report.setdefault("items", [])
        existing = {it.get("glb") for it in items if it.get("ok")}
        added = 0
        for _, new in renamed:
            if new in existing:
                continue
            p = os.path.join(DST, new)
            items.append({
                "file": f"vfx/{new}",
                "ok": True,
                "glb": new,
                "glb_bytes": os.path.getsize(p),
                "meshes": 1,
                "verts": 0,
                "polys": 0,
                "materials": [],
                "actions": [],
                "objects": 1,
            })
            added += 1
        ok = [it for it in items if it.get("ok")]
        report["summary"] = {
            **(report.get("summary") or {}),
            "total": len(items),
            "ok": len(ok),
            "failed": len([it for it in items if not it.get("ok")]),
            "glbBytes": sum(int(it.get("glb_bytes") or 0) for it in ok),
        }
        json.dump(report, open(REPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\n카탈로그 병합 — 신규 {added}개 / 전체 OK {len(ok)}개")

    print(f"\n{'APPLY' if a.apply else 'DRY-RUN'} 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
