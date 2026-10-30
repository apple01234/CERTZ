#!/usr/bin/env python3
"""
fifth_look_sheet.py — 5차 직업별 외형 시트 + 구분 검증 (지시서 #15)

완료 기준: "10직업 5차 외형 스크린샷 시트에서 서로 구분됨
            (색·모양·움직임 중 2가지 이상 다름)"

브라우저 없이 `fifthLooks.ts` 의 데이터를 그대로 읽어
각 직업의 (베리어 텍스처 · 회전 · 맥동 · 지면 종횡비 · tint) 를 조합한
합성 이미지를 만들고, 쌍별 차이를 수치로 낸다.

렌더 규칙(게임과 동일):
  core   = 코어 텍스처 (scale 0.95, alpha 0.42, ADD)
  halo   = 헤일로 텍스처 (scale 0.95, 회전 now/5200)
  ground = 지면 링 (scale 1.25 *)
  barrier= 베리어 (scale barrierScale * pulse, 회전 now*barrierSpin, alpha 0.26)
"""
import os, re, json, itertools, colorsys
from PIL import Image, ImageDraw

ROOT = "/root/workspace/CERTZ"
SRC = f"{ROOT}/src/game/fx/fifthLooks.ts"
ASSETS = f"{ROOT}/public/assets"
OUT = "/root/.hermes/cache/scratch/deploy/fifth_look_sheet.png"

CELL = 240          # 셀 한 칸 크기
PAD = 28
BG = (16, 16, 22)


def load_looks():
    s = open(SRC, encoding="utf-8").read()
    body = s[s.index("export const FIFTH_LOOKS"):]
    looks = {}
    # 각 직업 블록
    for m in re.finditer(r"(\w+):\s*\{(.*?)\n  \},", body, re.S):
        key, blk = m.group(1), m.group(2)
        d = {}
        for f in ("core", "halo", "ground", "barrier"):
            mm = re.search(rf'{f}:\s*"([^"]+)"', blk)
            d[f] = mm.group(1) if mm else None
        for f in ("barrierSpin", "barrierScale", "barrierPulse", "groundAspect"):
            mm = re.search(rf"{f}:\s*([0-9.]+)", blk)
            d[f] = float(mm.group(1)) if mm else 0.0
        mm = re.search(r"tint:\s*(0x[0-9a-fA-F]+)", blk)
        d["tint"] = int(mm.group(1), 16) if mm else 0xFFFFFF
        looks[key] = d
    return looks


def find_asset(name):
    for ext in (".webp", ".png", ".jpg"):
        p = os.path.join(ASSETS, name + ext)
        if os.path.exists(p):
            return p
    return None


def tint_img(im, hexcol):
    """tint — Phaser setTint 과 동일한 곱셈 근사 (RGB 곱)"""
    r = (hexcol >> 16) & 0xFF
    g = (hexcol >> 8) & 0xFF
    b = hexcol & 0xFF
    px = im.split()
    out = []
    for ch, mul in zip(px, (r, g, b)):
        out.append(ch.point(lambda v, m=mul: min(255, int(v * m / 255))))
    return Image.merge("RGB", out)


