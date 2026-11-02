#!/usr/bin/env python3
"""
vc235 — 외부 보스 팩 6종을 이 게임의 보스 시트 규약으로 변환한다.

[왜 필요한가]
 기존 보스 시트는 프레임 격자에 아트가 꽉 차 있어 **다리·꼬리가 잘렸다**
 (비전 검수 결과: 펜리르 4프레임 전부 하단 절단 + 인접 프레임 잔여물 bleeding).
 원본이 AI 생성이라 격자에 그림이 맞지 않는 것이 원인이라, 격자를 고쳐도
 해결되지 않는다. 그래서 실제로 애니메이션 제작된 팩으로 교체한다.

[규약]
 BOSS_ATLAS 는 `fw`/`fh`/`cols` + `BOSS_ATLAS_ROWS[보스] = 행별 프레임수` 로
 한 장의 시트를 읽는다. 행 순서는 textures.ts 의 plan 과 같다:
     0 idle  1 walk  2 atk  3 sp1  4 sp2  5 sp3  6 die
 6행짜리는 sp3 가 없다(=plan 이 6개).

[설계]
 - 각 팩의 프레임 크기가 제각각(192x128 / 288x160 / 100x100)이라 **그대로 보존**한다.
   (확대하지 않는다 — 화질 손실 없음. 게임은 Boss.ts 에서 320px 높이로 정규화한다)
 - 팩에 없는 애니메이션은 **다른 클립으로 대체**한다. 빈 행을 두면 그 기술을 쓸 때
   보스가 굳어 보이므로, sp3←atk, sp2←sp1, sp1←atk 처럼 가장 가까운 동작을 쓴다.
 - 프레임 수가 행마다 달라도 된다 — BOSS_ATLAS_ROWS 가 행별 개수를 따로 받는다.

[사용]
  python3 tools/pack_bosses.py            # 변환 + 미리보기 생성
  python3 tools/pack_bosses.py --check    # 결과 검증만
"""
from __future__ import annotations

import glob
import json
import os
import sys

from PIL import Image

SRC = "/root/workspace/_assets_in/bosses"
OUT = "/root/workspace/CERTZ/public/assets"
PREVIEW = "/tmp/boss_preview"

# ── 팩 정의 ───────────────────────────────────────────────────────────────────
# clip: {우리행이름: (폴더, 파일접두사정규식)}  — 폴더 안 PNG 를 자연정렬해 쓴다
PACKS = {
    "boss_frost": {
        "title": "프로스트 가디언 (얼음 골렘)",
        "src": f"{SRC}/frost_guardian/Frost_Guardian_FREE_v1.0/PNG files",
        "size": (192, 128),
        "clips": {
            "idle": "idle",
            "walk": "walk",
            "atk": "1_atk",
            "sp1": "take_hit",
            "die": "death",
        },
    },
    "boss_slime": {
        "title": "데몬 슬라임 (화염 악마)",
        "src": f"{SRC}/boss_demon_slime_FREE_v1.0/boss_demon_slime_FREE_v1.0/individual sprites",
        "size": (288, 160),
        "clips": {
            "idle": "01_demon_idle",
            "walk": "02_demon_walk",
            "atk": "03_demon_cleave",
            "sp1": "04_demon_take_hit",
            "die": "05_demon_death",
        },
    },
    "boss_mino": {
        "title": "미노타우르스 (황소 수호자)",
        "src": f"{SRC}/mino_v1.1_free/mino_v1.1_free/animations",
        "size": (288, 160),
        "clips": {
            "idle": "idle",
            "walk": "walk",
            "atk": "atk_1",
        },
    },
    "boss_skeleton": {
        "title": "언데드 집행자 (침몰한 선장)",
        # 이 팩은 한 장짜리 가로 시트(격자)다 — 아래 grid 경로로 잘라 쓴다.
        # cell 100x100, 시트마다 열 수가 다르므로 폭/100 으로 계산한다.
        "grid_dir": f"{SRC}/undead/Undead executioner puppet/png",
        "cell": 100,
        "clips": {
            "idle": "idle",
            "walk": "idle2",
            "atk": "attacking",
            "sp1": "skill1",
            "sp2": "summon",
            "die": "death",
        },
    },
    "boss_dragon": {
        "title": "드래곤 (니드호그·아부디토스·요르문간드)",
        # 725x445 고해상 개별 프레임 1,188장 — 그대로 쓰면 메모리가 터진다.
        # 아래에서 목표 크기로 축소 + 애니별 균등 샘플링한다.
        "frames_dir": f"{SRC}/dragon/Dragon - Fully Animated",
        "target": (256, 157),
        "clips": {
            "idle": ("Idle", 8),
            "walk": ("Walking", 12),
            "atk": ("Attack 1", 12),
            "sp1": ("Attack 2", 12),
            "sp2": ("Hurt", 5),
            "die": ("Death", 16),
        },
    },
    "boss_golem": {
        "title": "스톤 골렘 (바위 수호자)",
        # golem 은 한 장 시트 — 아래에서 행을 잘라 쓴다
        "sheet": f"{SRC}/golem/Mecha-stone Golem 0.1/PNG sheet/Character_sheet.png",
        "size": (100, 100),
        "rows": {"idle": 0, "walk": 1, "atk": 2, "sp1": 4, "sp2": 6, "die": 7},
        # 각 행의 프레임 수(비전/밴드 실측). 마지막 행은 잘려도 되므로 넉넉히 준다.
        "rowFrames": [4, 8, 9, 8, 7, 6, 10, 10, 4],
    },
}

