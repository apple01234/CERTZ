#!/usr/bin/env python3
"""
타일셋 → 게임용 오브젝트 카탈로그 (명시적 좌표 방식)

[왜 자동 검출이 아니라 좌표 지정인가]
  앞서 알파 비율 휴리스틱으로 101개를 뽑았더니 세 가지가 깨졌다:
   · 가늘고 긴 것(울타리·기둥)이 '실 단편'으로 잘려 나옴
   · 시트의 텍스트 라벨("Units Blank")이 오브젝트로 오검출됨
   · 큰 바위가 여러 파편으로 쪼개짐
  원인은 픽셀 통계로는 "한 오브젝트"의 경계를 알 수 없다는 것이다.
  제작자가 시트에 배치한 단위가 곧 오브젝트이므로, 그 단위를 **좌표로 지정**한다.

[좌표 규약]
  (이름, 열, 행, 가로타일, 세로타일) — 좌상단 기준, 16px 타일 단위.
  좌표는 `tile_grid_preview.py` 로 눈으로 확인하고 `--verify` 로 잘림을 재검증한다.

[사용]
  python3 tools/build_object_catalog.py --build
  python3 tools/build_object_catalog.py --verify     # 잘림/빈칸 재검사
"""
from __future__ import annotations

import argparse
import json
import os

from PIL import Image

SRC = "/root/workspace/_assets_in"
OUT = "/root/workspace/CERTZ/public/assets/objects"
SCALE = 4  # 16px → 64px (캐릭터와 동일 해상도)

TILESETS = {
    "dungeon": ("x2/Tileset/Dungeon Tale/Assets/Sprites/Atlas.png", 16),
    "forest": ("x2/Tiny RPG Forest/Artwork/Environment/tileset.png", 16),
    "town": ("x2/Gutty Kreum/Free Japanese City Game Assets/Tilemap/Tilemap.png", 16),
}

# ── 오브젝트 카탈로그 ───────────────────────────────────────────────────
# (이름, 열, 행, 가로, 세로, 태그)  태그는 배치 규칙에서 쓴다:
#   wall  — 벽에 붙는 것 (횃불·배너·책장)
#   floor — 바닥에 놓는 것 (카펫·상자·항아리)
#   big   — 자리를 크게 차지 (왕좌·나무)
#   small — 잡동사니 (작은 상자·꽃)
CATALOG: dict[str, list[tuple]] = {
    "dungeon": [
        # 가구·구조물
        ("throne",      25, 24, 4, 3, "big"),
        ("bookshelf",   10,  8, 2, 2, "wall"),
        ("table",       20, 27, 2, 2, "floor"),
        ("chest",       12,  6, 1, 1, "small"),
        ("chest_gold",  14, 29, 1, 2, "small"),
        ("barrel",      23, 25, 1, 3, "small"),
        ("jar",         21, 28, 1, 2, "small"),
        ("cup",         21, 30, 2, 1, "small"),
        ("anvil",       14,  6, 1, 1, "small"),
        ("well",        26, 29, 2, 2, "floor"),
        # 벽 장식
        ("torch",       18, 28, 1, 1, "wall"),
        ("candle",      19, 28, 1, 1, "small"),
        ("banner_red",  30, 22, 2, 3, "wall"),
        ("banner_short",33, 22, 1, 2, "wall"),
        # 바닥
        ("carpet_v",    24, 13, 3, 9, "floor"),
        ("carpet_h",    27, 14, 4, 4, "floor"),
        # 자연
        ("tree_dead",   20,  7, 4, 3, "big"),
        ("stump",       12, 22, 1, 1, "small"),
        ("rock_small",   9, 16, 1, 1, "small"),
        ("bush",        12,  8, 2, 1, "small"),
        # 장식 데칼
        ("pentagram",   34, 15, 3, 3, "floor"),
        ("vines",       13, 22, 4, 2, "wall"),
        # 묘지
        ("grave",        3,  6, 2, 1, "small"),
        ("fence",        9,  6, 3, 1, "small"),
        ("sign",         7,  6, 1, 1, "small"),
    ],
    "forest": [
        # 좌표 = 16px 타일 단위. 행 점유맵 스캔으로 실측.
        #  상단(행1~3): 암적색 수목 3x3 이 열 2·6·10·14 에 규칙 배치
        #  하단(행24~30): 분홍 수목 3x8 이 열 1·5·9 에 규칙 배치
        #  나무는 캐노피+줄기가 한 덩어리라 넉넉히 잡고 bbox 로 트리밍한다.
        ("tree_dark1",   2,  1, 3, 3, "big"),
        ("tree_dark2",   6,  1, 3, 3, "big"),
        ("tree_dark3",  10,  1, 3, 3, "big"),
        ("tree_dark4",  14,  1, 3, 3, "big"),
        ("tree_hollow",  6,  5, 3, 3, "big"),   # 아치 문 있는 나무
        ("tree_pink1",   1, 24, 3, 7, "big"),
        ("tree_pink2",   5, 24, 3, 7, "big"),
        ("tree_pink3",   9, 24, 2, 7, "big"),
        ("tree_olive",  17, 24, 4, 7, "big"),
        ("bush_green",  22, 24, 4, 4, "small"),
        ("bush_olive",  27, 24, 2, 4, "small"),
        ("rock",        29, 28, 2, 2, "small"),
        ("flower",      13, 18, 2, 2, "small"),
        ("flower2",     16, 20, 2, 2, "small"),
        ("fence",       29, 12, 5, 4, "wall"),
    ],
    "town": [
        # 좌표 = 16px 타일 단위. 자동 점유맵 스캔으로 실측한 구간 기준.
        #  행0~15: 건물·소품 /  행16~31: 지면 /  행32~47: 눈·도로
        ("house_blue",   2,  0, 10, 5, "big"),   # 파란지붕 대형 건물 (열2~11, 행0~4)
        ("house_tower", 10,  0,  2, 3, "big"),   # 부속 타워
        ("shop_black",  24,  2, 14, 4, "big"),   # 검은 기와 상점 (열24~37)
        ("stall_stripe",24,  4,  8, 4, "big"),   # 줄무늬 천막 가판대
        ("stall_blue",  32,  0,  6, 4, "big"),   # 천막 B
        ("vending",     26,  6,  2, 2, "wall"),  # 자판기
        ("vending2",    28,  6,  2, 2, "wall"),
        ("bench",       24,  8,  2, 2, "small"),
        ("crate",       26, 10,  2, 2, "small"),
        ("barrel",      28,  8,  2, 2, "small"),
        ("planter",     34,  6,  2, 2, "small"),
        ("sign",        32,  6,  2, 2, "wall"),
        ("lamp",        36,  6,  2, 2, "wall"),
        ("waterfall",   36, 10,  2, 4, "wall"),  # 폭포 띠
        ("well",        42, 12,  4, 4, "floor"),
    ],
}