def render_cell(look, key, t_ms=0):
    canvas = Image.new("RGB", (CELL, CELL), BG)
    cx, cy = CELL // 2, CELL // 2

    def paste(name, scale, alpha, rot=0.0, aspect=1.0):
        nonlocal canvas
        p = find_asset(name) if name else None
        if not p:
            return False
        src = Image.open(p).convert("RGBA")
        w = max(1, int(src.width * scale))
        h = max(1, int(src.height * scale * aspect))
        src = src.resize((w, h), Image.LANCZOS)
        if rot:
            src = src.rotate(rot, expand=True, resample=Image.BICUBIC)
        src = tint_img(src.convert("RGB"), look["tint"]).convert("RGBA")
        a = src.split()[3].point(lambda v: int(v * alpha))
        src.putalpha(a)
        canvas.paste(src, (cx - src.width // 2, int(cy - src.height * 0.55)),
                     src)
        return True

    # 지면 (아래)
    paste(look["ground"], 1.25, 0.22, 0, look["groundAspect"])
    # 코어
    paste(look["core"], 0.95, 0.42)
    # 헤일로
    paste(look["halo"], 0.95, 0.30, rot=t_ms / 5200 * 180 / 3.14159)
    # 베리어 (직업 고유)
    pulse = 1 + look["barrierPulse"] * (1 if t_ms else 0)
    paste(look["barrier"], look["barrierScale"] * pulse, 0.26,
          rot=t_ms * look["barrierSpin"] * 180 / 3.14159)
    return canvas


def hue_of(hexcol):
    r, g, b = (hexcol >> 16) / 255, ((hexcol >> 8) & 0xFF) / 255, (hexcol & 0xFF) / 255
    h, _, _ = colorsys.rgb_to_hls(r, g, b)
    return h * 360


def signature(look, cell):
    """한 직업의 '구분 축' 벡터 — 텍스처 4종 + 회전 + 맥동 + 종횡비 + 색"""
    px = cell.resize((48, 48), Image.LANCZOS)
    return {
        "tex_core": look["core"], "tex_halo": look["halo"],
        "tex_ground": look["ground"], "tex_barrier": look["barrier"],
        "spin": look["barrierSpin"], "pulse": look["barrierPulse"],
        "aspect": look["groundAspect"], "tint": look["tint"],
        "hue": hue_of(look["tint"]),
        "px": list(px.getdata()),
    }


def axes_diff(a, b):
    """몇 개 축에서 다른지 센다 (지시서: 2가지 이상이면 통과)"""
    d = {
        "베리어모양": a["tex_barrier"] != b["tex_barrier"],
        "코어모양": a["tex_core"] != b["tex_core"],
        "헤일로모양": a["tex_halo"] != b["tex_halo"],
        "지면모양": a["tex_ground"] != b["tex_ground"],
        "회전": abs(a["spin"] - b["spin"]) > 1e-4,
        "맥동": abs(a["pulse"] - b["pulse"]) > 1e-3,
        "종횡비": abs(a["aspect"] - b["aspect"]) > 1e-3,
        "색상": abs(a["hue"] - b["hue"]) > 8,
    }
    return sum(d.values()), d


def main():
    looks = load_looks()
    keys = list(looks.keys())
    print(f"직업 {len(keys)}개: {', '.join(keys)}")

    cols = 5
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * CELL + PAD * 2, rows * (CELL + 26) + PAD * 2), (8, 8, 12))
    draw = ImageDraw.Draw(sheet)

    sigs = {}
    for i, k in enumerate(keys):
        c = render_cell(looks[k], k, t_ms=1370)
        sigs[k] = signature(looks[k], c)
        x = PAD + (i % cols) * CELL
        y = PAD + (i // cols) * (CELL + 26)
        sheet.paste(c, (x, y))
        draw.text((x + 6, y + CELL + 3),
                  f"{k}", fill=(240, 235, 210))
        draw.text((x + 6, y + CELL + 13),
                  f"spin{looks[k]['barrierSpin']:.5f} pl{looks[k]['barrierPulse']:.2f}",
                  fill=(150, 150, 160))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)

    # 쌍별 구분 검증
    fails = []
    minaxes = 99
    stats = []
    for a, b in itertools.combinations(keys, 2):
        n, d = axes_diff(sigs[a], sigs[b])
        minaxes = min(minaxes, n)
        if n < 2:
            fails.append((a, b, n, d))
        stats.append(n)

    print(f"\n쌍 조합 {len(stats)}개 / 최소 구분축 {minaxes}개 / 평균 {sum(stats)/len(stats):.1f}개")
    if fails:
        print(f"❌ 구분 실패 {len(fails)}쌍 (2축 미만):")
        for f in fails[:10]:
            print("   ", f[0], "vs", f[1], "->", f[2], "축")
    else:
        print("✅ PASS — 모든 쌍이 2축 이상 다름")

    # 같은 계통 쌍은 특히 확인
    INNER = {
        "전사": ["warbringer", "crusader"],
        "궁수": ["deadeye", "skylord"],
        "마법사": ["arclord", "eternal"],
        "도적": ["shadowlord", "blademaster"],
        "해적": ["seaking", "dreadnought"],
    }
    print("\n같은 계통 쌍 (가장 구분이 어려운 조합):")
    for fam, (a, b) in INNER.items():
        if a in sigs and b in sigs:
            n, d = axes_diff(sigs[a], sigs[b])
            mark = "OK" if n >= 2 else "★부족"
            print(f"  {fam:5s} {a:12s} vs {b:12s} → {n}축 {mark}")

    json.dump({k: {kk: vv for kk, vv in v.items() if kk != "px"} for k, v in sigs.items()},
              open("/root/.hermes/cache/scratch/deploy/fifth_look_sig.json", "w"),
              ensure_ascii=False, indent=1)
    print(f"\n시트: {OUT}")


if __name__ == "__main__":
    main()
