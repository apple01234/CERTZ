"""에셋 정리 — 한 PNG 안에 뭉친 여러 오브젝트를 개별 파일로 분리한다.

[왜] 34개 오브젝트를 눈으로 전부 확인한 결과, 상당수가 **여러 오브젝트가 한 캔버스에
뭉쳐 있는 시트 조각**이었다. 예: obj_dungeon_table(112x52)은 탁자가 아니라 화분 2개,
obj_dungeon_jar(48x116)는 항아리 2개, obj_town_shop_black(224x112)은 가게 건물에
소품이 흩뿌려진 조각. 이걸 하나의 오브젝트로 그리면 "잘린 것"처럼 보인다.

[방법] 알파 채널의 연결 요소(connected component)를 찾아 각각 crop 한다.
  · 4-이웃 flood fill (scipy 불필요)
  · 너무 작은 조각(<=8px²)은 노이즈로 버린다
  · 결과는 원본 옆에 `<name>__1.png`, `__2.png` ... 로 저장한다 (원본 보존)

[출력] reports/prop_atlas_report.json — 각 파일의 분리 결과를 기록해
      다음 단계(decorObjects.ts 갱신)가 이걸 읽는다.
"""
from PIL import Image
import json
import os
from collections import deque

D = r'C:\coding\CERTZ\public\assets\objects'
OUTD = r'C:\coding\CERTZ\public\assets\objects\_split'
REPORT = r'C:\coding\CERTZ\reports\prop_atlas_report.json'

MIN_AREA = 24          # 이보다 작은 연결요소는 노이즈로 버린다
MIN_SIDE = 6           # 가로/세로가 이보다 작으면 버린다


def components(alpha, w, h):
    """알파>16 인 픽셀의 4-이웃 연결요소 목록을 돌려준다."""
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        row = sy * w
        for sx in range(w):
            i = row + sx
            if seen[i] or alpha[i] <= 16:
                continue
            q = deque([i])
            seen[i] = 1
            minx = maxx = sx
            miny = maxy = sy
            area = 0
            while q:
                j = q.popleft()
                area += 1
                x = j % w
                y = j // w
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                if x > 0:
                    k = j - 1
                    if not seen[k] and alpha[k] > 16:
                        seen[k] = 1; q.append(k)
                if x < w - 1:
                    k = j + 1
                    if not seen[k] and alpha[k] > 16:
                        seen[k] = 1; q.append(k)
                if y > 0:
                    k = j - w
                    if not seen[k] and alpha[k] > 16:
                        seen[k] = 1; q.append(k)
                if y < h - 1:
                    k = j + w
                    if not seen[k] and alpha[k] > 16:
                        seen[k] = 1; q.append(k)
            cw, ch = maxx - minx + 1, maxy - miny + 1
            if area < MIN_AREA or cw < MIN_SIDE or ch < MIN_SIDE:
                continue
            comps.append((minx, miny, cw, ch, area))
    comps.sort(key=lambda c: (c[1] // 8, c[0]))   # 위→아래, 왼→오
    return comps


def main():
    os.makedirs(OUTD, exist_ok=True)
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    report = {}
    multi = []
    for root, dirs, fs in os.walk(D):
        if '_split' in root:
            continue
        for f in sorted(fs):
            if not f.endswith('.png'):
                continue
            p = os.path.join(root, f)
            im = Image.open(p).convert('RGBA')
            w, h = im.size
            alpha = list(im.getchannel('A').tobytes())
            comps = components(alpha, w, h)
            rel = os.path.relpath(p, D).replace('\\', '/')
            stem = f[:-4]
            sub = os.path.basename(root)
            report[rel] = {
                'size': [w, h],
                'pieces': len(comps),
                'boxes': [{'x': c[0], 'y': c[1], 'w': c[2], 'h': c[3], 'area': c[4]} for c in comps],
            }
            if len(comps) <= 1:
                continue
            multi.append((rel, len(comps)))
            od = os.path.join(OUTD, sub)
            os.makedirs(od, exist_ok=True)
            for n, (x, y, cw, ch, _area) in enumerate(comps, start=1):
                piece = im.crop((x, y, x + cw, y + ch))
                piece.save(os.path.join(od, '%s__%d.png' % (stem, n)))

    with open(REPORT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)

    print('분리된(조각 2개 이상) 에셋:')
    for rel, n in sorted(multi, key=lambda x: -x[1]):
        print('  %-42s %d조각' % (rel, n))
    print()
    print('단일 오브젝트: %d개' % sum(1 for v in report.values() if v['pieces'] <= 1))
    print('보고서:', REPORT)


if __name__ == '__main__':
    main()
