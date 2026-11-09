#!/usr/bin/env python3
"""
import_drive_20261109.py — 2026-11-09 Drive 에셋 배급분을 SERTZ 규격으로 변환

[배경]
  유저가 Drive 로 212MB / 9,048파일 에셋 팩 묶음을 배급했다.
  SERTZ 몬스터 규격은 **개별 프레임 64×64 WebP+PNG** (`public/assets/<key>_<anim><i>.webp`)
  이고 BootScene 이 그 이름 규칙으로 로드한다(tools/import_lab_assets.py 와 동일 규칙).
  원본은 Unity/에셋스토어용 가로 스트립이므로 그대로 넣으면 렌더되지 않는다.

[변환 규칙 — 기존 import_lab_assets.py 준수]
  · 스트립 프레임 크기 = 이미지 **높이** (정사각 프레임 가정)
  · bbox 기준 64×64 캔버스, 하단 중앙 정렬(발밑 피벗)
  · bbox 가 64px 넘으면 축소, 작으면 **확대 금지**(도트 밀도 보존)
  · NEAREST 리샘플, WebP q=92 + PNG 동시 출력

[신규 키 접두사]
  dx_  (drive 2026-11-09 배급) — 기존 ll_/x3_ 키와 충돌하지 않는다.
"""
import os
import sys
import json
import glob
import shutil
from collections import Counter
from PIL import Image

PACK = "/root/workspace/assets_drop/pack/Assets"
DST = "/root/workspace/CERTZ/public/assets"
CELL = 64

# ── 몬스터 팩: (팩 경로, {원본 파일 stem: 게임 anim 접미사})
# Monster_Pack_Free 는 Idle/Move/Attack 3종만 제공한다.
MONSTER_PACKS = [
    ("Monster_Pack_Free/Monster Pack (Free)/Spritesheets/Updated Rabbit",
     {"Rabbit_Brown_Idle": "idle", "Rabbit_Brown_Move": "run"}),
    ("Monster_Pack_Free/Monster Pack (Free)/Spritesheets/Updated Rabbit Horned",
     {"Rabbit_Horned_Idle": "idle", "Rabbit_Horned_Move": "run",
      "Rabbit_Horned_Attack": "atk"}),
]

# 원본 폴더 → 신규 SERTZ key
PACK_KEY = {
    "Updated Rabbit": "dx_hornbunny",       # 뿔없는 갈색 토끼
    "Updated Rabbit Horned": "dx_hornrabbit",  # 뿔 토끼(공격 보유)
}

# 원본 시트는 **4방향 × N프레임 그리드**다 (4-Direction 팩).
#   행 = 방향 (0=아래, 1=왼쪽, 2=오른쪽, 3=위), 열 = 애니메이션 프레임
#   셀 크기 = 시트높이/4 (예: 512/4 = 128)
# SERTZ 몬스터는 **측면 1방향 + flipX** 만 쓰므로 행 1(왼쪽)만 추출한다.
SIDE_ROW = 1
DIR_ROWS = 4

# 원본 시트별 실제 프레임 수(열 개수). 투명 열 간격 실측값.
FRAME_COUNT = {
    "Rabbit_Horned_Attack": 6,
    "Rabbit_Horned_Idle": 4,
    "Rabbit_Horned_Move": 6,
    "Rabbit_Brown_Idle": 4,
    "Rabbit_Brown_Move": 6,
}


def split_frames(img, n):
    """4방향 그리드 시트 → 측면(SIDE_ROW) n프레임 리스트.

    정사각 프레임이 아니라 **그리드**이므로 w//h 로 추정하면 1프레임으로 오판한다.
    셀 크기는 시트 높이를 4로 나눈 값이고, 가로는 프레임 수로 나눈다.
    """
    w, h = img.size
    cell_h = h // DIR_ROWS
    cell_w = w // n
    y = SIDE_ROW * cell_h
    return [img.crop((i * cell_w, y, (i + 1) * cell_w, y + cell_h))
            for i in range(n)]


