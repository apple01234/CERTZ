#!/usr/bin/env python3
"""
import_lab_assets.py — Drive 로 받은 Layer Lab / Monsters 팩을 SERTZ 규격으로 변환

[왜 필요한가]
  새 에셋은 Unity 용 150×150 가로 스트립(Idle 600x150 = 4프레임, Run 1200x150 = 8프레임)이다.
  SERTZ 몬스터는 **개별 프레임 64×64 WebP** (`public/assets/<key>_<anim><i>.webp`) 규격이고,
  BootScene 이 그 이름 규칙으로 로드한다. 규격이 다르므로 그대로 넣으면 렌더되지 않는다.

[변환 규칙]
  · 스트립을 프레임 단위로 분할 (프레임 크기 = 이미지 높이, 즉 150)
  · 캐릭터 bbox 기준으로 64×64 캔버스에 맞춰 축소 + 하단 중앙 정렬(발밑 피벗 유지)
  · bbox 가 64px 를 넘으면 정확히 맞추고, 작으면 원본 비율 유지(과확대 금지)
  · WebP(q=92, lossless 아님) + PNG 동시 출력 — 기존 에셋이 둘 다 있어 호환
  · nearest 이웃 리샘플 (픽셀아트 도트 보존)

[화풍 주의]
  이 팩은 SERTZ 기존 x3_* 몬스터보다 도트 밀도가 2배 촘촘하고 톤이 어둡다.
  → 본편(밝은 카툰 톤)에 섞으면 이질적이므로 **DLC/재림 등 고유 테마 구간**에 배정한다.
    (v1.4.35 지시: "DLC·재림은 고유 테마를 유지하라")
"""
import os
import sys
import json
import glob
import shutil
from PIL import Image

SRC = "/root/.hermes/cache/scratch/drive_asset/extracted/Monsters Creatures Fantasy/Sprites"
DST = "/root/workspace/CERTZ/public/assets"
CELL = 64

# 몬스터 → SERTZ 애니메이션 이름 매핑 (파일명 → 게임 접미사)
# SERTZ 관례: idle0..3 / run0..3 / atk0..1 / hit / death
ANIM_MAP = {
    "Idle": "idle",
    "Walk": "run",
    "Run": "run",
    "Flight": "idle",
    "Attack1": "atk",
    "Attack2": "atk2",
    "Take Hit": "hit",
    "Death": "death",
    "Shield": "guard",
}

# 새 몬스터 → SERTZ enemy key (기존 키를 덮지 않고 신규 키로 추가)
MONSTER_KEY = {
    "Flying eye": "ll_flyingeye",
    "Goblin": "ll_goblin",
    "Mushroom": "ll_mushroom",
    "Skeleton": "ll_skeleton",
}


def split_frames(img):
    """가로 스트립 → 프레임 리스트. 프레임은 정사각(높이×높이)."""
    w, h = img.size
    n = max(1, w // h)
    return [img.crop((i * h, 0, (i + 1) * h, h)) for i in range(n)]


def fit_to_cell(frame, cell=CELL):
    """캐릭터 bbox 를 cell 안에 맞춘다. 하단 중앙 정렬(발밑 피벗).

    · bbox 가 크면 축소, 작으면 **확대하지 않고** 그대로 중앙 배치
      (과확대하면 도트가 뭉개져 다른 스프라이트와 밀도가 어긋난다)
    """
    bb = frame.getbbox()
    if not bb:
        return Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    char = frame.crop(bb)
    cw, ch = char.size
    scale = min(1.0, (cell - 2) / max(cw, ch))
    if scale != 1.0:
        nw = max(1, int(round(cw * scale)))
        nh = max(1, int(round(ch * scale)))
        char = char.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    x = (cell - char.size[0]) // 2
    y = cell - char.size[1]  # 하단 정렬
    out.alpha_composite(char, (x, y))
    return out


def main(dry=False):
    report = []
    for name, key in MONSTER_KEY.items():
        d = os.path.join(SRC, name)
        if not os.path.isdir(d):
            print(f"  ! {name} 없음 — 건너뜀")
            continue
        for png in sorted(glob.glob(os.path.join(d, "*.png"))):
            stem = os.path.splitext(os.path.basename(png))[0]
            suffix = ANIM_MAP.get(stem)
            if not suffix:
                print(f"  ? {name}/{stem} 매핑 없음 — 건너뜀")
                continue
            img = Image.open(png).convert("RGBA")
            frames = split_frames(img)
            for i, fr in enumerate(frames):
                cell = fit_to_cell(fr)
                outname = f"{key}_{suffix}{i}"
                webp = os.path.join(DST, outname + ".webp")
                pngout = os.path.join(DST, outname + ".png")
                if not dry:
                    cell.save(webp, "WEBP", quality=92, method=6)
                    cell.save(pngout, "PNG")
                report.append({"key": key, "anim": suffix, "idx": i, "file": outname,
                               "src_frames": len(frames), "size": list(cell.size)})
    return report


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    rep = main(dry=dry)
    # 애니메이션별 프레임 수 요약
    from collections import Counter
    c = Counter((r["key"], r["anim"]) for r in rep)

    # 보행 프레임이 없는 종(비행눈 등)은 idle 을 run 으로 복제 — 로더/애니가 run 을 요구한다
    for key in MONSTER_KEY.values():
        if (key, "run") in c:
            continue
        if (key, "idle") not in c:
            continue
        n = c[(key, "idle")]
        for i in range(4):
            src = os.path.join(DST, f"{key}_idle{i % n}.webp")
            dst = os.path.join(DST, f"{key}_run{i}.webp")
            if not dry and os.path.exists(src):
                shutil.copy2(src, dst)
        c[(key, "run")] = 4
        print(f"  ~ {key}: 보행 프레임 없음 → idle 복제 (run 4)")

    print(f"{'key':14} {'anim':8} frames")
    for (k, a), n in sorted(c.items()):
        print(f"{k:14} {a:8} {n}")
    print(f"\n총 {len(rep)} 프레임" + (" (dry-run)" if dry else " 생성"))
    if not dry:
        with open("/root/workspace/CERTZ/tools/_lab_import_report.json", "w") as f:
            json.dump(rep, f, ensure_ascii=False, indent=1)
