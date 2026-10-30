#!/usr/bin/env python3
"""
boss_atlas_clip.py — 보스 아틀라스 프레임 잘림을 실제 그리드 규격으로 실측

앞선 boss_atlas_audit.py 는 개별 프레임(boss_x_N.webp)만 봤고 아틀라스
(atl_boss_x.webp)를 놓쳤다. 이 버전은 src/game/textures.ts 의
BOSS_ATLAS(fw/fh/cols) 및 BOSS_ATLAS_ROWS(행별 유효 프레임 수)를
그대로 읽어 슬라이스하고, 각 프레임의 네 변 최외곽 불투명 픽셀 비율로
잘림을 판정한다.

판정 기준
---------
프레임이 정확히 맞으면 캐릭터는 프레임 안에 여백을 두고 들어간다.
최외곽 1px 에 불투명 픽셀이 있으면 그 방향으로 그림이 잘린 것이다.
  · 5% 초과  → 잘림 의심
  · 20% 초과 → 확정 잘림
"""
import os, re, glob, json
from PIL import Image
import numpy as np

CERTZ = "/root/workspace/CERTZ"
ASSETS = os.path.join(CERTZ, "public/assets")


def load_spec():
    """textures.ts 에서 BOSS_ATLAS 와 BOSS_ATLAS_ROWS 를 파싱."""
    src = open(os.path.join(CERTZ, "src/game/textures.ts")).read()
    atlas = {}
    m = re.search(r'export const BOSS_ATLAS[^{]*\{(.*?)\n\};', src, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.search(r'(\w+):\s*\{[^}]*fw:\s*(\d+),\s*fh:\s*(\d+),\s*cols:\s*(\d+)', line)
            if mm:
                atlas[mm.group(1)] = dict(fw=int(mm.group(2)), fh=int(mm.group(3)), cols=int(mm.group(4)))
    rows = {}
    m = re.search(r'export const BOSS_ATLAS_ROWS[^{]*\{(.*?)\n\};', src, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.search(r'(\w+):\s*\[([0-9,\s]+)\]', line)
            if mm:
                rows[mm.group(1)] = [int(x) for x in mm.group(2).split(',') if x.strip()]
    return atlas, rows


def edge_ratio(a):
    """네 변 최외곽 1px 중 불투명 비율."""
    h, w = a.shape
    return ((a[0, :] > 16).mean(), (a[h-1, :] > 16).mean(),
            (a[:, 0] > 16).mean(), (a[:, w-1] > 16).mean())


def main():
    atlas, rows = load_spec()
    print(f"아틀라스 {len(atlas)}종 규격 로드\n")
    out = []
    for tex, sp in sorted(atlas.items()):
        path = os.path.join(ASSETS, f"atl_{tex}.webp")
        if not os.path.exists(path):
            print(f"{tex:16s} ★ 파일 없음 ({os.path.basename(path)})")
            continue
        im = Image.open(path).convert("RGBA")
        rgba = np.asarray(im)
        alpha = rgba[:, :, 3]
        fw, fh, cols = sp["fw"], sp["fh"], sp["cols"]
        rowcounts = rows.get(tex, [])
        clipped, total, worst = [], 0, (None, 0, None)
        for r, cnt in enumerate(rowcounts):
            for c in range(min(cnt, cols)):
                x0, y0 = c * fw, r * fh
                if y0 + fh > alpha.shape[0] or x0 + fw > alpha.shape[1]:
                    continue
                sub = alpha[y0:y0+fh, x0:x0+fw]
                if sub.size == 0 or (sub > 16).sum() == 0:
                    continue          # 빈 프레임
                total += 1
                t, b, l, rt = edge_ratio(sub)
                mx = max(t, b, l, rt)
                if mx > 0.05:
                    clipped.append((f"r{r}c{c}", round(mx * 100, 1), [round(v*100, 1) for v in (t, b, l, rt)]))
                if mx > worst[1]:
                    worst = (f"r{r}c{c}", mx, [round(v*100, 1) for v in (t, b, l, rt)])
        pct = len(clipped) / total * 100 if total else 0
        flag = "★확정" if (worst[1] or 0) > 0.20 else ("의심" if clipped else "OK")
        print(f"{tex:16s} {fw}x{fh} cols={cols:2d} 프레임={total:3d} "
              f"잘림={len(clipped):3d}({pct:4.1f}%) 최악={worst[1]*100 if worst[1] else 0:5.1f}% {flag}")
        if worst[2]:
            print(f"                 최악프레임 {worst[0]} 상/하/좌/우={worst[2]}")
        out.append(dict(tex=tex, fw=fw, fh=fh, cols=cols, frames=total,
                        clipped=len(clipped), pct=round(pct, 1),
                        worst=round((worst[1] or 0) * 100, 1),
                        worstFrame=worst[0], worstEdges=worst[2], flag=flag))
    json.dump(out, open("/root/.hermes/cache/scratch/deploy/boss_clip.json", "w"),
              indent=1, ensure_ascii=False)
    print(f"\n총 아틀라스 {len(out)}종")


if __name__ == "__main__":
    main()