def fit_to_cell(frame, cell=CELL, upscale=False):
    """캐릭터 bbox 를 cell 안에 맞춘다. 하단 중앙 정렬(발밑 피벗).

    · bbox 가 크면 축소, 작으면 **확대하지 않고** 그대로 중앙 배치
      (과확대하면 도트가 뭉개져 다른 스프라이트와 밀도가 어긋난다)
    · upscale=True 면 정수배 확대로 cell 을 채운다 — 원본이 20px 급으로
      작은 팩(4-Direction 시리즈)은 그대로 두면 1/3 크기로 렌더된다.
      NEAREST + 정수배라 도트가 보존된다.
    """
    bb = frame.getbbox()
    if not bb:
        return Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    char = frame.crop(bb)
    cw, ch = char.size
    if upscale:
        # 정수배(최소 1) 로 cell-2 안에 들어가는 최대 배율
        k = max(1, min((cell - 2) // max(cw, 1), (cell - 2) // max(ch, 1)))
        scale = k
    else:
        scale = min(1.0, (cell - 2) / max(cw, ch))
    if scale != 1.0:
        nw = max(1, int(round(cw * scale)))
        nh = max(1, int(round(ch * scale)))
        char = char.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    x = (cell - char.size[0]) // 2
    y = cell - char.size[1]
    out.alpha_composite(char, (x, y))
    return out


def import_monsters(dry=False):
    report = []
    for rel, anims in MONSTER_PACKS:
        src = os.path.join(PACK, rel)
        folder = os.path.basename(rel)
        key = PACK_KEY.get(folder)
        if not key:
            print(f"  ? {folder}: PACK_KEY 미정의 — 건너뜀")
            continue
        if not os.path.isdir(src):
            print(f"  ! {src} 없음 — 건너뜀")
            continue
        for png in sorted(glob.glob(os.path.join(src, "*.png"))):
            stem = os.path.splitext(os.path.basename(png))[0]
            suffix = anims.get(stem)
            if not suffix:
                print(f"  ? {folder}/{stem}: 매핑 없음 — 건너뜀")
                continue
            img = Image.open(png).convert("RGBA")
            n = FRAME_COUNT.get(stem)
            if not n:
                print(f"  ? {folder}/{stem}: FRAME_COUNT 미정의 — 건너뜀")
                continue
            frames = split_frames(img, n)
            for i, fr in enumerate(frames):
                cell = fit_to_cell(fr, upscale=True)
                out = f"{key}_{suffix}{i}"
                if not dry:
                    cell.save(os.path.join(DST, out + ".webp"), "WEBP", quality=92, method=6)
                    cell.save(os.path.join(DST, out + ".png"), "PNG")
                report.append({"key": key, "anim": suffix, "idx": i,
                               "file": out, "src_frames": len(frames)})
    return report


# ── FX 팩: CERTZ fx json 스키마로 변환
# CERTZ 스키마: {frames:[{filename,frame{x,y,w,h},duration}], meta:{...,pixelfx:{...}}}
FX_PACKS = [
    # (원본 시트 경로, 신규 fx id, fps, loop)
    ("FX Pack 1/FX Pack 1/spritesheets/Storm [size128] [frames24].png", "storm", 24, True),
    ("FX Pack 1/FX Pack 1/spritesheets/Shockwave [size128] [frames24].png", "shockwave-big", 26, False),
    ("FX Pack 1/FX Pack 1/spritesheets/Plasma [size128] [frames24].png", "plasma", 22, True),
    ("FX Pack 1/FX Pack 1/spritesheets/EnergyCrack [size128] [frames24].png", "energy-crack", 24, True),
    ("FX Pack 1/FX Pack 1/spritesheets/Pentagram_Vicron [size128] [frames24].png", "pentagram", 20, True),
    ("FX Pack 1/FX Pack 1/spritesheets/Implosion [size128] [frames24].png", "implosion-drive", 26, False),
    ("FX Pack 1/FX Pack 1/spritesheets/OrbitRings_AcidTech [size128] [frames24].png", "orbit-rings", 22, True),
    ("FX Pack 1/FX Pack 1/spritesheets/Sparks_DeepSeaGlow [size128] [frames24].png", "sparks-glow", 24, False),
]


def import_fx(dry=False):
    """가로 스트립을 CERTZ pixelfx JSON + PNG 로 변환."""
    outdir = os.path.join(DST, "fx")
    report = []
    for rel, fid, fps, loop in FX_PACKS:
        src = os.path.join(PACK, rel)
        if not os.path.exists(src):
            print(f"  ! {rel} 없음 — 건너뜀")
            continue
        # 기존 시트를 덮어쓰지 않는다. implosion 처럼 이름이 겹치면 원본이 유실된다.
        dst_json = os.path.join(outdir, f"{fid}.json")
        if os.path.exists(dst_json):
            try:
                cur = json.load(open(dst_json))["meta"]["pixelfx"]["id"]
            except Exception:
                cur = "?"
            if not str(cur).startswith("drive2026/"):
                print(f"  ! {fid}: 기존 시트(id={cur})와 충돌 — 건너뜀 (이름 변경 필요)")
                continue
        im = Image.open(src).convert("RGBA")
        w, h = im.size
        n = max(1, w // h)          # 정사각 프레임
        fw = fh = h
        cols = n
        frames = []
        for i in range(n):
            frames.append({
                "filename": f"{fid} {i}",
                "frame": {"x": i * fw, "y": 0, "w": fw, "h": fh},
                "rotated": False, "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
                "sourceSize": {"w": fw, "h": fh},
                "duration": int(round(1000 / fps)),
            })
        doc = {
            "frames": frames,
            "meta": {
                "app": "https://github.com/patch-gg/pixelfx",
                "version": "1",
                "image": f"{fid}.png",
                "format": "RGBA8888",
                "size": {"w": w, "h": h},
                "scale": "1",
                "frameTags": [{"name": fid, "from": 0, "to": n - 1,
                               "direction": "forward"}],
                "pixelfx": {
                    "id": f"drive2026/{fid}",
                    "name": fid,
                    "fps": fps,
                    "loop": loop,
                    "frames": n,
                    "frameSize": [fw, fh],
                    "pivot": [fw // 2, fh // 2],
                    "columns": cols,
                },
            },
        }
        if not dry:
            im.save(os.path.join(outdir, f"{fid}.png"))
            with open(os.path.join(outdir, f"{fid}.json"), "w") as f:
                json.dump(doc, f, indent=1)
        report.append({"fx": fid, "frames": n, "frameSize": [fw, fh],
                       "sheet": [w, h], "fps": fps, "loop": loop})
    return report


def fill_missing_run(keys, report, dry=False):
    """보행 프레임이 없는 종은 idle 을 run 으로 복제 — 로더/애니가 run 을 요구한다."""
    c = Counter((r["key"], r["anim"]) for r in report)
    for key in keys:
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
            dst_p = os.path.join(DST, f"{key}_run{i}.png")
            src_p = os.path.join(DST, f"{key}_idle{i % n}.png")
            if not dry and os.path.exists(src_p):
                shutil.copy2(src_p, dst_p)
        c[(key, "run")] = 4
        print(f"  ~ {key}: 보행 프레임 없음 → idle 복제 (run 4)")


def main(dry=False):
    print("=== 몬스터 ===")
    mrep = import_monsters(dry)
    fill_missing_run(set(PACK_KEY.values()), mrep, dry)
    c = Counter((r["key"], r["anim"]) for r in mrep)
    for (k, a), n in sorted(c.items()):
        print(f"  {k:16} {a:6} {n}")
    print(f"  총 {len(mrep)} 프레임" + (" (dry)" if dry else " 생성"))

    print("\n=== FX ===")
    frep = import_fx(dry)
    for r in frep:
        print(f"  {r['fx']:16} {r['frames']:3}f {r['frameSize'][0]}x{r['frameSize'][1]} @{r['fps']}fps loop={r['loop']}")
    print(f"  총 {len(frep)} FX" + (" (dry)" if dry else " 생성"))

    if not dry:
        with open("/root/workspace/CERTZ/tools/_drive20261109_report.json", "w") as f:
            json.dump({"monsters": mrep, "fx": frep}, f, ensure_ascii=False, indent=1)
    return mrep, frep


if __name__ == "__main__":
    main(dry="--dry" in sys.argv)
