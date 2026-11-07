"""catalog.json 에 낱개 분리 조각(`__1`, `__2` …)을 등록한다.

[왜] DECOR_SETS 는 `_split/` 의 낱개를 쓰는데 catalog.json 은 원본만 알고 있었다.
     테스트(tests/decor-objects.test.mjs)가 둘의 일치를 계약으로 강제하므로
     catalog.json 도 같이 갱신해야 한다.

[형식] 기존 항목 { name, file, tag, w, h } 에 맞춘다. name 은 접미사 없는 원래
      이름 규칙(`obj_<set>_<name>`)을 유지하려고 `table__1` 처럼 접미사를 붙인다.
"""
import json
import os

for SET in ('dungeon', 'forest', 'town'):
    cat_path = rf'C:\coding\CERTZ\public\assets\objects\{SET}\catalog.json'
    split_dir = rf'C:\coding\CERTZ\public\assets\objects\_split\{SET}'
    if not os.path.exists(cat_path):
        print('skip', cat_path)
        continue
    cat = json.load(open(cat_path, encoding='utf-8'))
    have = {c['name'] for c in cat}
    added = []
    if os.path.isdir(split_dir):
        for f in sorted(os.listdir(split_dir)):
            if not f.endswith('.png'):
                continue
            base = f[:-4]                      # obj_dungeon_table__1
            # name 은 세트 접두어를 뗀 나머지 (obj_dungeon_ 접두어 제거)
            prefix = 'obj_%s_' % SET
            name = base[len(prefix):] if base.startswith(prefix) else base
            if name in have:
                continue
            with open(os.path.join(split_dir, f), 'rb') as fh:
                head = fh.read(26)
            w = int.from_bytes(head[16:20], 'big')
            h = int.from_bytes(head[20:24], 'big')
            cat.append({
                'name': name,
                'file': base + '.png',
                'tag': None,
                'w': w,
                'h': h,
                'splitFrom': base.split('__')[0] + '.png',
            })
            added.append((name, w, h))
    if added:
        json.dump(cat, open(cat_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('%s: 추가 %d개' % (SET, len(added)))
    for n, w, h in added:
        print('   %-28s %dx%d' % (n, w, h))
