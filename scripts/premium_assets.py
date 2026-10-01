#!/usr/bin/env python3
"""v4.1.8 프리미엄 에셋 파이프라인
1) CFXR(Cartoon FX Remaster) 텍스처 → public/assets/cfxr_*.webp (512px 정규화)
2) SPUM 조합 캐릭터 → public/assets/spum_*.webp (96x96 바닥 앵커 캔버스)
"""
import os
from PIL import Image

SPUM_GFX = "/home/z/my-project/asset_work/spum/JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics"
SPUM_OUT = "/home/z/my-project/asset_work/spum_out"
PUB = "/home/z/my-project/public/assets"

# ── 1) CFXR 추출 목록: (소스명, 출력키, 리사이즈) ──
CFXR = [
    ("cfxr spikes impact.png",        "cfxr_impact", 128),  # 히트/버스트 (spark 16px 대체 — 스케일 설정 보정)
    ("cfxr star blurred.png",         "cfxr_star",   512),  # 레벨업 별 폭발 (pk_star_02 대체 — 설정 무변경)
    ("cfxr smoke cloud x4.png",       "cfxr_smoke",  512),  # 사망 연기 (pk_smoke_01 대체)
    ("cfxr magic star.png",           "cfxr_mstar",  512),  # 포탈/수집 마법 (pk_magic_01/02 대체)
    ("cfxr flamme full blurred.png",  "cfxr_flamme", 512),  # 카오스 잉걸불 (pk_fire_01 대체 — 종횡비 유지)
]

# ── 2) SPUM 캐릭터 선택: (조합PNG, 출력키) ──
SPUM = [
    ("Human_640352.png",  "spum_villager_m"),  # 모험가(검+방패) — 주민/선원 롤프
    ("Human_639405.png",  "spum_villager_f"),  # 적 드레스 여성 — 시그룬/마을 아이
    ("Human_639234.png",  "spum_knight"),      # 중무장 기사 — 성전견습기사/카이엔/감독관
    ("Elf_451694.png",    "spum_elf"),         # 금발 엘프 궁수 — 요정 사절 리안
    ("Human_639493.png",  "spum_mage"),        # 청 로브 마법사 — 노아/테일/로안
    ("Skelton_640091.png","spum_skel"),        # 무장 스켈레톤 — 전쟁 유령 아르벨
    ("Devil_640476.png",  "spum_devil"),       # 분홍 악마 — 어둠 요정 피난민
    ("Human_638981.png",  "spum_smith"),       # 망치 대장장이 — 브라키/두린
    ("Human_638897.png",  "spum_miner"),       # 후드 광부 — 코일
    ("Human_638731.png",  "spum_fisher"),      # 민머리 대님 — 팰/마지막 항해사
    ("Human_638643.png",  "spum_forager"),     # 갈색 머리 채집가 — 베르
    ("Elf_638140.png",    "spum_scout"),       # 녹색 후드 정찰궁수 — 눈보라 정찰병
    ("Elf_638308.png",    "spum_mystic"),      # 청 후드 신비가 — 그밀
    ("Devil_640719.png",  "spum_butler"),      # 흑갑 슈츠악마 — 집사 무르
]

CANVAS = 96

def process_cfxr():
    print("== CFXR ==")
    for src, key, size in CFXR:
        p = os.path.join(SPUM_GFX, src)
        im = Image.open(p).convert("RGBA")
        w, h = im.size
        if max(w, h) > size:
            if w >= h:
                im = im.resize((size, max(1, round(h * size / w))), Image.LANCZOS)
            else:
                im = im.resize((max(1, round(w * size / h)), size), Image.LANCZOS)
        out = os.path.join(PUB, f"{key}.webp")
        im.save(out, "WEBP", lossless=True)
        kb = os.path.getsize(out) // 1024
        print(f"  {key}.webp {im.width}x{im.height} {kb}KB  <- {src}")

def process_spum():
    print("== SPUM ==")
    for src, key in SPUM:
        p = os.path.join(SPUM_OUT, src)
        im = Image.open(p).convert("RGBA")
        # 캔버스: 96x96, 캐릭터 하단 중앙 앵커 (상단 2px 여백)
        w, h = im.size
        s = min((CANVAS - 4) / w, (CANVAS - 4) / h, 3.2)
        if s < 1:
            im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.NEAREST)
            w, h = im.size
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((CANVAS - w) // 2, CANVAS - 2 - h))
        out = os.path.join(PUB, f"{key}.webp")
        canvas.save(out, "WEBP", lossless=True)
        kb = os.path.getsize(out) // 1024
        print(f"  {key}.webp {kb}KB  <- {src} (원본 {w}x{h})")

if __name__ == "__main__":
    process_cfxr()
    process_spum()
    print("완료")