def build(name: str) -> dict:
    rel, tile = TILESETS[name]
    src = Image.open(os.path.join(SRC, rel)).convert("RGBA")
    dst = os.path.join(OUT, name)
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        if f.endswith(".png"):
            os.remove(os.path.join(dst, f))

    entries = []
    for obj in CATALOG[name]:
        oname, c, r, w, h, tag = obj
        box = (c * tile, r * tile, (c + w) * tile, (r + h) * tile)
        if box[2] > src.width or box[3] > src.height:
            print(f"  ! {oname}: 좌표가 시트 밖 ({box})")
            continue
        cut = src.crop(box)
        bb = cut.getchannel("A").getbbox()
        if bb is None:
            print(f"  ! {oname}: 빈 칸 (좌표 확인 필요)")
            continue
        # 투명 여백 트리밍 — 배치·충돌 판정이 정확해진다
        cut = cut.crop(bb)
        big = cut.resize((cut.width * SCALE, cut.height * SCALE), Image.NEAREST)
        fname = f"{oname}.png"
        big.save(os.path.join(dst, fname), optimize=True)
        entries.append({
            "name": oname, "file": fname, "tag": tag,
            "src": [c, r, w, h],
            "w": big.width, "h": big.height,
            # 게임에서 타일 단위로 배치할 때 쓰는 값
            "tiles": [round(big.width / (tile * SCALE), 2), round(big.height / (tile * SCALE), 2)],
        })

    with open(os.path.join(dst, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)

    total = sum(os.path.getsize(os.path.join(dst, e["file"])) for e in entries)
    print(f"{name}: {len(entries)}개 → {dst} ({total // 1024}KB)")
    return {"name": name, "count": len(entries), "bytes": total, "entries": entries}


def verify(name: str) -> int:
    """카탈로그 결과가 실제로 유효한지 재검사 — 빈 이미지·극단적 종횡비 탐지."""
    rel, tile = TILESETS[name]
    src = Image.open(os.path.join(SRC, rel)).convert("RGBA")
    bad = 0
    for obj in CATALOG[name]:
        oname, c, r, w, h, tag = obj
        box = (c * tile, r * tile, (c + w) * tile, (r + h) * tile)
        cut = src.crop(box)
        bb = cut.getchannel("A").getbbox()
        if bb is None:
            print(f"  ✗ {oname}: 빈 영역")
            bad += 1
            continue
        trimmed = cut.crop(bb)
        # 오브젝트가 잘렸는지 — bbox 가 크롭 경계에 닿으면 잘린 것
        touches = (
            bb[0] <= 0 or bb[1] <= 0
            or bb[2] >= cut.width or bb[3] >= cut.height
        )
        ratio = trimmed.width / max(trimmed.height, 1)
        note = []
        if touches:
            note.append("경계접촉(잘림 의심)")
        if ratio > 6 or ratio < 0.16:
            note.append(f"종횡비 이상({ratio:.1f})")
        if note:
            print(f"  ⚠ {oname:14} {note}")
            bad += 1
    print(f"{name}: {len(CATALOG[name])}개 중 문제 {bad}개")
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()
    if a.build:
        summary = [build(k) for k in CATALOG]
        total = sum(s["count"] for s in summary)
        size = sum(s["bytes"] for s in summary)
        print(f"\n총 {total}개 오브젝트, {size // 1024}KB")
    elif a.verify:
        bad = sum(verify(k) for k in CATALOG)
        raise SystemExit(1 if bad else 0)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
