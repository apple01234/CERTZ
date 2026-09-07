#!/usr/bin/env python3
"""SPUM 프리팹 파서/조합기 — Unity YAML 프리팹을 PIL 레이어 합성으로 완성 캐릭터 PNG 변환
- GUID→텍스처 매핑 (SPUM/Resources/**/*.meta)
- 스프라이트 시트 rect (spriteSheet.sprites internalID)
- Transform 계층 누적 이동/스케일/회전 + SpriteRenderer z-order
- PPU=32 (meta spritePixelsToUnits), Y축 반전(Unity up → canvas down)
"""
import os, re, sys, glob, math, json
from PIL import Image

ROOT = "/home/z/my-project/asset_work/spum"
OUT = "/home/z/my-project/asset_work/spum_out"
PPU = 32.0

# ---------- 1) 메타 파싱: guid → {texPath, sprites{internalID: rect}} ----------
def parse_meta_sprites(meta_path):
    """meta 파일에서 guid + spriteSheet.sprites rect 목록 추출"""
    try:
        with open(meta_path, "r", encoding="utf-8", errors="ignore") as f:
            txt = f.read()
    except Exception:
        return None
    m = re.search(r"^guid:\s*([0-9a-f]{32})", txt, re.M)
    if not m:
        return None
    guid = m.group(1)
    tex = meta_path[:-5]  # .meta 제거 → 실제 경로
    sprites = {}
    # spriteSheet: 섹션의 sprites 목록만 추출 (spriteSheet: 이후 indent 유지 블록)
    sm = re.search(r"\n  spriteSheet:\n(.*?)(?=\n  \w|\Z)", txt, re.S)
    block = sm.group(1) if sm else ""
    for sm2 in re.finditer(
        r"- serializedVersion: 2\n      name: (\S[^\n]*?)\n      rect:\n        serializedVersion: 2\n        x: (-?[\d.]+)\n        y: (-?[\d.]+)\n        width: (-?[\d.]+)\n        height: (-?[\d.]+)\n(?:.*?)(?:      spriteID: \S+\n)?      internalID: (-?\d+)",
        block, re.S):
        name, x, y, w, h, iid = sm2.group(1), float(sm2.group(2)), float(sm2.group(3)), float(sm2.group(4)), float(sm2.group(5)), sm2.group(6)
        sprites[iid] = {"name": name, "rect": (x, y, w, h)}
    return guid, tex, sprites

def build_db():
    texdb = {}   # guid -> {path, sprites{iid: rect}}
    metas = glob.glob(os.path.join(ROOT, "**", "*.png.meta"), recursive=True)
    for mp in metas:
        r = parse_meta_sprites(mp)
        if not r:
            continue
        guid, tex, sprites = r
        if not os.path.exists(tex):
            continue
        texdb[guid] = {"path": tex, "sprites": sprites}
    return texdb

# ---------- 2) 프리팹 파싱 ----------
DOC_RE = re.compile(r"--- !u!(\d+) &(\d+)(?: !(\d+))?&?(\d+)?")

def parse_prefab(path):
    """Unity YAML 프리팹 → 문서 목록 [(classid, fileid, dict)]"""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        txt = f.read()
    docs = []
    for chunk in re.split(r"^--- !u!", txt, flags=re.M):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(r"(\d+) &(\d+)", chunk)
        if not m:
            continue
        cls, fid = int(m.group(1)), m.group(2)
        body = chunk[m.end():]
        docs.append((cls, fid, body))
    return docs

