#!/usr/bin/env python3
"""SPUM 프리팹 파서/조합기 — Unity YAML 프리팹을 PIL 레이어 합성으로 완성 캐릭터 PNG 변환
- GUID→텍스처 매핑 (SPUM/Resources/**/*.meta)
- 스프라이트 시트 rect + 커스텀 피벗 (spriteSheet.sprites internalID)
- Transform 계층 누적 이동/스케일/회전 + SpriteRenderer z-order
- PPU=32 (meta spritePixelsToUnits), Y축 반전(Unity up → canvas down)

v4.1.9 수정 (유저 지적 "얼굴/파츠 배치 이상함"):
1) 스프라이트 피벗 처리 — 기존엔 모든 파츠를 중앙 정렬로 붙여 관절(목/어깨/골반)이 어긋났다.
   시트 항목의 pivot + 단일 스프라이트 meta 최상위 spritePivot을 반영해 피벗점을 트랜스폼 위치에 정렬.
2) 틴트 알파 보존 — 기존 convert("RGB")로 알파가 유실돼 틴트 파츠가 불투명 사각형(파란 박스)으로 렌더됐다.
   채널 분리 multiply로 RGB만 틴트하고 알파 유지.
3) 회전을 피벗점 기준으로 (패딩 홀더 후 중앙 회전) + flipx 시 피벗 X 반전.
"""
import os, re, sys, glob, math, json
from PIL import Image

ROOT = "/home/z/my-project/asset_work/spum"
OUT = "/home/z/my-project/asset_work/spum_out"
PPU = 32.0

# ---------- 1) 메타 파싱: guid → {texPath, sprites{internalID: rect}} ----------
def parse_meta_sprites(meta_path):
    """meta 파일에서 guid + spriteSheet.sprites rect/피벗 추출 + 최상위 spritePivot(단일 스프라이트용)
    v4.1.9 — 피벗 미처리가 파츠 배치 붕괴의 원인 1: 시트 항목 pivot, 단일 스프라이트 spritePivot 모두 반영"""
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
    # 단일 스프라이트(21300000)용 최상위 피벗 (alignment 9=custom, 기본 중앙)
    pm = re.search(r"^  alignment:\s*(\d+)", txt, re.M)
    pv = re.search(r"^  spritePivot: \{x:\s*([\d.eE+-]+),\s*y:\s*([\d.eE+-]+)\}", txt, re.M)
    if pv:
        root_pivot = (float(pv.group(1)), float(pv.group(2)))
    elif pm and pm.group(1) == "0":
        root_pivot = (0.5, 0.5)  # alignment 0 = Center
    else:
        root_pivot = (0.5, 0.5)
    sprites = {}
    # spriteSheet: 섹션의 sprites 목록만 추출 (spriteSheet: 이후 indent 유지 블록)
    sm = re.search(r"\n  spriteSheet:\n(.*?)(?=\n  \w|\Z)", txt, re.S)
    block = sm.group(1) if sm else ""
    # 항목 단위 분할 — name/rect/pivot/internalID를 항목별로 파싱 (피벗 누락 방지)
    for entry in re.split(r"(?=    - serializedVersion: 2\n)", block):
        nm = re.search(r"      name: (\S[^\n]*?)\n", entry)
        rc = re.search(r"      rect:\n        serializedVersion: 2\n        x: (-?[\d.]+)\n        y: (-?[\d.]+)\n        width: (-?[\d.]+)\n        height: (-?[\d.]+)", entry)
        iidm = re.search(r"      internalID: (-?\d+)", entry)
        if not (nm and rc and iidm):
            continue
        pvm = re.search(r"      pivot: \{x:\s*([\d.eE+-]+),\s*y:\s*([\d.eE+-]+)\}", entry)
        pivot = (float(pvm.group(1)), float(pvm.group(2))) if pvm else (0.5, 0.5)
        sprites[iidm.group(1)] = {
            "name": nm.group(1),
            "rect": (float(rc.group(1)), float(rc.group(2)), float(rc.group(3)), float(rc.group(4))),
            "pivot": pivot,
        }
    return guid, tex, sprites, root_pivot

