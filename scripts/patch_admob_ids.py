#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AdMob 실제 ID 1발 교체 스크립트 (v1.0.2-beta)

사용법:
  python3 scripts/patch_admob_ids.py ca-app-pub-5675573589406258~1234567890 ca-app-pub-5675573589406258/0987654321
  (인자1: AdMob 콘솔의 [앱 ID], 인자2: [보상형 광고 단위 ID] — 콘솔 홈 → 앱 → 광고 단위)

교체 대상 (구글 공식 테스트 ID가 박혀 있는 곳 전부):
  1. android/app/src/main/AndroidManifest.xml — APPLICATION_ID (테스트 ca-app-pub-3940256099942544~3347511713)
  2. src/game/ads.ts — ADMOB_REWARDED_ID (테스트 ca-app-pub-3940256099942544/5224354917)

주의:
  · 앱 ID가 실제 등록된 것과 한 글자라도 다르면 앱이 즉시 사망한다(IllegalStateException).
    → 콘솔에서 복사한 값을 그대로 붙여넣을 것.
  · 교체 후 다음 빌드부터 반영 (scripts/build_aab.sh).
  · ads.txt/app-ads.txt는 이미 퍼블리셔 ID(pub-5675573589406258)로 반영 완료 — 이 스크립트와 무관.
"""
import re
import sys

TEST_APP = "ca-app-pub-3940256099942544~3347511713"
TEST_UNIT = "ca-app-pub-3940256099942544/5224354917"

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    app_id, unit_id = sys.argv[1].strip(), sys.argv[2].strip()
    ok = True
    for pat, name in [
        (r"^ca-app-pub-\d+~\d{10}$", "앱 ID ( ca-app-pub-…~… )"),
        (r"^ca-app-pub-\d+/\d{10}$", "광고 단위 ID ( ca-app-pub-…/… )"),
    ]:
        if not re.match(pat, app_id if "~" in sys.argv[1] else unit_id):
            pass
    if not re.match(r"^ca-app-pub-\d+~\d{9,12}$", app_id):
        print(f"!! 앱 ID 형식이 이상해요: {app_id} — {name_err('앱')}")
        ok = False
    if not re.match(r"^ca-app-pub-\d+/\d{9,12}$", unit_id):
        print(f"!! 광고 단위 ID 형식이 이상해요: {unit_id}")
        ok = False
    if not ok:
        sys.exit(1)

    targets = [
        ("android/app/src/main/AndroidManifest.xml", TEST_APP, app_id),
        ("src/game/ads.ts", TEST_UNIT, unit_id),
    ]
    for path, old, new in targets:
        s = open(path, encoding="utf-8").read()
        if old not in s:
            if new in s:
                print(f"  = {path}: 이미 교체됨")
                continue
            print(f"  ? {path}: 테스트 ID 미발견 — 수동 확인 필요")
            continue
        open(path, "w", encoding="utf-8").write(s.replace(old, new))
        print(f"  ✓ {path}: {old} → {new}")
    print("\n완료 — 다음 빌드(scripts/build_aab.sh)부터 실제 광고가 송출됩니다.")

def name_err(k):
    return "콘솔 형식: ca-app-pub-XXXXXXXXXX~NNNNNNNNNN"

if __name__ == "__main__":
    main()