# 팩에 없는 행을 채우는 규칙 — 가까운 동작 재사용
FALLBACK = {
    "sp1": ["sp1", "atk", "idle"],
    "sp2": ["sp2", "sp1", "atk"],
    "sp3": ["sp3", "atk", "sp1"],
    # die 는 필수다. registerBossAnims 가 `${tex}-die` 존재로 조기반환을 판단하고
    # (textures.ts:380), Boss.ts 는 사망 시 `${tex}-die` 를 재생한다.
    # 팩에 death 클립이 없으면(미노타우르스) idle 로 대체한다 — 죽을 때 공격 모션이
    # 나오면 더 어색하고, idle 은 그 자리에 멈춰 사라지는 그림이라 덜 튄다.
    "die": ["die", "idle"],
}

ORDER = ["idle", "walk", "atk", "sp1", "sp2", "sp3", "die"]


def natural_key(p: str):
    """walk_2 < walk_10 이 되도록 숫자 기준 정렬."""
    base = os.path.basename(p).rsplit(".", 1)[0]
    parts = []
    num = ""
    for ch in base:
        if ch.isdigit():
            num += ch
        else:
            if num:
                parts.append((0, int(num)))
                num = ""
            parts.append((1, ch))
    if num:
        parts.append((0, int(num)))
    return parts


def frames_of(folder: str) -> list[str]:
    return sorted(glob.glob(os.path.join(folder, "*.png")), key=natural_key)


def build_from_folder(pack: dict) -> tuple[dict[str, list[Image.Image]], tuple[int, int]]:
    """폴더 구조 팩 — 애니메이션별 프레임 목록을 모은다."""
    clips: dict[str, list[Image.Image]] = {}
    for row, folder in pack["clips"].items():
        files = frames_of(os.path.join(pack["src"], folder))
        if not files:
            print(f"  ! {row}: {folder} 비어 있음")
            continue
        clips[row] = [Image.open(f).convert("RGBA") for f in files]
    return clips, pack["size"]


def build_from_sheet(pack: dict) -> tuple[dict[str, list[Image.Image]], tuple[int, int]]:
    """한 장 시트 팩 — 지정한 행을 잘라 프레임 목록을 만든다."""
    fw, fh = pack["size"]
    sheet = Image.open(pack["sheet"]).convert("RGBA")
    clips: dict[str, list[Image.Image]] = {}
    for row, ry in pack["rows"].items():
        n = pack["rowFrames"][ry] if ry < len(pack["rowFrames"]) else 0
        frames = []
        for c in range(n):
            x0, y0 = c * fw, ry * fh
            if x0 + fw > sheet.width or y0 + fh > sheet.height:
                break
            fr = sheet.crop((x0, y0, x0 + fw, y0 + fh))
            # 빈 프레임(투명)은 버린다 — 애니메이션이 깜빡이는 원인
            if fr.getchannel("A").getbbox() is not None:
                frames.append(fr)
        if frames:
            clips[row] = frames
    return clips, pack["size"]


def build_from_grid(pack: dict) -> tuple[dict[str, list[Image.Image]], tuple[int, int]]:
    """한 장 가로 시트 팩 —cell 격자로 잘라 프레임 목록을 만든다.

    undead 집행자는 `idle.png` 처럼 애니당 한 장짜리 스트립이고,
    프레임 크기는 전부 100x100 이다. 시트 폭/높이가 cell 의 배수라는 보장이
    없으므로(마지막 프레임 뒤 여백 등) 잘라낸 뒤 **투명 프레임은 버린다** —
    이게 없으면 애니메이션이 빈칸에서 깜빡인다.
    """
    cell = pack["cell"]
    clips: dict[str, list[Image.Image]] = {}
    for row, name in pack["clips"].items():
        path = os.path.join(pack["grid_dir"], f"{name}.png")
        if not os.path.exists(path):
            print(f"  ! {row}: {path} 없음")
            continue
        sheet = Image.open(path).convert("RGBA")
        cols, rows = sheet.width // cell, sheet.height // cell
        frames = []
        for ry in range(rows):
            for cx in range(cols):
                box = (cx * cell, ry * cell, (cx + 1) * cell, (ry + 1) * cell)
                fr = sheet.crop(box)
                if fr.getchannel("A").getbbox() is not None:
                    frames.append(fr)
        if frames:
            clips[row] = frames
    return clips, (cell, cell)


