#!/usr/bin/env python3
"""v4.1.9 — 몬스터 사망 연기 수정
  문제: cfxr_smoke(512px, 구름 4개 시트)를 scale 0.3→0.85로 뿔려 구름 4장이
        최대 435px로 동시 렌더 → "이펙트 ㅈㄴ 크고 짜침"
  수정: 구름 1개만 크롭한 cfxr_puff.webp 신설 + emitter를 작은 단일 패프로 재조정
"""
from PIL import Image

SRC = "/home/z/my-project/public/assets/cfxr_smoke.webp"
OUT = "/home/z/my-project/public/assets/cfxr_puff.webp"

im = Image.open(SRC).convert("RGBA")
# 좌상단 구름 1개 크롭 (512/4 = 256 사분면)
q = im.crop((0, 0, 256, 256))
# 내용 bbox로 트림
bbox = q.getbbox()
if bbox:
    q = q.crop(bbox)
q.save(OUT, "WEBP", lossless=True)
print(f"cfxr_puff.webp {q.width}x{q.height} {__import__('os').path.getsize(OUT)//1024}KB")
