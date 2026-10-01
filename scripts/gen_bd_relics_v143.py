# v1.4.3 — 재림 보스 유물 아이콘 3종 생성 (기존 아이콘 색조 변형)
from PIL import Image
import os

A = "/home/z/my-project/public/assets"
jobs = [
    ("i_bd_guardian.webp", "i_bd_vord.webp",  (1.25, 0.75, 0.55)),  # 주황빛 감시안 (베오르드 orbTint 0xffb05a)
    ("i_bd_nidhog.webp",   "i_bd_jorm.webp",  (0.60, 1.25, 0.85)),  # 청록빛 껍질 (요르문간드 orbTint 0x9affd0)
    ("i_bd_abudditos.webp","i_bd_nagr.webp",  (1.30, 1.05, 0.45)),  # 금빛 종언 (나그라파르 orbTint 0xffd76a)
]
for src, dst, (r, g, b) in jobs:
    im = Image.open(os.path.join(A, src)).convert("RGBA")
    px = im.getdata()
    out = []
    for (pr, pg, pb, pa) in px:
        out.append((min(255, int(pr * r)), min(255, int(pg * g)), min(255, int(pb * b)), pa))
    im.putdata(out)
    im.save(os.path.join(A, dst), "WEBP", quality=90)
    print(dst, im.size)
print("OK")