def build_from_frames_dir(pack: dict) -> tuple[dict[str, list[Image.Image]], tuple[int, int]]:
    """개별 프레임 폴더 팩 — 애니별 폴더에서 균등 샘플링해 목표 크기로 줄인다.

    드래곤 팩은 애니 하나가 161~301장(725x445)이라 전부 싣으면 메모리가 터진다.
    게임 규약은 행별 프레임 수를 자유롭게 받으므로(`BOSS_ATLAS_ROWS`),
    각 애니에서 **균등 간격으로 n장만** 뽑고 목표 크기로 줄인다.
    """
    tw, th = pack["target"]
    clips: dict[str, list[Image.Image]] = {}
    for row, (folder, want) in pack["clips"].items():
        files = frames_of(os.path.join(pack["frames_dir"], folder))
        if not files:
            print(f"  ! {row}: {folder} 비어 있음")
            continue
        if len(files) > want:
            step = len(files) / want
            files = [files[int(i * step)] for i in range(want)]
        out = []
        for f in files:
            im = Image.open(f).convert("RGBA")
            if im.size != (tw, th):
                im = im.resize((tw, th), Image.LANCZOS)
            out.append(im)
        clips[row] = out
    return clips, (tw, th)


def fill_missing(clips: dict[str, list[Image.Image]]) -> dict[str, list[Image.Image]]:
    """없는 행을 가까운 동작으로 채운다. 최소 idle/atk/die 는 반드시 있어야 한다."""
    out = dict(clips)
    for row in ORDER:
        if out.get(row):
            continue
        for cand in FALLBACK.get(row, []):
            if out.get(cand):
                out[row] = out[cand]
                break
    return out


def compose(clips: dict[str, list[Image.Image]], size: tuple[int, int]) -> tuple[Image.Image, list[int]]:
    """행 순서대로 이어붙여 한 장 시트로 만든다. (시트, 행별 프레임수)"""
    fw, fh = size
    rows = [clips.get(r, []) for r in ORDER]
    # sp3 가 없으면 6행 규약 — 뒤의 빈 행을 잘라낸다
    while rows and not rows[-1]:
        rows.pop()
    if not rows:
        raise ValueError("프레임이 하나도 없음")
    cols = max(len(r) for r in rows)
    sheet = Image.new("RGBA", (fw * cols, fh * len(rows)), (0, 0, 0, 0))
    counts = []
    for ri, frames in enumerate(rows):
        for ci, fr in enumerate(frames):
            if fr.size != size:
                fr = fr.resize(size, Image.NEAREST)
            sheet.paste(fr, (ci * fw, ri * fh), fr)
        counts.append(len(frames))
    return sheet, counts


def main() -> None:
    os.makedirs(PREVIEW, exist_ok=True)
    report = {}

    for name, pack in PACKS.items():
        print(f"\n### {name} — {pack['title']}")
        if "sheet" in pack:
            clips, size = build_from_sheet(pack)
        elif "grid_dir" in pack:
            clips, size = build_from_grid(pack)
        elif "frames_dir" in pack:
            clips, size = build_from_frames_dir(pack)
        else:
            clips, size = build_from_folder(pack)

        got = {k: len(v) for k, v in clips.items()}
        print(f"  원본 클립: {got}")

        filled = fill_missing(clips)
        sheet, counts = compose(filled, size)

        dst = os.path.join(OUT, f"{name}.png")
        sheet.save(dst, "PNG", optimize=True)
        size_mb = os.path.getsize(dst) / 1048576
        print(f"  → {dst}")
        print(f"     {sheet.width}x{sheet.height}  프레임 {size[0]}x{size[1]}  행별 {counts}  {size_mb:.2f}MB")

        # 미리보기 — 각 행 첫 프레임을 한 줄로
        pv = Image.new("RGBA", (size[0] * len(counts), size[1]), (22, 26, 38, 255))
        for i in range(len(counts)):
            fr = sheet.crop((0, i * size[1], size[0], (i + 1) * size[1]))
            pv.paste(fr, (i * size[0], 0), fr)
        pv.save(os.path.join(PREVIEW, f"{name}.png"))

        report[name] = {
            "title": pack["title"],
            "file": f"{name}.png",
            "fw": size[0],
            "fh": size[1],
            "cols": max(counts),
            "rows": counts,
            "bytes": os.path.getsize(dst),
        }

    with open("/tmp/boss_pack_report.json", "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n=== 요약 ===")
    total = 0
    for n, r in report.items():
        total += r["bytes"]
        print(f"  {n:14} {r['fw']}x{r['fh']} cols={r['cols']:2} rows={r['rows']}  {r['bytes']/1048576:.2f}MB")
    print(f"  합계 {total/1048576:.2f}MB")
    print(f"\n미리보기: {PREVIEW}/")
    print("보고서: /tmp/boss_pack_report.json")


if __name__ == "__main__":
    main()
