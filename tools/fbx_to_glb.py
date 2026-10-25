"""
vc180 — FBX 3D 에셋을 **3D 그대로** 게임에 쓰기 위한 렌더 파이프라인.

⚠️ 2D 변환 금지 (사용자 명시 지시).
   - 스프라이트시트/빌보드로 "구워서" 쓰지 않는다.
   - 대신 아래 두 가지 3D 경로를 만든다:
     ① .glb 익스포트 — three.js/Phaser-3D 등 런타임 3D 로더가 읽는 표준 포맷
     ② 턴테이블/궤도 카메라 프리뷰 렌더 — 팀이 에셋을 눈으로 검수하기 위한 용도
        (게임 에셋이 아니라 QA 산출물이다)

사용:
  blender --background --python tools/fbx_to_glb.py -- --in <fbx_dir> --out <glb_dir>
"""
import bpy
import os
import sys
import glob
import json
import argparse


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_dir", required=True)
    ap.add_argument("--out", dest="out_dir", required=True)
    ap.add_argument("--scale", type=float, default=1.0)
    return ap.parse_args(argv)


def collect_fbx(root):
    pats = ("**/*.fbx", "**/*.FBX")
    found, seen = [], set()
    for p in pats:
        for f in glob.glob(os.path.join(root, p), recursive=True):
            rp = os.path.realpath(f)
            if rp not in seen:
                seen.add(rp)
                found.append(f)
    return sorted(found)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # 임포트 단위 통일 — FBX마다 스케일이 제각각인 문제를 줄인다
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def import_fbx(path):
    bpy.ops.import_scene.fbx(
        filepath=path,
        use_anim=True,
        ignore_leaf_bones=False,
        automatic_bone_orientation=True,
    )


def mesh_stats():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    return {
        "meshes": len(meshes),
        "verts": sum(len(o.data.vertices) for o in meshes),
        "polys": sum(len(o.data.polygons) for o in meshes),
        "materials": sorted({m.name for o in meshes for m in o.data.materials if m}),
        "actions": [a.name for a in bpy.data.actions],
        "objects": len(bpy.data.objects),
    }


def export_glb(out_path):
    """표준 3D 포맷으로 익스포트 — 2D로 굽지 않는다."""
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_apply=True,
        export_animations=True,
        export_yup=True,
        use_selection=False,
    )


def main():
    args = parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    files = collect_fbx(args.in_dir)

    report = []
    for i, f in enumerate(files, 1):
        rel = os.path.relpath(f, args.in_dir)
        base = os.path.splitext(os.path.basename(f))[0]
        # 이름 충돌 방지 — 하위 폴더 접두사
        prefix = rel.split(os.sep)[0].replace(" ", "_").lower()[:18]
        out_name = f"{prefix}__{base}.glb".replace(" ", "_")
        out_path = os.path.join(args.out_dir, out_name)

        reset_scene()
        try:
            import_fbx(f)
        except Exception as e:
            report.append({"file": rel, "ok": False, "stage": "import", "err": str(e)[:160]})
            print(f"[{i}/{len(files)}] FAIL-IMPORT {rel}")
            continue

        st = mesh_stats()
        if st["meshes"] == 0:
            report.append({"file": rel, "ok": False, "stage": "empty", "err": "no mesh"})
            print(f"[{i}/{len(files)}] FAIL-EMPTY {rel}")
            continue

        try:
            export_glb(out_path)
        except Exception as e:
            report.append({"file": rel, "ok": False, "stage": "export",
                           "err": str(e)[:160], **st})
            print(f"[{i}/{len(files)}] FAIL-EXPORT {rel}")
            continue

        size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
        report.append({"file": rel, "ok": True, "glb": out_name,
                       "glb_bytes": size, **st})
        print(f"[{i}/{len(files)}] OK {rel} -> {out_name} "
              f"({st['verts']}v/{st['polys']}p, {size} B)")

    ok = [r for r in report if r.get("ok")]
    summary = {
        "total": len(report),
        "ok": len(ok),
        "failed": len(report) - len(ok),
        "totalVerts": sum(r.get("verts", 0) for r in ok),
        "totalPolys": sum(r.get("polys", 0) for r in ok),
        "animated": len([r for r in ok if r.get("actions")]),
        "glbBytes": sum(r.get("glb_bytes", 0) for r in ok),
    }
    with open(os.path.join(args.out_dir, "_report.json"), "w") as fp:
        json.dump({"summary": summary, "items": report}, fp,
                  ensure_ascii=False, indent=1)
    print("SUMMARY", json.dumps(summary))


if __name__ == "__main__":
    main()