def build_db():
    texdb = {}   # guid -> {path, sprites{iid: {rect,pivot}}, root_pivot}
    metas = glob.glob(os.path.join(ROOT, "**", "*.png.meta"), recursive=True)
    for mp in metas:
        r = parse_meta_sprites(mp)
        if not r:
            continue
        guid, tex, sprites, root_pivot = r
        if not os.path.exists(tex):
            continue
        texdb[guid] = {"path": tex, "sprites": sprites, "root_pivot": root_pivot}
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
    """v4.1.9 — 피벗 정렬 + 알파 보존 틴트 + 피벗 기준 회전 (파츠 배치 붕괴 수정)"""
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
                td = texdb[sr["guid"]]
                sps = td["sprites"]
                if sr["iid"] in sps:
                    sp = sps[sr["iid"]]
                else:
                    # 단일 스프라이트(21300000) — 텍스처 전체 + meta 최상위 피벗
                    w0, h0 = tex_size(texdb, sr["guid"])
                    sp = {"name": "_full", "rect": (0, 0, w0, h0), "pivot": td["root_pivot"]}
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

    # bounds — 피벗 반영 (피벗 기준 좌우/상하 비대칭 폭) + 회전 여유
    minx = miny = 10**9
    maxx = maxy = -10**9
    for z, x, y, ang, sp, col, flipx, sx, sy, guid in items:
        gx, gy, gw, gh = sp["rect"]
        pvx, pvy = sp.get("pivot", (0.5, 0.5))
        if flipx:
            pvx = 1.0 - pvx
        hw = max(pvx, 1.0 - pvx) * gw * abs(sx) + abs(gw * sx) * 0.15  # 회전 여유 15%
        hh = max(pvy, 1.0 - pvy) * gh * abs(sy) + abs(gh * sy) * 0.15
        minx, miny = min(minx, x - hw), min(miny, y - hh)
        maxx, maxy = max(maxx, x + hw), max(maxy, y + hh)
    W = int(math.ceil(maxx - minx)) + 4
    H = int(math.ceil(maxy - miny)) + 4
    canvas = Image.new("RGBA", (max(W, 8), max(H, 8)), (0, 0, 0, 0))

    from PIL import ImageChops
    for z, x, y, ang, sp, col, flipx, sx, sy, guid in items:
        gx, gy, gw, gh = sp["rect"]
        gx, gy, gw, gh = int(gx), int(gy), int(gw), int(gh)
        crop = get_tex(guid).crop((gx, gy, gx + gw, gy + gh))
        tw, th = max(1, int(round(gw * sx))), max(1, int(round(gh * sy)))
        if (tw, th) != crop.size:
            crop = crop.resize((tw, th), Image.NEAREST)
        # 피벗 (캔버스 기준 좌상단 원점 오프셋) — flipx 시 X 반전
        pvx, pvy = sp.get("pivot", (0.5, 0.5))
        if flipx:
            crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
            pvx = 1.0 - pvx
        ox = pvx * crop.width
        oy = (1.0 - pvy) * crop.height  # Unity 피벗 y는 좌하단 원점 → 캔버스는 우하단 반전
        r, g, b, a = col
        # v4.1.9 — 틴트: 채널 분리 multiply (알파 보존 — 기존 convert("RGB")가
        # 알파를 255로 채워 틴트 파츠가 불투명 사각형으로 렌더되던 버그 수정)
        if (r, g, b, a) != (1, 1, 1, 1):
            rr, gg, bb, aa = crop.split()
            if (r, g, b) != (1, 1, 1):
                solid = Image.new("RGBA", crop.size, (int(r * 255), int(g * 255), int(b * 255), 255))
                sr2, sg2, sb2, _ = solid.split()
                rr = ImageChops.multiply(rr, sr2)
                gg = ImageChops.multiply(gg, sg2)
                bb = ImageChops.multiply(bb, sb2)
            if a < 1:
                aa = aa.point(lambda v: int(v * a))
            crop = Image.merge("RGBA", (rr, gg, bb, aa))
        # 회전 — 피벗점을 중심에 놓은 홀더에서 회전 (피벗 위치 유지)
        if abs(ang) > 0.5:
            R = int(math.ceil(math.hypot(crop.width, crop.height))) + 2
            holder = Image.new("RGBA", (R, R), (0, 0, 0, 0))
            holder.paste(crop, (int(R // 2 - ox), int(R // 2 - oy)), crop)
            holder = holder.rotate(ang, resample=Image.NEAREST)  # PIL CCW = Unity CCW 표시 방향 동일
            px = int(round(x - minx - holder.width / 2))
            py = int(round(y - miny - holder.height / 2))
            canvas.alpha_composite(holder, (px, py))
        else:
            px = int(round(x - minx - ox))
            py = int(round(y - miny - oy))
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