def get_component_docs(docs):
    gos, transforms, srs = {}, {}, {}
    for cls, fid, body in docs:
        if cls == 1:   # GameObject
            name = re.search(r"  m_Name: (.*)", body)
            comps = re.findall(r"component:\s*\{fileID:\s*(\d+)\}", body)
            gos[fid] = {"name": (name.group(1).strip() if name else "?"), "comps": comps}
        elif cls == 4: # Transform
            go = re.search(r"m_GameObject:\s*\{fileID:\s*(\d+)\}", body)
            pos = re.search(r"m_LocalPosition:\s*\{x:\s*(-?[\d.eE+]+),\s*y:\s*(-?[\d.eE+]+),\s*z:\s*(-?[\d.eE+]+)\}", body)
            scl = re.search(r"m_LocalScale:\s*\{x:\s*(-?[\d.eE+]+),\s*y:\s*(-?[\d.eE+]+),\s*z:\s*(-?[\d.eE+]+)\}", body)
            rot = re.search(r"m_LocalRotation:\s*\{x:\s*(-?[\d.eE+]+),\s*y:\s*(-?[\d.eE+]+),\s*z:\s*(-?[\d.eE+]+),\s*w:\s*(-?[\d.eE+]+)\}", body)
            father = re.search(r"m_Father:\s*\{fileID:\s*(\d+)\}", body)
            kids = re.search(r"m_Children:\s*\n((?:  - \{fileID: \d+\}\n?)*)", body)
            children = re.findall(r"\{fileID:\s*(\d+)\}", kids.group(1)) if kids else []
            g = go.group(1) if go else None
            transforms[fid] = {
                "go": g,
                "pos": (float(pos.group(1)), float(pos.group(2))) if pos else (0, 0),
                "scale": (float(scl.group(1)), float(scl.group(2))) if scl else (1, 1),
                "rot": (float(rot.group(1)), float(rot.group(2)), float(rot.group(3)), float(rot.group(4))) if rot else (0, 0, 0, 1),
                "father": father.group(1) if father and father.group(1) != "0" else None,
                "children": children,
            }
        elif cls == 212: # SpriteRenderer
            go = re.search(r"m_GameObject:\s*\{fileID:\s*(\d+)\}", body)
            spr = re.search(r"m_Sprite:\s*\{fileID:\s*(-?\d+),\s*guid:\s*([0-9a-f]{32})", body)
            col = re.search(r"m_Color:\s*\{r:\s*(-?[\d.]+),\s*g:\s*(-?[\d.]+),\s*b:\s*(-?[\d.]+),\s*a:\s*(-?[\d.]+)\}", body)
            flipx = re.search(r"m_FlipX:\s*(\d)", body)
            if spr:
                g = go.group(1) if go else None
                srs[fid] = {
                    "go": g,
                    "iid": spr.group(1),
                    "guid": spr.group(2),
                    "color": tuple(float(col.group(i)) for i in (1, 2, 3, 4)) if col else (1, 1, 1, 1),
                    "flipx": flipx and flipx.group(1) == "1",
                }
    return gos, transforms, srs

_size_cache = {}
def tex_size(texdb, guid):
    if guid not in _size_cache:
        im = Image.open(texdb[guid]["path"])
        _size_cache[guid] = im.size
    return _size_cache[guid]

def quat_to_deg(q):
    x, y, z, w = q
    # z 오일러 각도만 사용 (2D)
    sinp = 2 * (w * z + x * y)
    cosp = 1 - 2 * (y * y + z * z)
    return math.degrees(math.atan2(sinp, cosp))

