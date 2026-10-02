#!/usr/bin/env python3
"""텍스처 키 전수 감사:
1) BootScene의 부트 로드 목록 키 추출
2) src 전체에서 add.image/sprite/particles/pick("...") 등으로 쓰이는 키 후보 추출
3) public/assets에 파일이 있는데 부트 목록에 없는 키 = 잠재적 __MISSING 위험"""
import re, os

SRC = "/home/z/my-project/src"
PUB = "/home/z/my-project/public/assets"

# 1. BootScene 로드 목록 (배열 리터럴 안의 문자열들)
boot = open(f"{SRC}/game/scenes/BootScene.ts").read()
# BootScene 상단의 큰 배열들: ["key1", "key2", ...]
boot_keys = set(re.findall(r'"([A-Za-z0-9_]+)"', boot))

# 2. assets 폴더의 실제 파일 키
asset_keys = set()
for fn in os.listdir(PUB):
    for ext in (".webp", ".png"):
        if fn.endswith(ext):
            asset_keys.add(fn[: -len(ext)])
            break

# 3. 코드 전역에서 텍스처 키 후보: 문자열 리터럴 중 asset_keys와 일치하는 것
used = set()
for dirpath, _, files in os.walk(f"{SRC}/game"):
    for fn in files:
        if not fn.endswith(".ts"):
            continue
        code = open(os.path.join(dirpath, fn)).read()
        for m in re.finditer(r'"([A-Za-z0-9_]{2,40})"', code):
            used.add(m.group(1))

# 4. 코드에서 쓰이고 파일도 있는데 부트 목록에 없음
risky = sorted(used & asset_keys - boot_keys)
print("== 코드에서 사용 + 파일 존재 + BootScene 미등록 ==")
for k in risky:
    print(" ", k)
print(f"count: {len(risky)}")

# 5. 코드에서 쓰이는데 파일도 부트목록에도 없는 키 (완전 누락)
ghost = sorted(used - asset_keys - boot_keys)
# 노이즈 제거: 너무 짧거나 동사형 등은 무시 (휴리스틱)
ghost = [g for g in ghost if "_" in g and not g.startswith(("0x", "http"))]
print("\n== 코드에서 사용 + 파일/부트 모두 미확인 (고스트 키) ==")
for g in ghost[:40]:
    print(" ", g)
print(f"count: {len(ghost)}")
