#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vc187 (지시 #17 — "블렌더 에셋으로 만든 3d 컷씬 말고 내가 준 VFX 팩에 있는
프리팹 에셋 및 애니메이션을 적용해야지!!")

Cartoon FX Remaster(JMO Assets) 팩의 텍스처를 게임 규격 webp 로 추출한다.
이 팩은 Unity prefab 이지만, 그 프리팹들이 쓰는 핵심 텍스처(참격/폭발/링/전격/불꽃)를
그대로 뽑아 Phaser 스프라이트로 쓰면 같은 시각 결과를 2D 로 얻는다.

Unity 텍스처는 대개 알파가 RGB 에 실린 premultiplied 형태이거나
검정 배경 + 가산(additive) 합성 전제라, 그대로 webp 로 저장하면
Phaser 의 normal blend 에서 사각형 검정 박스가 보인다.
→ 휘도→알파 추출 후 저장한다(vc181 에서 확립한 방식).
"""
import os
import re

import numpy as np
from PIL import Image

SRC = "/root/workspace/assets_in/uni/JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics"
DST = "/root/workspace/CERTZ/public/assets/vfx2"

# 스킬 연출에 실제로 쓰이는 것만 고른다 (이름 → 출력 키)
PICK = {
    "cfxr star.png": "star",
    "cfxr star blurred.png": "starblur",
    "cfxr magic star.png": "magicstar",
    "cfxr ring arc.png": "ringarc",
    "cfxr ring electric.png": "ringelec",
    "cfxr ring ice.png": "ringice",
    "cfxr ring spikes revert.png": "ringspike",
    "cfxr aura rays.png": "aurarays",
    "cfxr stretch ray.png": "stretchray",
    "cfxr stretch ray blur.png": "stretchrayblur",
    "cfxr explosion smoke alpha.png": "exsmoke",
    "cfxr smoke cloud x4 white.png": "smokewhite",
    "cfxr electric spark.png": "elecspark",
    "cfxr fire circle blur.png": "firecircle",
    "cfxr star.png": "sparkle",
}

SIZE = 256


def to_alpha(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA")).astype(np.float32)
    rgb, al = a[:, :, :3], a[:, :, 3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    if al.max() > 8 and al.mean() > 20:
        # 알파가 이미 살아있으면 그대로 (곱해서 보존)
        out_a = np.clip(al * (lum / 255.0 * 0.6 + 0.4), 0, 255)
    else:
        out_a = np.clip(lum - 6, 0, 255)
    out = np.zeros((*lum.shape, 4), np.uint8)
    out[:, :, 0] = np.clip(rgb[:, :, 0], 0, 255).astype(np.uint8)
    out[:, :, 1] = np.clip(rgb[:, :, 1], 0, 255).astype(np.uint8)
    out[:, :, 2] = np.clip(rgb[:, :, 2], 0, 255).astype(np.uint8)
    out[:, :, 3] = out_a.astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    os.makedirs(DST, exist_ok=True)
    files = os.listdir(SRC)
    made, miss = 0, []
    for src_name, key in PICK.items():
        if src_name not in files:
            # 대소문자/공백 변형 탐색
            cand = [f for f in files if re.sub(r"\s+", " ", f.lower()) == re.sub(r"\s+", " ", src_name.lower())]
            if not cand:
                miss.append(src_name)
                continue
            src_name = cand[0]
        im = Image.open(os.path.join(SRC, src_name))
        im = to_alpha(im)
        # 정사각 캔버스에 맞춰 리사이즈 (비율 유지, 여백 투명)
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
        canvas.save(os.path.join(DST, f"{key}.webp"), "WEBP", lossless=True, method=6)
        made += 1
    print(f"VFX 텍스처 {made}종 추출 → public/assets/vfx2/")
    if miss:
        print(f"누락 {len(miss)}: {miss}")


if __name__ == "__main__":
    main()
