"""에디터 매니페스트(editorAssetManifest.ts)의 w/h 를 실제 PNG 크기로 정정한다.

[왜] 매니페스트의 w/h 가 실제 PNG 와 어긋나 있었다:
      obj_dungeon_table  28x13  (실제 112x52)
      obj_dungeon_grave  29x16  (실제 116x64)
      obj_forest_rock    31x28  (실제 124x112)
      obj_town_vending   88x24  → 이것만 맞음
     에디터가 이 값으로 프리뷰를 그리면 실제와 다른 크기로 보여 "잘린 것처럼" 된다.

[방법] PNG 헤더(IHDR)에서 실제 크기를 읽어 w/h 를 덮어쓴다.
        url 필드에 적힌 경로를 그대로 쓰므로 파일명 변경에도 안전하다.
"""
import json
import os
import re

MANIFEST = r'C:\coding\CERTZ\src\game\editorAssetManifest.ts'
ROOT = r'C:\coding\CERTZ\public'


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(26)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    w = int.from_bytes(head[16:20], 'big')
    h = int.from_bytes(head[20:24], 'big')
    return w, h


def main():
    src = open(MANIFEST, encoding='utf-8').read()
    pat = re.compile(r'(\{ url:"(/assets/[^"]+)", name:"[^"]+", category:"[^"]+", group:"[^"]+", label:"[^"]+", )w:(\d+), h:(\d+)')
    fixed = []
    missing = []

    def repl(m):
        prefix, url, ow, oh = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
        p = os.path.join(ROOT, url.lstrip('/').replace('/', os.sep))
        if not os.path.exists(p):
            missing.append(url)
            return m.group(0)
        sz = png_size(p)
        if not sz:
            return m.group(0)
        w, h = sz
        if (w, h) != (ow, oh):
            fixed.append((url, (ow, oh), (w, h)))
        return '%sw:%d, h:%d' % (prefix, w, h)

    out = pat.sub(repl, src)
    open(MANIFEST, 'w', encoding='utf-8', newline='\n').write(out)

    print('정정 %d개:' % len(fixed))
    for url, old, new in fixed:
        print('  %-56s %dx%d -> %dx%d' % (url, old[0], old[1], new[0], new[1]))
    if missing:
        print('\n파일 없음 %d개:' % len(missing))
        for m in missing:
            print('  ', m)


if __name__ == '__main__':
    main()
