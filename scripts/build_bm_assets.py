#!/usr/bin/env python3
"""v1.9 BM(펫/버프/치장) 에셋 생성 — 버프 물약 아이콘 4종 + 펫 스프라이트 2종 + 치장 오라 아이콘 4종.
기존 item_potion 계열과 톤을 맞춘 24x24 픽셀 아이콘. public/assets/에 저장."""
from PIL import Image, ImageDraw

OUT = "/home/z/my-project/public/assets"

def px(c):
    return tuple(int(c[i:i+2], 16) for i in (1, 3, 5))

def potion_icon(path, liquid, glow, label_dots):
    """물약 본틀 — 기존 HP/MP 물약 아이콘과 동일한 실루엣 (24x24)."""
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    L, G = px(liquid), px(glow)
    # 본틀 몸체 (둥근 플라스크)
    d.rectangle([7, 9, 16, 20], fill=L + (255,))
    d.rectangle([6, 11, 17, 18], fill=L + (255,))
    # 액체 하이라이트
    d.rectangle([9, 13, 11, 17], fill=G + (255,))
    # 코르크
    d.rectangle([9, 5, 14, 9], fill=px("#a4713d") + (255,))
    d.rectangle([10, 3, 13, 5], fill=px("#c08a4d") + (255,))
    # 테두리
    for x in range(7, 17):
        d.point((x, 20), fill=px("#1a1020") + (230,))
        d.point((x, 9), fill=px("#1a1020") + (230,))
    for y in range(9, 21):
        d.point((7, y), fill=px("#1a1020") + (230,))
        d.point((16, y), fill=px("#1a1020") + (230,))
    # 등급 점 (라벨)
    for i, cx in enumerate(label_dots):
        d.rectangle([cx, 15, cx + 1, 16], fill=px("#ffffff") + (220,))
    img.save(f"{OUT}/{path}")

def pet_slime():
    """월드 스프라이트 — 초록 슬라임 펫 (26x20, 귀여운 눈)."""
    img = Image.new("RGBA", (26, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = px("#5ad46a"); hi = px("#a8f0a0"); dark = px("#2f9e4f"); eye = px("#1a1020")
    # 몸통 (아래가 넓은 둥근 형태)
    d.ellipse([2, 6, 23, 19], fill=body + (255,))
    d.ellipse([5, 3, 20, 15], fill=body + (255,))
    # 상단 하이라이트
    d.ellipse([7, 5, 12, 9], fill=hi + (255,))
    d.ellipse([13, 4, 15, 6], fill=hi + (200,))
    # 눈
    d.rectangle([9, 10, 10, 12], fill=eye + (255,))
    d.rectangle([15, 10, 16, 12], fill=eye + (255,))
    # 입
    d.point((12, 14), fill=dark + (255,))
    d.point((13, 14), fill=dark + (255,))
    # 하단 그늘
    for x in range(4, 22):
        d.point((x, 18), fill=dark + (160,))
    # 외곽선
    d.arc([2, 6, 23, 19], 0, 360, fill=px("#173a1e") + (200,))
    img.save(f"{OUT}/pet_slime.png")

def pet_pixie():
    """월드 스프라이트 — 핑크 요정 펫 (작은 날개 + 막대사탕 빛)."""
    img = Image.new("RGBA", (26, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = px("#ff9ad5"); hi = px("#ffd0ee"); wing = px("#bfe8ff"); eye = px("#1a1020")
    # 날개 (좌우)
    d.ellipse([0, 5, 8, 12], fill=wing + (200,))
    d.ellipse([18, 5, 26, 12], fill=wing + (200,))
    d.ellipse([1, 7, 6, 10], fill=px("#eaf7ff") + (230,))
    d.ellipse([20, 7, 25, 10], fill=px("#eaf7ff") + (230,))
    # 몸통 (둥근 공)
    d.ellipse([8, 4, 18, 17], fill=body + (255,))
    d.ellipse([10, 6, 13, 9], fill=hi + (255,))
    # 눈
    d.rectangle([11, 10, 12, 12], fill=eye + (255,))
    d.rectangle([15, 10, 16, 12], fill=eye + (255,))
    # 입
    d.point((13, 14), fill=px("#c2558a") + (255,))
    # 머리 안테나 별
    d.point((13, 2), fill=px("#ffe86a") + (255,))
    img.save(f"{OUT}/pet_pixie.png")

def aura_icon(path, c1, c2):
    """치장 오라 아이콘 — 인벤토리 표시용 24x24 후광."""
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    a, b = px(c1), px(c2)
    # 외곽 후광 (다이아 레이어)
    d.polygon([(12, 1), (23, 12), (12, 23), (1, 12)], fill=b + (120,))
    d.polygon([(12, 4), (20, 12), (12, 20), (4, 12)], fill=a + (200,))
    d.polygon([(12, 7), (17, 12), (12, 17), (7, 12)], fill=px("#ffffff") + (235,))
    d.point((12, 12), fill=a + (255,))
    img.save(f"{OUT}/{path}")

# 버프 물약 4종 (등급 점으로 구분)
potion_icon("item_buff_atk.png", "#e84a5a", "#ff9a9a", [8, 11, 14])   # 분노 — 점 3
potion_icon("item_buff_def.png", "#4a7de8", "#8fb8ff", [8, 14])        # 수호 — 점 2
potion_icon("item_buff_spd.png", "#3ac98a", "#9af0c8", [8, 11, 14])    # 신속 — 점 3
potion_icon("item_buff_exp.png", "#c86ae8", "#e8a8ff", [8, 14])        # 지혜 — 점 2

# 펫 스프라이트
pet_slime()
pet_pixie()

# 치장 오라 아이콘 4종
aura_icon("cos_dawn.png", "#8fd8ff", "#4a9de8")    # 새벽빛 오라
aura_icon("cos_gold.png", "#ffe86a", "#e8a83a")    # 황금 오라
aura_icon("cos_abyss.png", "#b08aff", "#6a3ae8")   # 심연 오라
aura_icon("cos_wings.png", "#baf3ff", "#7dc0ff")   # 요정 날개

print("BM assets generated:", flush=True)
import subprocess
subprocess.run(["ls", OUT], capture_output=True)
for f in ["item_buff_atk.png","item_buff_def.png","item_buff_spd.png","item_buff_exp.png",
          "pet_slime.png","pet_pixie.png","cos_dawn.png","cos_gold.png","cos_abyss.png","cos_wings.png"]:
    print(" ", f)
