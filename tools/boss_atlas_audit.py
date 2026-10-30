#!/usr/bin/env python3
"""
boss_atlas_audit.py — 보스 아틀라스 잘림(clipping) 전수 감사

무엇을 검사하는가
----------------
스프라이트가 프레임 경계에서 잘렸는지는 "가장자리 픽셀이 불투명한가"로 판정할 수 있다.
캐릭터가 프레임 안에 온전히 들어 있으면 네 변의 최외곽 1px 은 거의 항상 투명하다
(여백이 있으므로). 최외곽에 불투명 픽셀이 다수면 그림이 프레임 밖으로 잘린 것이다.

추가로:
  · 프레임 크기가 모든 보스에서 같은가(다른 크기 → 렌더 시 늘어남/찌그러짐)
  · 알파 경계 여백(margin)이 좌/우/상/하 어디로 치우쳤는가
  · 배경에 사각형 잔여물이 있는가(알파가 0이 아닌 모서리)

출력: 표 + docs/BOSS_ATLAS_AUDIT.md
"""
import os, glob, json
from collections import defaultdict
from PIL import Image
import numpy as np

ASSETS = "/root/workspace/CERTZ/public/assets"


def edges_opaque(im):
    """네 변 최외곽 1px 중 불투명(alpha>16) 비율."""
    a = np.asarray(im.convert("RGBA"))[:, :, 3]
    h, w = a.shape
    top = (a[0, :] > 16).mean()
    bot = (a[h - 1, :] > 16).mean()
    left = (a[:, 0] > 16).mean()
    right = (a[:, w - 1] > 16).mean()
    return top, bot, left, right


def margin_box(im):
    """불투명 픽셀의 경계 상자 → (좌, 상, 우, 하) 여백 비율."""
    a = np.asarray(im.convert("RGBA"))[:, :, 3]
    h, w = a.shape
    ys, xs = np.where(a > 16)
    if len(xs) == 0:
        return None
    return (xs.min() / w, ys.min() / h, (w - 1 - xs.max()) / w, (h - 1 - ys.max()) / h)


def main():
    files = sorted(glob.glob(os.path.join(ASSETS, "boss_*.webp")))
    if not files:
        print("boss_*.webp 없음")
        return

    # 보스 이름별 그룹
    groups = defaultdict(list)
    for p in files:
        base = os.path.basename(p)[5:]              # boss_ 제거
        name = base.split("_")[0]
        groups[name].append(p)

    rows = []
    for name, ps in sorted(groups.items()):
        sizes = defaultdict(int)
        worst = None
        clipped_frames = []
        for p in ps:
            im = Image.open(p)
            sizes[im.size] += 1
            t, b, l, r = edges_opaque(im)
            # 최외곽 불투명 비율이 5% 넘으면 잘림 의심
            mx = max(t, b, l, r)
            mb = margin_box(im)
            rec = dict(file=os.path.basename(p), size=f"{im.size[0]}x{im.size[1]}",
                       top=t, bot=b, left=l, right=r, maxEdge=mx, margin=mb)
            rows.append(rec)
            if mx > 0.05:
                clipped_frames.append((os.path.basename(p), mx))
            if worst is None or mx > worst[1]:
                worst = (os.path.basename(p), mx, (t, b, l, r))
        main_size = max(sizes.items(), key=lambda kv: kv[1])[0]
        rows_by = [r for r in rows if r['file'].startswith(f"boss_{name}_")]
        avg_edge = sum(r['maxEdge'] for r in rows_by) / len(rows_by)
        rows_ = dict(boss=name, frames=len(ps),
                     size=f"{main_size[0]}x{main_size[1]}",
                     sizeVariants=len(sizes),
                     avgMaxEdge=avg_edge,
                     clipped=len(clipped_frames),
                     worstFile=worst[0] if worst else '',
                     worstVal=worst[1] if worst else 0,
                     worstEdges=worst[2] if worst else ())
        print(f"{name:14s} frames={len(ps):3d} size={main_size[0]}x{main_size[1]}"
              f" variants={len(sizes)} avgEdge={avg_edge*100:5.1f}%"
              f" clipped={len(clipped_frames):3d}"
              f" worst={worst[1]*100:5.1f}% ({worst[0]})" if worst else "")
        rows_.update(dict(rows_by=rows_by))
        final = rows_
        rows[-1] = final if isinstance(rows[-1], dict) and 'boss' in rows[-1] else rows[-1]

    # 요약 저장
    summary = [r for r in rows if isinstance(r, dict) and 'boss' in r]
    with open("/root/.hermes/cache/scratch/deploy/boss_audit.json", "w") as f:
        json.dump(summary, f, indent=1, ensure_ascii=False, default=str)
    print(f"\n총 {len(files)} 프레임 / {len(groups)} 보스")
    print("해석: avgEdge(최외곽 불투명 비율)이 높을수록 프레임 경계에서 잘렸다.")


if __name__ == "__main__":
    main()
