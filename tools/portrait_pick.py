#!/usr/bin/env python3
"""
portrait_pick.py — 예비 초상화(dxp_*)를 새 화자에 배정하는 도우미

[언제 쓰나]
  새 NPC/보스 대사를 추가했는데 초상화가 없어 이름만 표시될 때.
  `_map.json` 에 별칭 키를 추가하면 DialogueBox 가 자동으로 찾는다
  (portraitOf → portraitCrops[speaker].src 가 /npcportrait/ 이면 사용).

[사용]
  # 예비 목록 보기
  python3 tools/portrait_pick.py --list

  # 특정 초상화를 화자에 배정
  python3 tools/portrait_pick.py --assign "새 NPC 이름" --portrait dxp_00tl

  # 예비 중 품질 상위 N개 미리보기(썸네일 시트 생성)
  python3 tools/portrait_pick.py --preview 12 --out /tmp/preview.png

[주의]
  이미 배정된 초상화를 다른 화자에 재사용해도 파일은 공유되므로 용량은 늘지 않는다.
  다만 같은 얼굴이 두 NPC 에 붙으므로 의도한 경우에만 쓸 것.
"""
import argparse
import glob
import json
import os

MAP = "public/assets/npcportrait/_map.json"
PORTRAIT_DIR = "public/assets/npcportrait"


def load():
    with open(MAP) as f:
        return json.load(f)


def save(mp):
    with open(MAP, "w") as f:
        json.dump(mp, f, ensure_ascii=False, indent=1)


def free_pool(mp):
    dxp = [k for k in mp if k.startswith("dxp_")]
    used = {v["aliasOf"] for v in mp.values() if v.get("aliasOf")}
    return sorted(set(dxp) - used)


def cmd_list(mp):
    pool = free_pool(mp)
    print(f"예비 초상화 {len(pool)}개 / 전체 dxp {sum(1 for k in mp if k.startswith('dxp_'))}")
    for k in pool:
        print(" ", k)


def cmd_assign(mp, speaker, portrait):
    if portrait not in mp:
        raise SystemExit(f"{portrait} 가 _map.json 에 없습니다")
    if speaker in mp:
        cur = mp[speaker].get("aliasOf") or mp[speaker].get("src")
        print(f"! '{speaker}' 는 이미 매핑됨 ({cur}) — 덮어씁니다")
    src = mp[portrait]
    mp[speaker] = {
        "src": src["src"],
        "source": "drive-2026-11-09 PixAI portraits (alias)",
        "crop": [0, 0, 84, 84],
        "sha256": src["sha256"],
        "aliasOf": portrait,
    }
    save(mp)
    print(f"✓ '{speaker}' → {portrait} ({src['src']})")


def cmd_preview(mp, n, out):
    from PIL import Image

    pool = free_pool(mp)
    # 품질 점수: 채움률 × 인물 높이
    scored = []
    for k in pool:
        p = os.path.join(PORTRAIT_DIR, k + ".png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        bb = im.getbbox()
        if not bb:
            continue
        h = bb[3] - bb[1]
        a = im.split()[3]
        data = list(a.get_flattened_data()) if hasattr(a, "get_flattened_data") else list(a.getdata())
        fill = sum(1 for v in data if v > 8) / len(data)
        scored.append((fill * (h / 84.0), k))
    scored.sort(reverse=True)
    pick = [k for _, k in scored[:n]]

    cell = 96
    cols = min(6, max(1, len(pick)))
    rows = (len(pick) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell * cols, cell * rows), (38, 38, 46, 255))
    for i, k in enumerate(pick):
        im = Image.open(os.path.join(PORTRAIT_DIR, k + ".png")).convert("RGBA")
        sheet.alpha_composite(im, ((i % cols) * cell + 6, (i // cols) * cell + 6))
    sheet.convert("RGB").save(out)
    print(f"미리보기 {len(pick)}개 → {out}")
    for k in pick:
        print(" ", k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--assign", metavar="SPEAKER")
    ap.add_argument("--portrait", metavar="DXP_KEY")
    ap.add_argument("--preview", type=int, metavar="N")
    ap.add_argument("--out", default="/tmp/portrait_preview.png")
    a = ap.parse_args()

    mp = load()
    if a.list:
        cmd_list(mp)
    elif a.assign:
        if not a.portrait:
            raise SystemExit("--portrait 도 지정하세요")
        cmd_assign(mp, a.assign, a.portrait)
    elif a.preview is not None:
        cmd_preview(mp, a.preview, a.out)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
