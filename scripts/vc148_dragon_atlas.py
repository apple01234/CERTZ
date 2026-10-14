#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc148 (#보스그리드) — 레거시 드래곤/가름 보스 3종 HD 아틀라스 재슬라이싱
  유저 제보: "너가 보스 그리드를 이상하게 짤랐잖아" — vc137 잔재 3종
  (boss_abudditos/boss_vord/boss_gram)이 이질 아트 혼합(컬러 전방+흑룡 실루엣 특수기/
  보라 악마+붉은 늑대) + 프레임 잘림 상태였다.
  → bsw_ HD 원본 시트에서 유저 뷰어 격자(실측 확정) 그대로 재슬라이싱:
    · bsw_abudditos / bsw_vord : 1540×1029 = 8열×7행 (열 192.5 · 행 147 실측 정합)
    · bsw_gram                 : 1224×1288 = 6열×7행 (열 204 · 행 184)
    · BSW 행순서 [idle,walk,atk,death,sp1,sp2,sp3] → 게임순 [idle,walk,atk,sp1,sp2,sp3,die]
  출력: public/assets/atl_boss_{abudditos,vord,gram}.webp + bossport_*.webp + manifest
  (AI 생성 0 — 유저 업로드 원본 크롭만)
"""
from PIL import Image, ImageFilter
import numpy as np
import json, os

BASE = "/home/z/my-project"
OUT_DIR = f"{BASE}/public/assets"
PREVIEW_DIR = f"{BASE}/scripts/atlas_preview"
MANIFEST = f"{BASE}/scripts/atlas_manifest.json"

PAD = 10
TARGET_MAX = 320.0
HD_UPSCAPLE_CAP = 1.5
Q_HD, Q_PORT = 80, 88
M_ETH = 5

os.makedirs(PREVIEW_DIR, exist_ok=True)

def premul_resize(im_rgba, tw, th, sharpen_pct=60):
    arr = np.array(im_rgba).astype(np.float32)
    a = arr[..., 3:4] / 255.0
    prem = np.dstack([arr[..., 0] * a[..., 0], arr[..., 1] * a[..., 0], arr[..., 2] * a[..., 0]]).clip(0, 255).astype(np.uint8)
    al = arr[..., 3].clip(0, 255).astype(np.uint8)
    rgb = Image.fromarray(prem, "RGB").resize((max(1, tw), max(1, th)), Image.LANCZOS)
    alp = Image.fromarray(al, "L").resize((max(1, tw), max(1, th)), Image.LANCZOS)
    out = np.dstack([np.array(rgb), np.array(alp)]).astype(np.float32)
    aa = out[..., 3:4] / 255.0
    inv = 1.0 / np.maximum(aa, 1e-3)
    rgbu = (out[..., :3] * inv).clip(0, 255)
    outim = Image.fromarray(np.dstack([rgbu, out[..., 3]]).clip(0, 255).astype(np.uint8))
    if sharpen_pct > 0:
        r_, g_, b_, a_ = outim.split()
        rgb2 = Image.merge("RGB", (r_, g_, b_)).filter(ImageFilter.UnsharpMask(radius=1.3, percent=sharpen_pct, threshold=2))
        outim = Image.merge("RGBA", (*rgb2.split(), a_))
    return outim

def build_atlas(cells, nrows, fw, fh, scale):
    """cells[r][c] = RGBA — 하단 중앙 정렬 균일 아틀라스 (바닥선 정렬로 발 위치 일관)"""
    atlas = Image.new("RGBA", (fw * 12, fh * nrows), (0, 0, 0, 0))
    counts = []
    for ri, row in enumerate(cells):
        n = 0
        for ci, cell in enumerate(row[:12]):
            if cell is None:
                continue
            bb = cell.getbbox()
            if not bb:
                continue
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            tw, th = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
            im = premul_resize(cell.crop(bb), tw, th, sharpen_pct=60)
            px = ci * fw + (fw - tw) // 2
            py = ri * fh + (fh - th - 2)
            atlas.alpha_composite(im, (px, py))
            n += 1
        counts.append(n)
    return atlas, counts

def save_portrait(atlas, fw, fh, name):
    port = atlas.crop((0, 0, fw, fh))
    bb = port.getbbox()
    if bb:
        port = port.crop(bb)
    w, h = port.size
    s = 220 / max(w, h)
    if s < 1.0:
        port = premul_resize(port, int(w * s), int(h * s))
    port.save(f"{OUT_DIR}/bossport_{name}.webp", "WEBP", quality=Q_PORT, method=M_ETH)

BSW_REMAP = [0, 1, 2, 4, 5, 6, 3]  # [idle,walk,atk,death,sp1,sp2,sp3] → 게임순

manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}

def hd_boss(name, src_path, x0s, y0s, cw, ch, desc):
    img = Image.open(src_path).convert("RGBA")
    cells = []
    for y0 in y0s:
        row = []
        for x0 in x0s:
            cell = img.crop((x0, y0, min(img.size[0], x0 + cw), min(img.size[1], y0 + ch)))
            a = np.array(cell)[..., 3]
            row.append(cell if (a > 12).sum() > 40 else None)
        cells.append(row)
    cells = [cells[i] for i in BSW_REMAP]
    nonempty = [c for row in cells for c in row if c is not None and c.getbbox()]
    max_dim = max(max(c.getbbox()[2] - c.getbbox()[0], c.getbbox()[3] - c.getbbox()[1]) for c in nonempty)
    scale = max(1.0, min(TARGET_MAX / max_dim, HD_UPSCAPLE_CAP))
    max_w = max(c.getbbox()[2] - c.getbbox()[0] for c in nonempty)
    max_h = max(c.getbbox()[3] - c.getbbox()[1] for c in nonempty)
    fw = int(np.ceil(max_w * scale)) + PAD
    fh = int(np.ceil(max_h * scale)) + PAD
    fw += fw % 2
    fh += fh % 2
    atlas, counts = build_atlas(cells, len(cells), fw, fh, scale)
    out = f"{OUT_DIR}/{name}.webp"
    atlas.save(out, "WEBP", quality=Q_HD, method=M_ETH)
    save_portrait(atlas, fw, fh, name.replace("atl_", ""))
    pv = atlas.resize((max(1, atlas.width // 3), max(1, atlas.height // 3)), Image.LANCZOS)
    pv.save(f"{PREVIEW_DIR}/{name}_all.png")
    kb = os.path.getsize(out) / 1024
    manifest[name] = {"fw": fw, "fh": fh, "nrows": len(cells), "rowNames": ["idle", "walk", "atk", "sp1", "sp2", "sp3", "die"],
                      "rowCounts": counts, "kb": round(kb), "desc": desc, "scale": round(scale, 2),
                      "src": os.path.basename(src_path)}
    print(f"[HD] {name}: {fw}x{fh} · {len(cells)}행 {counts} · {kb:.0f}KB · ×{scale:.2f} · {desc}")

# 격자 실측값 — 유저 뷰어 격자와 동일 (컨텐츠 스팬 전수 대조로 검증 완료)
hd_boss("atl_boss_abudditos", f"{BASE}/assets_src/boss_sheets/bsw_abudditos.webp",
        [0, 192, 385, 577, 770, 962, 1155, 1347], [round(147 * i) for i in range(7)], 192, 147,
        "마룡 아부디토스 — 흑룡 8열×7행 (vc148 그리드 재슬라이싱)")
hd_boss("atl_boss_vord", f"{BASE}/assets_src/boss_sheets/bsw_vord.webp",
        [0, 192, 385, 577, 770, 962, 1155, 1347], [round(147 * i) for i in range(7)], 192, 147,
        "베오르드 — 흑룡 8열×7행 (vc148 그리드 재슬라이싱)")
hd_boss("atl_boss_gram", f"{BASE}/assets_src/boss_sheets/bsw_gram.webp",
        [round(204 * i) for i in range(6)], [round(184 * i) for i in range(7)], 204, 184,
        "가름 — 지옥견 늑대 6열×7행 (vc148 그리드 재슬라이싱)")

json.dump(manifest, open(MANIFEST, "w"), ensure_ascii=False, indent=1)
print("manifest updated")
