#!/usr/bin/env python3
"""Task 52 — Unity Asset Store 유료 에셋 통합 스크립트
  1) Fantasy UI SFX (유료) → WAV→OGG 변환 (mono 44.1kHz q4)
     · 기존 sfx_*.ogg 9종 drop-in 교체 (같은 파일명 → 코드 무수정)
     · 신규 8종 추가 (coin/potion/equip/upgrade/click/open/close/ach)
  2) CFXR + FireworksEffect2D 텍스처 → public/assets/pfx_*.png (필요시 리사이즈)
"""
import subprocess, os, shutil, sys
from PIL import Image

ROOT = "/home/z/my-project"
SFX_SRC = f"{ROOT}/scripts/_unity_extract/SPUM/Fantasy UI SFX - Lite Edition"
CFXR = f"{ROOT}/scripts/_unity_extract/SPUM/JMO Assets/Cartoon FX Remaster/CFXR Assets/Graphics"
FW = f"{ROOT}/scripts/_unity_extract/CartoonVFX9X/CartoonVFX9X/FireworksEffect2D/Textures"
AUDIO_OUT = f"{ROOT}/public/assets/audio"
ASSET_OUT = f"{ROOT}/public/assets"
BACKUP = f"{ROOT}/scripts/_sfx_backup_rubberduck"

os.makedirs(BACKUP, exist_ok=True)

# ── 1. SFX 매핑: (출력키, 소스 wav, 교체여부) ──────────────────────────
REPLACE = [  # 기존 키 — 파일명 동일, 코드 무수정
    ("sfx_swing",   "Weapon 1-2.wav"),
    ("sfx_hit",     "Wood Impact 01.wav"),
    ("sfx_spin",    "Weapon 1-4.wav"),
    ("sfx_dash",    "Arrow & Bow 1-1.wav"),
    ("sfx_hurt",    "Armor 1-1.wav"),
    ("sfx_pickup",  "Coins 1-5.wav"),
    ("sfx_quest",   "Magical Interface 3-1.wav"),
    ("sfx_levelup", "Magical Texture Chimes 1-1.wav"),
    ("sfx_portal",  "Magical Interface 1-1.wav"),
]
NEW = [  # 신규 키 — audio.ts에서 새 전용음으로 연결
    ("sfx_coin",   "Coins 2-1.wav"),
    ("sfx_potion", "Potion Item 1-1.wav"),
    ("sfx_equip",  "Armor 1-3.wav"),
    ("sfx_upgrade","Blacksmithing 1-2.wav"),
    ("sfx_click",  "Interface 1-1.wav"),
    ("sfx_open",   "Bag Handle 1-1.wav"),
    ("sfx_close",  "Bag Handle 1-5.wav"),
    ("sfx_ach",    "Special Interface 3-1.wav"),
]

def convert(key: str, src: str) -> bool:
    s = os.path.join(SFX_SRC, src)
    d = os.path.join(AUDIO_OUT, f"{key}.ogg")
    if not os.path.exists(s):
        print(f"MISS {src}")
        return False
    # 기존 파일 백업 (교체분만)
    if os.path.exists(d) and not os.path.exists(os.path.join(BACKUP, f"{key}.ogg")):
        shutil.copy2(d, os.path.join(BACKUP, f"{key}.ogg"))
    r = subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", s,
        "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "4", d,
    ], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {key}: {r.stderr[:200]}")
        return False
    # 길이 검증 (원본 대비 ±5%)
    d1 = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                               "-of", "csv=p=0", s], capture_output=True, text=True).stdout.strip())
    d2 = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                               "-of", "csv=p=0", d], capture_output=True, text=True).stdout.strip())
    ok = abs(d1 - d2) / max(d1, 0.01) < 0.05
    kb = os.path.getsize(d) // 1024
    print(f"{'OK ' if ok else 'BAD'} {key}.ogg  {d2:.2f}s (src {d1:.2f}s)  {kb}KB")
    return ok

print("=== 1. SFX 교체 (drop-in) ===")
n1 = sum(convert(k, s) for k, s in REPLACE)
print("=== 2. SFX 신규 추가 ===")
n2 = sum(convert(k, s) for k, s in NEW)
print(f"replace {n1}/{len(REPLACE)}, new {n2}/{len(NEW)}")
if n1 != len(REPLACE) or n2 != len(NEW):
    sys.exit(1)

# ── 2. VFX 텍스처 복사 ──────────────────────────────────────────────
# (소스파일, 출력키, 최대변, 리사이즈 여부)
VFX = [
    (f"{CFXR}/cfxr hit triangle.png",      "pfx_hit",      256, True),   # 타격 임팩트 (흰색 마스크)
    (f"{CFXR}/cfxr magic star.png",        "pfx_magic",    256, True),   # 크리티컬 마법 스파클
    (f"{CFXR}/cfxr star.png",              "pfx_star",     128, True),   # 레벨업 별
    (f"{CFXR}/cfxr aura runic.png",        "pfx_runic",    512, False),  # 보스 룬 마법진
    (f"{CFXR}/cfxr aura rays.png",         "pfx_aura",     512, False),  # 보스 오라 광선
    (f"{CFXR}/cfxr ring arc.png",          "pfx_ring",     512, False),  # 충격파 링
    (f"{CFXR}/cfxr electric spark.png",    "pfx_elec",     256, True),   # 전기 스파크
    (f"{CFXR}/cfxr skull 2.png",           "pfx_skull",    256, True),   # 사망 해골 (헬/사망 연출)
    (f"{FW}/Star_Blue.png",                "pfx_fw_b",     256, True),   # 불꽃놀이 별 파랑
    (f"{FW}/Star_Yellow.png",              "pfx_fw_y",     256, True),   # 불꽃놀이 별 노랑
    (f"{FW}/Heart.png",                    "pfx_heart",    256, True),   # 힐 하트
    (f"{FW}/Spark_Yellow.png",             "pfx_spark_y",  128, True),   # 포탈 스파클
]
print("=== 3. VFX 텍스처 ===")
for src, key, maxside, resize in VFX:
    if not os.path.exists(src):
        print(f"MISS {src}")
        continue
    im = Image.open(src).convert("RGBA")
    if resize and max(im.size) > maxside:
        k = maxside / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    d = os.path.join(ASSET_OUT, f"{key}.png")
    im.save(d, optimize=True)
    print(f"OK  {key}.png  {im.size}  {os.path.getsize(d)//1024}KB")

print("DONE")
