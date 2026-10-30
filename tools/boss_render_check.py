#!/usr/bin/env python3
"""
boss_render_check.py — 아틀라스 프레임을 실제 렌더 크기로 그려 잘림/체급을 검증

왜 이 방식인가
-------------
브라우저에서 보스방 진입이 불안정하고, 대화 스킵도 매번 다르게 동작한다.
그런데 "보스가 잘려 보인다 / 테마에 안 맞는다"는 결국 **아틀라스에서 뽑은
프레임을 게임이 쓰는 배율로 그렸을 때**의 문제다. 그래서 게임과 동일한
스펙(BOSS_ATLAS fw/fh/cols, TARGET_H=320 정규화)으로 직접 그려 검증한다.

검증 항목
  · 프레임 안에서 캐릭터가 차지하는 비율(너무 작으면 체급이 안 산다)
  · 캐릭터의 경계 상자가 프레임을 넘는가(=잘림)
  · 정규화 후 표시 크기(가로/세로)
  · 보스별 외형이 이름/테마와 맞는지 눈으로 판정할 시트 생성
"""
import os, re, json
from PIL import Image, ImageDraw
import numpy as np

CERTZ = "/root/workspace/CERTZ"
ASSETS = os.path.join(CERTZ, "public/assets")
OUT = "/root/.hermes/cache/scratch/deploy/boss"

# 이번 챕터 매핑 (stages.ts CHAPTERS)
CHAPTER = [
    ("forest", "2. 숲의 신전", "boss", "심연의 수호자 guardian"),
    ("kingdom", "3. 쿠소디아", "boss2", "눈보라의 거수 behemoth"),
    ("alfheim", "4. 알프헤임", "boss_nidhog", "니드호그 nidhog"),
    ("muspelheim", "5. 무스펠헤임", "boss_surt", "수르트 surt"),
    ("niflheim", "6. 니플헤임", "boss_fenrir", "펜리르 fenrir"),
    ("cave", "7. 스바르트알프헤임", "boss3", "심연의 군주 abysslord"),
    ("nidavellir", "8. 니다벨리르", "boss_skoll", "스콜&하티 skoll"),
    ("hel", "9. 헬", "boss_gram", "가름 gram"),
    ("abyss", "10. 세계수의 뿌리", "boss_abudditos", "아부디토스 abudditos"),
]


def load_spec():
    src = open(os.path.join(CERTZ, "src/game/textures.ts")).read()
    atlas = {}
    m = re.search(r'export const BOSS_ATLAS[^{]*\{(.*?)\n\};', src, re.S)
    for line in m.group(1).splitlines():
        mm = re.search(r'(\w+):\s*\{[^}]*fw:\s*(\d+),\s*fh:\s*(\d+),\s*cols:\s*(\d+)', line)
        if mm:
            atlas[mm.group(1)] = dict(fw=int(mm.group(2)), fh=int(mm.group(3)), cols=int(mm.group(4)))
    rows = {}
    m = re.search(r'export const BOSS_ATLAS_ROWS[^{]*\{(.*?)\n\};', src, re.S)
    for line in m.group(1).splitlines():
        mm = re.search(r'(\w+):\s*\[([0-9,\s]+)\]', line)
        if mm:
            rows[mm.group(1)] = [int(x) for x in mm.group(2).split(',') if x.strip()]
    return atlas, rows


def frame_box(alpha):
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def main():
    atlas, rows = load_spec()
    TARGET_H = 320
    report = []
    tiles = []

    for ch, label, tex, name in CHAPTER:
        sp = atlas.get(tex)
        path = os.path.join(ASSETS, f"atl_{tex}.webp")
        if not sp or not os.path.exists(path):
            print(f"{label:22s} {name:26s} ★ 아틀라스 없음")
            report.append(dict(chapter=label, boss=name, tex=tex, status="NO_ATLAS"))
            continue
        im = Image.open(path).convert("RGBA")
        fw, fh = sp["fw"], sp["fh"]
        cnt = (rows.get(tex) or [sp["cols"]])[0]     # idle 행
        s = max(0.55, min(2.6, TARGET_H / fh))
        dw, dh = fw * s, fh * s

        # idle 행 첫 유효 프레임
        best = None
        for c in range(min(cnt, fw and sp["cols"])):
            x0, y0 = c * fw, 0
            if x0 + fw > im.size[0] or y0 + fh > im.size[1]:
                break
            sub = im.crop((x0, y0, x0 + fw, y0 + fh))
            a = np.asarray(sub)[:, :, 3]
            if (a > 16).sum() == 0:
                continue
            bb = frame_box(a)
            if bb is None:
                continue
            # 가장 큰 점유 프레임을 대표로
            area = (bb[2] - bb[0]) * (bb[3] - bb[1])
            if best is None or area > best[0]:
                best = (area, sub, bb)
        if best is None:
            print(f"{label:22s} {name:26s} ★ 유효 프레임 0")
            report.append(dict(chapter=label, boss=name, tex=tex, status="NO_FRAME"))
            continue

        area, sub, bb = best
        bw, bh = bb[2] - bb[0] + 1, bb[3] - bb[1] + 1
        fill = (bw * bh) / (fw * fh)
        # 경계 상자가 프레임 변에 닿는가 = 잘림
        touches = [bool(bb[1] == 0), bool(bb[3] == fh - 1), bool(bb[0] == 0), bool(bb[2] == fw - 1)]
        clipped = bool(any(touches))

        print(f"{label:22s} {name:26s} {fw}x{fh} 배율{s:.2f} 표시{dw:.0f}x{dh:.0f} "
              f"점유{fill*100:4.1f}% {'★잘림' if clipped else 'OK'}")
        report.append(dict(chapter=label, boss=name, tex=tex, fw=fw, fh=fh,
                           scale=round(s, 2), dispW=round(dw), dispH=round(dh),
                           fill=round(fill * 100, 1), clipped=clipped,
                           touches=touches, status="OK"))
        tiles.append((label, name, sub, s))

    # 시트: 실제 렌더 배율로 그려 한눈에 비교
    if tiles:
        CELLW, CELLH = 420, 380
        cols = 3
        rowsN = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (CELLW * cols, CELLH * rowsN), (26, 26, 34))
        d = ImageDraw.Draw(sheet)
        for i, (label, name, sub, s) in enumerate(tiles):
            cx = (i % cols) * CELLW
            cy = (i // cols) * CELLH
            img = sub.resize((int(sub.width * s), int(sub.height * s)), Image.LANCZOS)
            ox = cx + (CELLW - img.width) // 2
            oy = cy + 26
            if oy + img.height > cy + CELLH:
                img = img.crop((0, 0, img.width, cy + CELLH - oy))
            sheet.paste(img, (ox, oy), img)
            d.text((cx + 6, cy + 8), f"{label}  {name}", fill=(255, 235, 120))
            # 프레임 경계 표시
            d.rectangle([ox, oy, ox + int(sub.width*s), oy + int(sub.height*s)],
                        outline=(90, 90, 110))
        p = os.path.join(OUT, "boss_render_sheet.png")
        sheet.save(p)
        print(f"\nsheet -> {p}  {sheet.size}")

    json.dump(report, open(os.path.join(OUT, "boss_render.json"), "w"),
              indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
