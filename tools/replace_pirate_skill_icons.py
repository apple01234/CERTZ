#!/usr/bin/env python3
"""해적 계열 7직업 스킬 아이콘 재배정 (v1.4.41 — 유저 지시 #1).

문제 (실측)
-----------
public/assets/skillicon/ 의 해적 계열 7직업이 **아이콘 8장을 돌려쓰고** 있었다:
  · pirate_s1 = raider_s1 = stormcaptain_s1 = seaking_s1   (같은 md5)
  · raider_s3 = stormcaptain_s3 = powdermaster_s3 = seaking_s3 = dreadnought_s3
  · powdermaster_s1 = dreadnought_s1, powdermaster_s2 = dreadnought_s2 …
  · corsair_s1~s4 = 178~240B 짜리 사실상 빈 파일 (이전에 도구로 생성한 흔적)
  · pirate_s3 / pirate_s4 는 파일 자체가 없음

유저 지시 #1: "아이콘 너가 만들지 말고 RPG 아이콘 팩에서만 가져다 써."

해법
----
`_assets_in/x2/RPG Icons Pixel Art/Pirate Skill Icons/PNG/Icon1~48.png` (48장)을
직업·슬롯별로 **의미 기반 1:1 배정**한다. 배정 근거는 vision_analyze 로 확인한
각 아이콘의 모티프(대포=폭발, 검=근접, 총=원거리, 배=기동 등).

  python3 tools/replace_pirate_skill_icons.py --dry-run
  python3 tools/replace_pirate_skill_icons.py --apply
"""
import argparse
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "..", "_assets_in", "x2", "RPG Icons Pixel Art", "Pirate Skill Icons", "PNG")
DST = os.path.join(ROOT, "public", "assets", "skillicon")

# 직업 → {슬롯: 아이콘 번호}. 근거: 아이콘 모티프(vision 실측) + 직업 정체성.
#  s1 = 주력기, s2 = 보조기, s3 = 광역, s4 = 이동/특수
ASSIGN = {
    # 1차 해적 — 커틀러스·권총 (기본 검격 + 사격)
    "pirate":       {1: 1,  2: 15, 3: 5,  4: 14},
    # 2차 레이더 — 약탈·돌격 (갈고리·선원 함성)
    "raider":       {1: 2,  2: 17, 3: 19, 4: 18},
    # 2차 커세어 — 커틀러스 쌍수 (검·교차 검)
    "corsair":      {1: 3,  2: 9,  3: 10, 4: 32},
    # 3차 스톰캡틴 — 폭풍 항해 (번개 대포·돛)
    "stormcaptain": {1: 23, 2: 30, 3: 31, 4: 39},
    # 3차 포더마스터 — 화약 (폭탄·산탄·불붙은 폭탄)
    "powdermaster": {1: 21, 2: 22, 3: 33, 4: 26},
    # 4차 시킹 — 대양 지배 (대포·조타·보물지도·해적기)
    "seaking":      {1: 29, 2: 43, 3: 40, 4: 24},
    # 4차 드레드노트 — 공포 (해골기·철퇴·선장)
    "dreadnought":  {1: 45, 2: 42, 3: 41, 4: 47},
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.apply and not a.dry_run:
        ap.print_help()
        return 1

    missing_src = []
    for job, slots in ASSIGN.items():
        for slot, num in slots.items():
            sp = os.path.join(SRC, f"Icon{num}.png")
            if not os.path.exists(sp):
                missing_src.append(sp)
    if missing_src:
        print("소스 누락:")
        for p in missing_src:
            print("  ", p)
        return 2

    made = 0
    for job, slots in sorted(ASSIGN.items()):
        for slot, num in sorted(slots.items()):
            sp = os.path.join(SRC, f"Icon{num}.png")
            dp = os.path.join(DST, f"{job}_s{slot}.webp")
            old = f"{os.path.getsize(dp)}B" if os.path.exists(dp) else "없음"
            if a.apply:
                # 원본을 그대로 webp 로 변환 저장 (생성·가공 금지 — 팩 그림 그대로)
                from PIL import Image
                Image.open(sp).convert("RGBA").save(dp, "WEBP", quality=95, method=6)
            print(f"  {job}_s{slot:<2} ← Icon{num:<3} (기존 {old:>8})")
            made += 1
    print(f"\n{'APPLY' if a.apply else 'DRY-RUN'} — {made}개 {'교체' if a.apply else '예정'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
