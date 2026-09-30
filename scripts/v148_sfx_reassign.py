#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4.8 — 기능별 사운드 분리 (#6): sfx_quest 38중복·sfx_coin 15중복 해소 재배치 스크립트.
줄번호 기반이되 교체 전 해당 줄이 기대한 기존 호출을 담고 있는지 검증한다 (드리프트 방지)."""
import sys

WS = "src/game/scenes/WorldScene.ts"
PL = "src/game/entities/Player.ts"

# (파일, 줄번호(1-based), 기존 토큰, 새 호출)
EDITS = [
    # ── WorldScene.ts ──
    (WS, 1231, "questDone", "audio.sfx.ach();"),            # 장비 세트 해금 → 업적 팡파레
    (WS, 2126, "questDone", None),                           # 결정 조각 수집 — pickup과 이중 재생 제거
    (WS, 2669, "coin", "audio.sfx.chest();"),                # 유적 상자 → 상자 개봉음
    (WS, 2379, "uiOpen", "audio.sfx.deny();"),               # 레벨게이트 차단 — 열기음 재활용 해제
    (WS, 3453, "questDone", "audio.sfx.pickup();"),          # 장비 드롭 → 월드 픽업 패밀리
    (WS, 3756, "questDone", "audio.sfx.reward();"),          # 침공 격퇴 보상
    (WS, 3865, "questDone", "audio.sfx.reward();"),          # 황금몹 대량 골드
    (WS, 4106, "questDone", "audio.sfx.reward();"),          # 훈련장 보상
    (WS, 4209, "questDone", "audio.sfx.levelup();"),         # 패스 레벨업 → 성장음
    (WS, 4256, "questDone", "audio.sfx.reward();"),          # 미션 완료 순간
    (WS, 4279, "questDone", "audio.sfx.reward();"),          # 미션 수령
    (WS, 4308, "questDone", "audio.sfx.reward();"),          # 출석 체크
    (WS, 4327, "questDone", "audio.sfx.reward();"),          # 광고 경험치 보상
    (WS, 4342, "coin", "audio.sfx.reward();"),               # GM 방송 시청 완료
    (WS, 4377, "questDone", "audio.sfx.reward();"),          # 도감 보상
    (WS, 4411, "equip", "audio.sfx.craft();"),               # 룬 합성 → 제작음
    (WS, 4454, "equip", "audio.sfx.craft();"),               # 성좌 개방 → 제작음
    (WS, 4493, "questDone", "audio.sfx.reward();"),          # 일일 퀘스트 수령
    (WS, 4513, "questDone", "audio.sfx.reward();"),          # 쿠폰 사용
    (WS, 4545, "coin", "audio.sfx.shop();"),                 # 스킨 획득(구매) → 상점음
    (WS, 4563, "equip", "audio.sfx.upgradeOk();"),           # 장비 등급업 → 모루 성공음
    (WS, 4829, "coin", "audio.sfx.cardHeal();"),             # 수비전 상태 카드(회복) → 회복 시전음
    (WS, 4883, "questDone", "audio.sfx.reward();"),          # 바르가 수비전 결과
    (WS, 5078, "questDone", "audio.sfx.reward();"),          # 심연의 탑 층 클리어
    (WS, 5213, "questDone", "audio.sfx.reward();"),          # 몬스터 파크 결과
    (WS, 5289, "questDone", "audio.sfx.reward();"),          # 몬스터 파크(두 번째 팝업)
    (WS, 5324, "questDone", "audio.sfx.reward();"),          # 심층 균열 결과
    (WS, 5458, "bossDie", "audio.sfx.deny();"),              # 제작 재료 부족 → 차단음
    (WS, 5469, "coin", "audio.sfx.craft();"),                # 심연 제작 완료 → 용광로음
    (WS, 5481, "bossDie", "audio.sfx.deny();"),              # 심연 코인 부족 → 차단음
    (WS, 5511, "coin", "audio.sfx.shop();"),                 # 심연 각인(구매) → 상점음
    (WS, 5522, "questDone", "audio.sfx.questAccept();"),     # 5차 각성 시련 시작 → 수락음
    (WS, 5694, "questDone", "audio.sfx.reward();"),          # 반복 토벌 완료
    (WS, 5734, "questDone", "audio.sfx.reward();"),          # 컬렉션 등록
    (WS, 6385, "roar", "audio.sfx.bossDrop();"),             # 보스 드롭 스폰 → 빛 폭발 (포효와 구분)
    (WS, 6526, "questDone", "audio.sfx.shop();"),            # 마을 상점 구매(골드) → 상점음
    (WS, 6687, "questDone", "audio.sfx.charge();"),          # 광고 젬 충전 → 충전음
    (WS, 6716, "questDone", "audio.sfx.charge();"),          # 스토어 젬 충전 → 충전음
    (WS, 6739, "coin", "audio.sfx.charge();"),               # 현금 패키지 구매 → 충전음
    (WS, 6757, "questDone", "audio.sfx.shop();"),            # 패스 프리미엄 구매 → 상점음
    (WS, 6781, "questDone", "audio.sfx.reward();"),          # 패스 보상 수령
    (WS, 6813, "questDone", "audio.sfx.reward();"),          # 패스 한번에 받기
    (WS, 6826, "questDone", "audio.sfx.charge();"),          # 구독 결제 → 충전음
    (WS, 6853, "questDone", "audio.sfx.chest();"),           # 광고 상자 → 상자음
    (WS, 6876, "questDone", "audio.sfx.reward();"),          # 광고 드롭 버프
    (WS, 7015, "questDone", "audio.sfx.pickup();"),          # 경험치 책 사용 → 아이템 사용음
    (WS, 7038, "questDone", "audio.sfx.pickup();"),          # 성장의 책 사용
    (WS, 7346, "questDone", "audio.sfx.chest();"),           # BM 상자/패키지 개봉 → 상자음
    (WS, 7368, "equip", "audio.sfx.shop();"),                # BM 상점 구매 → 상점음
    (WS, 7389, "questDone", "audio.sfx.chest();"),           # 가방 상자 개봉 → 상자음
    (WS, 7431, "equip", "audio.sfx.shop();"),                # 거래소 구매 → 상점음
    (WS, 7533, "questDone", "audio.sfx.questAccept();"),     # 퀘스트 수락 → 수락음
    (WS, 7577, "coin", "audio.sfx.shop();"),                 # 유저 거래판 구매(골드 지출) → 상점음
    (WS, 7596, "coin", "audio.sfx.sell();"),                 # 정산금 수령 → 판매음
    (WS, 7619, "coin", "audio.sfx.charge();"),               # 티켓 재충전 → 충전음
    (WS, 7668, "coin", "audio.sfx.shop();"),                 # 유니온 상점 → 상점음
    (WS, 7690, "coin", "audio.sfx.shop();"),                 # 파크 상점 → 상점음
    (WS, 7753, "equip", "audio.sfx.shop();"),                # 랭커의 증표 구매 → 상점음
    (WS, 8089, "portal", "audio.sfx.torch();"),              # 횃불 점화 → 점화음
    (WS, 10115, "questDone", "audio.sfx.questAccept();"),    # 전직 시련 시작 → 수락음
    (WS, 10141, "questDone", "audio.sfx.reward();"),         # 전직 시련 보상
    (WS, 11726, "questDone", "audio.sfx.ach();"),            # 챕터 카드 → 팡파레
    (WS, 11943, "questDone", "audio.sfx.reward();"),         # 토벌 의뢰 완료
    # ── Player.ts ──
    (PL, 3949, "coin", "audio.sfx.sell();"),                 # 장비 판매 → 판매음
    (PL, 4167, "coin", "audio.sfx.sell();"),                 # 장신구 판매 → 판매음
    (PL, 4186, "coin", "audio.sfx.shop();"),                 # 거래판 구매 → 상점음
    (PL, 4206, "coin", "audio.sfx.sell();"),                 # 거래판 판매 → 판매음
]

def main():
    files = {}
    ok = 0
    fail = []
    for path, ln, old, new in EDITS:
        if path not in files:
            with open(path, encoding="utf-8") as f:
                files[path] = f.readlines()
        lines = files[path]
        idx = ln - 1
        cur = lines[idx]
        # 기존 호출 검증 (들여쓰기 무시)
        stripped = cur.strip()
        if f"audio.sfx.{old}()" not in stripped:
            fail.append((path, ln, old, stripped))
            continue
        if new is None:
            # 삭제(이중 재생 제거) — 빈 줄로
            lines[idx] = "\n"
        else:
            indent = cur[: len(cur) - len(cur.lstrip())]
            lines[idx] = f"{indent}{new}\n"
        ok += 1
    for path, data in files.items():
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(data)
    print(f"OK {ok}/{len(EDITS)}")
    for f in fail:
        print("FAIL:", f)
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