def compose(prefab_path, texdb, out_png, upscale=3, verbose=False):
    docs = parse_prefab(prefab_path)
    gos, transforms, srs = get_component_docs(docs)
    if not transforms:
        print("  ! transform 없음:", prefab_path)
        return False
    # go → transform / go → sr 매핑
    go_tf = {v["go"]: k for k, v in transforms.items()}
    go_sr = {}
    for k, v in srs.items():
        go_sr.setdefault(v["go"], k)
    # 루트 찾기
    roots = [k for k, v in transforms.items() if not v["father"] or v["father"] not in transforms]
    if not roots:
        print("  ! root 없음")
        return False

    items = []  # (zorder, cx, cy, angle, img_crop, color, flipx)
    zc = [0]

    def walk(tfid, px, py, psx, psy, pang):
        tf = transforms[tfid]
        x = px + tf["pos"][0] * psx * PPU
        y = py - tf["pos"][1] * psy * PPU  # canvas y 반전
        sx = psx * tf["scale"][0]
        sy = psy * tf["scale"][1]
        ang = pang + quat_to_deg(tf["rot"]) * (1 if psx >= 0 else -1)
        go = tf["go"]
        if go in go_sr:
            sr = srs[go_sr[go]]
            if sr["guid"] in texdb and sr["iid"] in texdb[sr["guid"]]["sprites"]:
                sp = texdb[sr["guid"]]["sprites"][sr["iid"]]
                zc[0] += 1
                items.append((zc[0], x, y, ang, sp, sr["color"], sr["flipx"], sx, sy))
        for ch in tf["children"]:
            if ch in transforms:
                walk(ch, x, y, sx, sy, ang)

    for r in roots:
        walk(r, 0, 0, 1, 1, 0)

    if not items:
        print("  ! 렌더러 0개")
        return False

    # 배치 전 범위 계산
    placed = []
    for z, x, y, ang, sp, col, flipx, sx, sy in items:
        guid_tex = None
        for g, t in texdb.items():
            pass
        placed.append((z, x, y, ang, sp, col, flipx, sx, sy))

    # 이미지 로드 캐시
    img_cache = {}
    def get_tex(guid):
        if guid not in img_cache:
            img_cache[guid] = Image.open(texdb[guid]["path"]).convert("RGBA")
        return img_cache[guid]

    # bounds 계산
    minx = miny = 10**9
    maxx = maxy = -10**9
    for z, x, y, ang, sp, col, flipx, sx, sy in items:
        gx, gy, gw, gh = sp["rect"]
        hw, hh = gw * sx / 2, gh * sy / 2
        minx, miny = min(minx, x - hw), min(miny, y - hh)
        maxx, maxy = max(maxx, x + hw), max(maxy, y + hh)
    W = int(math.ceil(maxx - minx)) + 4
    H = int(math.ceil(maxy - miny)) + 4
    canvas = Image.new("RGBA", (max(W, 8), max(H, 8)), (0, 0, 0, 0))

    for z, x, y, ang, sp, col, flipx, sx, sy in items:  # z 오름차순 = 뒤→앞
        guid = None
        # sp에 guid 없음 → items에 guid 보관 필요 (아래에서 재순회)
    # ⚠ items에 guid 저장 안 함 — 재구성
    return items, canvas, (minx, miny), get_tex

