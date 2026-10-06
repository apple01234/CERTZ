#!/usr/bin/env python3
"""전 보스 시트 검증 몽타주 + 최종 리네임 정리"""
from PIL import Image, ImageDraw
import os

OUT = "/home/z/my-project/public/assets"

# 최종 리네임: gram=혈안 늑대(적), fenrir=서리 늑대, vord=성황 드래곤
renames = [
    ("bsw_gram_wolf.webp", "bsw_gram.webp"),      # 혈안의 문지기 가름 — 핏빛 늑대 (기존 gold 드래곤 덮어씀)
    ("bsw_fenrir_w.webp", "bsw_fenrir.webp"),      # 탐욕의 늑대 펜리르 — 서리 늑대 (기존 dragon 덮어씀)
]
for src, dst in renames:
    os.replace(f"{OUT}/{src}", f"{OUT}/{dst}")
# 잔여 파일 정리
for junk in ["bsw_fenrir.webp.old", "bsw_vord.webp"]:
    p = f"{OUT}/{junk}"
    if os.path.exists(p):
        os.remove(p)

# vord = 성황(금) 드래곤 — 기존 bsw_gram(금 드래곤)은 이미 bsw_gram.webp로 덮였으므로
# gold 드래곤이 사라짐 → bsw_vord용으로 gold 드래곤 재생성 필요 → make_boss_sheets의 guardian 변형 재사용
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
from make_boss_sheets import dragon_variant, save_sheet
gold, _ = dragon_variant((38, 55, 1.15, 1.06))    # 성황 금 드래곤
save_sheet(gold, "bsw_vord")
ice, _ = dragon_variant((128, 152, 0.85, 1.10))   # 빙청 드래곤 — nagr용 아님… 잔여: 삭제 예정 아니고 jorm을 청록으로 이미 만들었음
# ice는 재림 파수꾼 후보였으나 vord=gold 확정 → ice는 파일로 남기지 않는다
del ice

SHEETS = [
    "bsw_guardian", "bsw_behemoth", "bsw_nidhog", "bsw_surt", "bsw_fenrir",
    "bsw_abysslord", "bsw_skoll", "bsw_gram", "bsw_abudditos",
    "bsw_vord", "bsw_jorm", "bsw_nagr",
]
LABEL = ["guardian(화룡)", "behemoth(유령선)", "nidhog(녹룡)", "surt(용암골렘)", "fenrir(서리늑대)",
         "abysslord(암흑골렘)", "skoll(금늑대)", "gram(핏빛늑대)", "abudditos(마룡)",
         "vord(성황룡)", "jorm(해룡)", "nagr(진홍룡)"]

TILE_W, TILE_H = 300, 210
canvas = Image.new("RGB", (TILE_W * 4, TILE_H * 3 + 40), (18, 18, 28))
d = ImageDraw.Draw(canvas)
for i, name in enumerate(SHEETS):
    im = Image.open(f"{OUT}/{name}.webp").convert("RGBA")
    im.thumbnail((TILE_W - 8, TILE_H - 26), Image.LANCZOS)
    bg = Image.new("RGBA", (TILE_W - 8, TILE_H - 26), (30, 30, 44, 255))
    bg.alpha_composite(im)
    x, y = (i % 4) * TILE_W + 4, (i // 4) * TILE_H + 22
    canvas.paste(bg.convert("RGB"), (x, y))
    d.text((x + 4, y - 18), f"{i+1}. {LABEL[i]}", fill=(255, 220, 130))
canvas.save("/tmp/bossbuild/contact_all.jpg", quality=88)
print("contact sheet saved")