def compose2(prefab_path, texdb, out_png, upscale=3, verbose=False):
    docs = parse_prefab(prefab_path)
    gos, transforms, srs = get_component_docs(docs)
    if not transforms:
        return False
    go_sr = {}
    for k, v in srs.items():
        go_sr.setdefault(v["go"], k)
    roots = [k for k, v in transforms.items() if not v["father"] or v["father"] not in transforms]
    items = []
    zc = [0]

    def walk(tfid, px, py, psx, psy, pang):
        tf = transforms[tfid]
        x = px + tf["pos"][0] * psx * PPU
        y = py - tf["pos"][1] * psy * PPU
        sx = psx * tf["scale"][0]
        sy = psy * tf["scale"][1]
        ang = pang + quat_to_deg(tf["rot"]) * (1 if psx >= 0 else -1)
        go = tf["go"]
        gname = gos.get(go, {}).get("name", "")
        if go in go_sr and "shadow" not in gname.lower():
            sr = srs[go_sr[go]]
            if sr["guid"] in texdb:
                sps = texdb[sr["guid"]]["sprites"]
                if sr["iid"] in sps:
                    sp = sps[sr["iid"]]
                else:
                    # 단일 스프라이트(21300000) — 텍스처 전체 사용
                    w0, h0 = tex_size(texdb, sr["guid"])
                    sp = {"name": "_full", "rect": (0, 0, w0, h0)}
                zc[0] += 1
                items.append((zc[0], x, y, ang, sp, sr["color"], sr["flipx"], sx, sy, sr["guid"]))
        for ch in tf["children"]:
            if ch in transforms:
                walk(ch, x, y, sx, sy, ang)

    for r in roots:
        walk(r, 0, 0, 1, 1, 0)
    if not items:
        return False

    img_cache = {}
    def get_tex(guid):
        if guid not in img_cache:
            img_cache[guid] = Image.open(texdb[guid]["path"]).convert("RGBA")
        return img_cache[guid]

    minx = miny = 10**9
    maxx = maxy = -10**9
    for z, x, y, ang, sp, col, flipx, sx, sy, guid in items:
        gx, gy, gw, gh = sp["rect"]
        hw, hh = gw * sx / 2, gh * sy / 2
        minx, miny = min(minx, x - hw), min(miny, y - hh)
        maxx, maxy = max(maxx, x + hw), max(maxy, y + hh)
    W = int(math.ceil(maxx - minx)) + 4
    H = int(math.ceil(maxy - miny)) + 4
    canvas = Image.new("RGBA", (max(W, 8), max(H, 8)), (0, 0, 0, 0))

    for z, x, y, ang, sp, col, flipx, sx, sy, guid in items:
        gx, gy, gw, gh = sp["rect"]
        gx, gy, gw, gh = int(gx), int(gy), int(gw), int(gh)
        crop = get_tex(guid).crop((gx, gy, gx + gw, gy + gh))
        tw, th = max(1, int(round(gw * sx))), max(1, int(round(gh * sy)))
        if (tw, th) != crop.size:
            crop = crop.resize((tw, th), Image.NEAREST)
        if flipx:
            crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
        if abs(ang) > 0.5:
            crop = crop.rotate(ang, expand=True, resample=Image.NEAREST)
        r, g, b, a = col
        if (r, g, b, a) != (1, 1, 1, 1):
            if a < 1:
                al = crop.getchannel("A").point(lambda v: int(v * a))
                crop.putalpha(al)
            if (r, g, b) != (1, 1, 1):
                # 틴트 = 픽셀별 곱셈 (내부 음영 보존)
                from PIL import ImageChops
                solid = Image.new("RGBA", crop.size, (int(r * 255), int(g * 255), int(b * 255), 255))
                rgb = ImageChops.multiply(crop.convert("RGB"), solid.convert("RGB"))
                crop = rgb.convert("RGBA")
                crop.putalpha(crop.getchannel("A") if a >= 1 else al)
        px = int(round(x - minx - crop.width / 2))
        py = int(round(y - miny - crop.height / 2))
        canvas.alpha_composite(crop, (px, py))

    if upscale != 1:
        canvas = canvas.resize((canvas.width * upscale, canvas.height * upscale), Image.NEAREST)
    # 여백 트림
    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)
    canvas.save(out_png)
    if verbose:
        print(f"  -> {os.path.basename(out_png)} {canvas.size}")
    return True

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--race", default=None, help="race 폴더명 (Human/Elf/Skelton/Devil)")
    ap.add_argument("--prefab", default=None, help="특정 프리팹 경로")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    texdb = build_db()
    print(f"텍스처 DB: {len(texdb)} guid, 스프라이트 {sum(len(t['sprites']) for t in texdb.values())}개")
    if args.list:
        for race in ["Human", "Elf", "Skelton", "Devil"]:
            p = os.path.join(ROOT, "SPUM/Resources/Addons/BasicPack/2_Prefab", race)
            if os.path.isdir(p):
                pf = [f for f in glob.glob(os.path.join(p, "*.prefab"))]
                print(race, len(pf))
    targets = []
    if args.prefab:
        targets = [args.prefab]
    elif args.race:
        targets = sorted(glob.glob(os.path.join(ROOT, "SPUM/Resources/Addons/BasicPack/2_Prefab", args.race, "*.prefab")))
    else:
        for race in ["Human", "Elf", "Skelton", "Devil"]:
            targets += sorted(glob.glob(os.path.join(ROOT, "SPUM/Resources/Addons/BasicPack/2_Prefab", race, "*.prefab")))
    for pf in targets:
        race = pf.split("/2_Prefab/")[-1].split("/")[0]
        base = os.path.splitext(os.path.basename(pf))[0][-6:]
        out = os.path.join(OUT, f"{race}_{base}.png")
        ok = compose2(pf, texdb, out, verbose=True)
        if not ok:
            print("  실패:", pf)

if __name__ == "__main__":
    main()
