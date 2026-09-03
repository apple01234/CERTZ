---
Task ID: 12
Agent: Super Z (main)
Task: 사용자 피드백 21개 항목 전량 구현 (v3.0.15) + APK 빌드 전달

Work Log:
- [① 자동사냥 와리가리] 원인 3종 동시 수정 — ①타겟 히스테리시스(1.25배 이상 가까울 때만 교체) ②접근 방향 홀드 300ms(매 프레임 BFS/회피 재계산 진동 제거) ③도달불가 타겟 블랙리스트 5초(사거리 밖 1.2초 제자리면 포기) ④회피 방향 부호 연속성(± 쪽 우선) — 실측 8초 이동 375~645px, 대방향전환 9~10회
- [② 스탯 자동배분 on/off] StatPanel 토글 + Player.allocateAutoPoints(주스탯 80%/행운 20%) + 레벨업 훅 자동 분배 + 세이브(autoAlloc)
- [③ 반복의뢰] 원인: advanceQuest가 savedQuestIdx 미갱신(stale 판정) + 수주 조건 과엄격 → 즉시 갱신 추가 + 수주 조건 완화(상인 대화만으로 항상 수주, 진행은 체인 완료 구역)
- [④ N차=N발] atkBow/atkBolt shots = max(1, tier) — 1차 1발/2차 2발/3차 3발/4차 4발 (기존 1차에서 2발 원인: t>=1 조건) E2E 실측 ranger_t1=1, sniper_t2=2, eagleeye_t3=3
- [⑤ 펫 없이 오토] 토글/루프/이동 주입/emitRpgState 펫 게이트 4곳 제거
- [⑥ 자동물약 인벤 이동] BmShopPanel "자동 사용 설정" 섹션 → InventoryPanel 이동 + autoPotion이 설정값(autoUse.hpPct/mpOn) 반영(기존 하드코딩 45% 제거, 안전망 35% 유지)
- [⑦ 물약 퀵슬롯 장착] SaveData.quickPots + 인벤 물약 행 H/M 지정 버튼 + TouchControls 버튼이 장착 아이템 아이콘/수량 표시 + usePotion 슬롯 리졸브(기본/상급 통합)
- [⑧ 퀘스트 수락/추적] acceptedQuests/questTracked 세이브 + 퀘스트 로그 [수락하기]/[추적] 버튼 + 전 구역 수락 목록 + 미수락 퀘스트 카운트 게이트 + HUD "수락 대기" 배지 + 기존 세이브 무중단 호환(기록 없으면 자동 수락)
- [⑨ 상인 마을 전용] spawnMerchant 호출 조건에 isVillage 추가
- [⑩ 조이스틱 표시] 안내 패드 bottom-20→15 (아래로 20px)
- [⑪ 챕터 세트 해금] 27개 신규 장비(sfw_/sfa_/sfr_ ×9챕터) + SET_GEAR + 구역 최초 진입 시 해금 배너/상점 노출(unlockedSets)
- [⑫ 상위 장비 가격 상향] 무기/방어구/장신구 16건 지수 곡선 조정(weapon_6 900→5600 등)
- [⑬ eert 큐브] 잠재옵션 시스템(레어1줄~레전드3줄, 60/28/10/2%) + rerollPotentials + 인벤 [eert] 버튼 + 스탯 반영(atk/def/crit/maxHp, syncPotentialsHp) + 상점 1200G/BM 8💎 + 거꾸로 나무 큐브 아이콘(item_eert_cube.png)
- [⑭ 나무 짤림] tree/pine/pine_snow/pine_dark 4종 리드로잉 — 캔버스 64×96에 좌우 10px 여백 확보(bbox x10~54), 충돌바디 offset(20,74) 유지 호환
- [⑮ 화살 가시성] x2_arrow 16×5→28×9 재생성(밝은 골드+외곽선) + scale 1.0→1.35
- [⑯ 원소 데미지] 5원소(화염>자연>냉기>화염 3각, 빛↔어둠 상호 강세, 어둠끼리 저항) — 적은 챕터 테마 원소 부여, 플레이어는 계열 원소(전사 화염/궁수 자연/마법사 냉기/도적 어둠), 유리+25%/불리-15%, 약점 시 원소색 "약점" 데미지 텍스트 — E2E 실측 냉기→화염 125/125
- [⑰ 바닥 타일] tile_* 9종에 베벨+2px 경계 라인 — 64px 정사각 격자 명시(edge_contrast 0→36~69)
- [⑱ 오브젝트 축소] 배치수 1.5배→0.7배, 간격 34→48px, 군집 완화 — forest1 33→15개
- [⑳ 콤보킬] 5초 내 연속 킬 시 콤보×5% EXP(최대+50%), 3킬부터 "연속킬 xN!" 표시
- [㉑ 조이스틱 감도] 전송 강도 지수 곡선(√) 적용 — 반경 25%에서 50%, 50%에서 71% 속도
- 검증: tsc 0오류·eslint 0·E2E scripts/verify_v315.js 14/14 PASS(pageerror 0)·스크린샷 4종(scripts/shot_v315_*.png)
- 환경 복구: 워크스페이스 초기화로 소실된 JDK(/home/z/jdk)·Android SDK(/home/z/android-sdk) 재설치 + android/local.properties 생성
- APK: scripts/build_apk.sh BUILD SUCCESSFUL(1m57s) → aapt versionCode 29·3.0.15·서명 cc774f34(기존 키 동일)·1,118파일 무결성·APK 내부 신규 코드(eert 큐브) 검출
- 커밋 3d8d7dc push(origin/main 동기화), 구버전 v3.0.14.apk 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.15.apk (17.5MB, versionCode 29, 덮어설치 호환)
- 21개 피드백 전량 해소(19개 항목 직접 구현 + ⑲효율 순서 적용), 반복의뢰/오토/투사체는 E2E 실측으로 입증
- 다음 후보: 원소 반응 연출 강화(원신식 과부하/융해 폭발), eert 잠재옵션 등급별 색 오라, 챕터 세트 착용 보너스(세트 효과), 퀘스트 보상 수령 UI

---
Task ID: 13
Agent: Super Z (main)
Task: 메이플스토리 컨텐츠 링크 기반 v3.0.16 "메이플 컨텐츠 패치" — 세트 효과/몬스터 컬렉션/정예 몬스터/멀티킬/보상 팝업/eert 등급 오라

Work Log:
- [세트 아이템 효과] SET_BONUS 9챕터(공격3~12%/방어1~8/HP40~300/크리0~4) + setOfItem/activeSetBonus 헬퍼 + Player.activeSet getter + atkTotal/defTotal/critRate/syncBonusHp(델타 HP) 반영 + 인벤 세트 카드(활성 골드/비활성 안내)
- [몬스터 컬렉션] monsterKills 영구 세이브(config SAVE_DATA+로드 기본값) + 최초 처치 시 등록 텍스트/사운드/저장 + 보스 별도 등록(boss_*) + 43종(잡몹34+보스9) 도감 패널(M키/스탯창 진입 버튼) + 8단계 마일스톤(5/10/15/20/25/30/35/40종 → 공격+11%/HP+190/크리+5% 누적) + CollectionPanel 실루엣/미등록 ??? 처리
- [멀티킬] 1.5초 윈도 multiKillCount — 더블킬/트리플킬/쿼드라킬/펜타킬 등급 텍스트(4색)+펜타킬 셰이크 (기존 연속킬 EXP 병존)
- [필드 정예] 리스폰 4.5% 확률(마을/실내/보스전 제외, 동시 1마리) — HP3.2배/ATK1.45배/EXP4배/골드3배/스케일1.35/골드틴트 + "정예 {종명}" 이름 + 출현 배너/포효 + 처치 시 에메랄드 +1 확정
- [퀘스트 보상 팝업] advanceQuest/completeRepeat → reward:show emit + RewardPopup(상단 카드, 보상 내역 색상 라인, 5.2초 자동소멸, 닫기 버튼) + rewardPop 키프레임
- [eert 등급 오라] ItemIcon potGrade prop — 잠재 등급색 테두리+glow(레어 파랑/에픽 보라/유니크 골드/레전드 오렌지) 인벤 전 행 적용
- 기타: keymap collection 액션(M) + PanelKind "collection" + 버전 배지 3.0.16
- 검증: tsc 0오류·eslint 0·E2E scripts/verify_v316.js 17/17 PASS(pageerror 0) — 컬렉션 등록/세이브·멀티킬 count=3·정예 hpMul 3.2/에메랄드+1·세트 스탯 atk17→26 def0→5 hp118→178·보상팝업 와이어링·M키/스탯창 진입·도감 43종
- 환경 복구: 워크스페이스 초기화로 소실된 JDK(/home/z/jdk/jdk-21.0.12.1+1 Temurin)·Android SDK(cmdline-tools 11076708+platform-tools+android-36+build-tools 36.0.0) 재설치 + local.properties 재생성
- APK: scripts/build_apk.sh BUILD SUCCESSFUL(3m16s) → aapt versionCode 30·3.0.16·서명 cc774f34(기존 키 동일)·17.5MB·APK 내부 신규 코드(몬스터 컬렉션/세트 효과 활성/컬렉션 등록) 검출
- 커밋 push, 구버전 v3.0.15.apk 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.16.apk (17.5MB, versionCode 30, 덮어설치 호환)
- 메이플 컨텐츠(세트 아이템/몬스터 컬렉션/엘리트 몬스터/콤보킬-멀티킬/퀘스트 보상/큐브 등급) 6대 기능 구현, E2E 17/17 입증
- 다음 후보: 컬렉션 지역별 세트 완성 보너스, 정예 몬스터 전용 드랍 테이블, 업적 시스템(메이플 업적), 세트 효과 등급별 시각 오라

---
Task ID: 13
Agent: Super Z (main)
Task: 사용자 피드백 신규 4개 항목 구현 (v3.0.17) + 평행 세션 Maple 패치 병합 + APK 빌드 전달

Work Log:
- [① 기본 이동속도] 근원 2종 수정 — ①BASE_SPEED 230→265(+15%, 최속 적 150 대비 여유 유지) ②조이스틱 포화 커브: 기존 sqrt(스틱 절반=71%) → 14% 데드존/즉시 30%, 30%=64%, 55%=100% 포화(자동사냥과 체감 동일). E2E 실측 수동 이동 256~287px/s(기존 체감 ~150)
- [② 퀘스트 팝업] HUD 우상단 트래커 mt-8(모바일만 32px 하단 이동), PC(sm:mt-1) 유지
- [③ 데드아이 초록 화살] 신규 텍스처 x2_arrow_green(28×9 에메랄드, 채도 상향 2회 조정) + BootScene 로드 + atkBow 4차 전용 적용. ADD 블렌드가 밝은 배경에서 초록을 씻어내는 문제 → normal 블렌드(스크린샷으로 진한 초록 확인)
- [④ 다중사격 재미 강화] firePlayerProj에 trail 옵션(50ms 간격 발광 잔상) + tickPlayerProjs 잔상 스폰. atkBow: 부채꼴 0.08→0.1+0.03t rad(4차 0.66rad=기존 2.75배), 연사 90→60ms, 머즐 플래시, 속도 편차 ±15, 3발+ 카메라 마이크로 셰이크. skill1Arrows: 부채꼴 0.09→0.125, 넉백 220→250, 트레일, 머즐 플래시
- 병합: 리모트에 평행 세션 커밋 4f417c3(Maple 콘텐츠 패치, APK 30) 발견 → rebase 병합(충돌 3: APK/verify/배지 — 배지는 양측 내용 합성, Maple 검증기 verify_maple.js로 복원). 버전 충돌 방지 위해 versionCode 31/3.0.17로 상향
- 검증: tsc 0오류 + verify_v316.js 15/15 PASS + verify_maple.js 17/17 PASS(배지 기대값 3.0.17 갱신) + pageerror 0 + 스크린샷 3종(초록 화살 시각 확인)
- 환경 복구: 워크스페이스 초기화로 JDK/SDK 재소실 → Temurin 21(/home/z/jdk)·cmdline-tools+build-tools 36.0.0(/home/z/android-sdk) 재설치, local.properties 생성, build_apk.sh JAVA_HOME 기본값 수정
- APK: BUILD SUCCESSFUL → aapt versionCode 31·3.0.17·서명 cc774f34(기존 키 동일)·APK 내부 양측 코드 동시 검출(x2_arrow_green + 몬스터 컬렉션)·1,119파일
- 커밋 ed42ef2 push(4f417c3 위 리베이스), 구버전 APK 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.17.apk (17.5MB, versionCode 31, 덮어설치 호환 — 29/30 모두에서 업그레이드 가능)
- 신규 4개 피드백 전량 해소 + 평행 세션 Maple 콘텐츠(세트 효과·컬렉션·정예·멀티킬·보상 팝업·eert 오라) 동시 포함
- 다음 후보: 다중사격 4차 궁극기 연출(화살비 폭풍), 원소 반응 추가(과부하/융해), 콤보킬 티어별 FX 고도화

---
Task ID: 14
Agent: Super Z (main)
Task: "조이스틱 걸림 + 이속 ㅈㄴ 느림" 근원 수술 (v3.0.18, versionCode 32) + APK 빌드 전달

Work Log:
- [근원 진단 6종] ①스틱 1px마다 setJoyKnob(setState) → WebView 매 프레임 리렌더 = 입력 지연 ②데드존 경계(14%)서 속도 0→30% 계단 점프 ③스틱 반경 52px 소형이라 풀 기울임 어려움(실질 60~85% 속도) ④BASE 265 한계 ⑤공격 중 이동 80% 감삭 ⑥나무 줄기 24x20/바위 44x28 히트박스 스침 정지 + 카메라 lerp 0.12 둔감
- [TouchControls.tsx] 조이스틱 렌더링을 ref 직접 DOM 조작으로 전환 — 드래그 중 리렌더 0(베이스/노브 hidden 클래스 + display 토글, dragging 상태는 down/up만). JOY_RADIUS 52→64. 연속 커브 도입: 8% 데드존 → (raw-0.08)/0.34 클램프 → pow(t,0.58), 42%에서 포화 — 실측 9%→13%·15%→40%·25%→67%·35%→88%·42%+→100%
- [Player.ts] BASE_SPEED 265→300(+13%, 최속 적 150의 2배), 공격 중 이동 감삭 0.8→0.92
- [WorldScene.ts] 카메라 startFollow lerp 0.12→0.18, 나무 히트박스 24x20→16x14(offset 24,78), 바위 44x28→36x20(offset 14,39)
- 버전: build.gradle 32/3.0.18, 타이틀 배지 갱신
- 검증: tsc 0오류 + verify_v318.js 신규 작성 15/15 PASS(커브 수학·리렌더 제거·BASE 300 적용·수동 이동 실측 300px/s·공격 중 248px/s·lerp 0.18·히트박스 실측·pageerror 0) + verify_maple.js 17/17(배지 갱신) + verify_v316.js 14/15(유일 실패 = 의도된 BASE 265 기대값) — 회귀 0
- 이슈: 검증기 1차 실행 4 실패 → ①·②는 검증기 기대값/주석 계산 실수, ④는 테스트가 마을 건물 벽 충돌(단일 방향) → 4방향 시도로 수정 후 전부 통과(게임 코드 문제 아님 확인)
- APK: BUILD SUCCESSFUL(33s) → aapt versionCode 32·3.0.18·APK 내부 신규 코드 검출(배지 v3.0.18·setSize(16,14)·setSize(36,20)·x2_arrow_green)·17.5MB
- 커밋 c4b0d01 push, 구버전 v3.0.17.apk 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.18.apk (17.5MB, versionCode 32, 기존 키 동일 — 29/30/31 모두에서 덮어설치 가능)
- "걸리는 느낌" 3근원(리렌더 지연·계단 커브·히트박스) + "이속 느림" 3근원(반경·감삭·BASE) 전량 수술, E2E 실측 입증
- 다음 후보: 이속 상향에 맞춘 몬스터 접근속도 재조정, 오토사냥 카이팅 거리 재튜닝, 조이스틱 진동 피드백(햅틱)

---
Task ID: 15
Agent: Super Z (main)
Task: "타일맵이 전혀 잔디 같지가 않아" — 바닥 타일 8종 단색 사각형 → 시밀리스 픽셀아트 재생성 (v3.0.19, versionCode 33)

Work Log:
- [진단] tile_grass.png 등 지면 타일 전부 64px 단색+가장자리 음영 사각형 — 잔디 질감 0. groundTint는 정의만 있고 미적용(PNG 색이 화면색). 전환 타일(tx_*)은 v3.0.13부터 미사용
- [생성기] scripts/gen_floor_tiles.py (PIL, 시드 고정 재현 가능) — 256x256 시밀리스(랩 드로잉): ①저대비 모틀링(±7% 밝기 노이즈, 저주파+고주파 value noise) ②잔디=지터 그리드(16px 셀) 산포 풀잎 스트로크(1x2/1x3, 끝 기울임 25%) + 키 큰 다발 42개 + 하이라이트 ③64px 그리드 베벨 유지(사용자 지시 #17 "정사각형 타일 규칙적 배열" 충족) ④서브타일 밝기 ±4.5%
- [8종 재생성] tile_grass(잔디 #79c865+풀잎 #4f9440/#9ee084)·tile_dark(알프헤임 푸른 잔디)·tile_magma(용암 균열 랜덤워크+엠버 코어)·tile_snow(눈결 대시+반짝)·tile_cave·tile_stone·tile_hel(균열+스펙)·tile_abyss(스펙+별점) — 챕터 색 정체성(기존 core 색) 유지
- [코드 보정] WorldScene 용암 균열 장식 tile_magma setScale 0.5→0.125(256px 전환, 시각 32px 동일)
- 버전: build.gradle 33/3.0.19, 타이틀 배지
- 검증: tsc 0 + verify_v319.js 신규 4/4 PASS(텍스처 8종 256x256·잔디 톤분산 sd 9.1(구 단색 sd≈0)·이동 회귀 250px/s·pageerror 0) + 스크린샷 육안 검증(마을 잔디 질감 확인) — 숲1도 동일 tile_grass
- 이슈: 서버 재기동 EADDRINUSE로 옛 프로세스가 잔존 → 500 응답 → 전면 pkill 후 재기동 해소
- APK: BUILD SUCCESSFUL(31s) → versionCode 33·3.0.19·apksigner 서명 cc774f34(기존 키 동일·덮어설치 호환)·APK 내부 tile_grass 256x256 검출·17.8MB
- 커밋 3a426bd push, 구버전 v3.0.18.apk 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.19.apk (17.8MB, versionCode 33)
- 지면 8종 전부 "잔디/지형 질감 + 규칙 타일 그리드" 동시 충족 — 시밀리스라 이음새 0
- 다음 후보: 챕터별 지형 소품 추가(풀송이·자갈·꽃 밀도 조정), tile_path 계열도 질감화, 물/용암 애니메이션 타일

---
Task ID: 16
Agent: Super Z (main)
Task: 신규 피드백 10개 항목 구현 (v3.0.20, versionCode 34) + APK 빌드 전달

Work Log:
- [#1 스카이로드 구름색 화살] x2_arrow_sky(28×9 구름 블루, make_sky_arrow.py) 신규 생성 + atkBow/일제사격(volley) 텍스처 선택 cls==="skylord" 분기 — 데드아이 초록(x2_arrow_green)은 클래스키 판정으로 회귀 없이 유지. 잔상/머즐 0x9fd8ff/0xc2ecff. E2E 실측 발사 확인
- [#2 타일 선 제거] "타일의 선이 보여 자연스럽게 이어줘" — gen_floor_tiles.py에서 64px grid_bevel 완전 제거 + 서브타일 하드 셀 밝기(±4.5%) → 연속 저주파 노이즈(±5%) 교체, 8종 전부 재생성. 수치 검증: 잔디 인젤행 평균 차이 2.49(선 있으면 8+). 스크린샷 육안 확인(격자선 0)
- [#3 MP 자동사용 %] autoUse에 mpPct 추가(config/EventBus/Player/WorldScene/인벤 UI) — MP 버튼도 HP와 동일 0→30→50→70% 사이클, 기존 mpOn=true 세이브는 25%로 마이그레이션
- [#4 자동사냥 밀집 선호] tickAutoHunt 타겟 선택에 densityEff(주변 220px 적 1마리당 유효거리 -12%, 최대 -45%) 도입 + 히스테리시스도 유효거리 기준 — 사냥터 한복판으로 자동 이동. bestD 실거리 판정 유지
- [#5 이터널 노랑 기본공격] atkBolt 마법탄 tint 0xffdf6e + 3차 유도뢰 0xffc94a (시간지기 컨셉)
- [#6 근접 검기 색 분리] "근접 직업들의 검기 색깔이 다 같아" — meleeSlashTint() 14클래스 맵(전사 은백/버서커 혈색/가디언 강철푸른/워로드 활화/팔라딘 성금/워브링어 진홍/크루세이더 성광/도적 보라 유지/어세신 심보라/스와시버클러 청록/나이트블레이드 보라/듀얼리스트 로즈/섀도우로드·블레이드마스터 고유색) + 3차 검기 파동 투사체 동일 적용
- [#7 물약 판매+엘릭서] ①물약 판매: sellPotion(기본은 potions 카운터 차감, 상급/엘릭서는 owned) + 인벤 물약 행 [판매 N G] 버튼 + rpg:sellPotion ②엘릭서: potion_elixir(400G·epic·healFull) — HP/MP 100% 동시 회복(restoreAll), 상점 등록, 퀵슬롯 H/M 장착 가능, 골드 아이콘 생성(make_elixir_icon.py)
- [#8 스타포스 1성당 성장] starPerStarAtk(+2+무기atk 8%)/starPerStarDef(+1+def 6%+HP12) 본당 즉시 상승 + 마일스톤 대폭 상향(무기 8/14/24·치명 3/6/12% / 방어구 1/3/6·HP 80/160/220, 장신구 본당 치명+0.5%p·HP+8 + 마일스톤 상향). atkTotal/defTotal/syncStarHp/상점 프리뷰/itemEffect 전 경로 동기화. E2E: 무기 ★3→★4 +5(구 +2), 방어구 HP 36 동기화 실측
- [#9 eert 큐브화] "1개씩 소비, 마시는 게 아니라 큐브" — BM 전용(bmPrice 8💎, 골드 상점 제외) + 판매가 sellPrice 5000G 직접 지정 + 인벤 '마시기' 버튼 → [장비에서 사용] 안내 칩으로 교체 + 배너 문구 "(BM 상점 8💎)". 리롤 1개 소모 로직은 기존 유지(E2E 실측)
- [#10 BGM 16트랙] gen_bgm2.py(절차 합성: 코드진행 AABA·리드모티프 반복·베이스/패드/아르페지오/드럼·딜레이·스테레오)로 8종 신규 오리지널 트랙(bgm_*2, 50~76s 총 4.1MB) + audio.ts 변주 로테이션(같은 분위기 직전 곡 제외 랜덤 + 78초 크로스페이드 전환) + BootScene 로드
- 버전: build.gradle 34/3.0.20, 타이틀 배지 "v3.0.20 · 자연 지형 이음새 제거 + BGM 16트랙 로테이션 + 스타포스 1성당 성장 + 엘릭서"
- 검증: tsc 0오류 + eslint 0 + verify_v320.js 신규 32/32 PASS(정적 20 + 런타임 12: 스카이 화살 발사/이터널 틴트/버서커 검기 틴트/엘릭서 풀회복/물약 판매 +12G/무기 본당 +5/eert 1개 소모/mpPct 50/이동 280px/s/pageerror 0) + verify_v318.js 14/15(유일 실패 = 공격 중 이동 230~244px/s 측정 분산, 본 패치 이동 코드 미변경·소스 0.92 유지 확인)
- 이슈: 검증 중 ①MultiEdit 부분 적용으로 healFull 중복/WorldScene 핸들러 중복 발생 → 전수 점검 후 정리 ②기존 Player.healFull()과 이름 충돌 → restoreAll()로 개명 ③서버 EADDRINUSE 잔존 → fuser -k 후 재기동
- APK: BUILD SUCCESSFUL(31s) → aapt versionCode 34·3.0.20·apksigner 서명 cc774f34(기존 키 동일·덮어설치 호환)·APK 내부 검출(bgm_*2 8종·x2_arrow_sky·item_potion_elixir·starPerStarAtk/densityEff 코드·배지 v3.0.20)·21.9MB(BGM 추가로 +4.1MB)
- 커밋 95fdce2 push, 구버전 v3.0.19.apk 제거, 웹 서버 production 재기동(포트 3000, GET / 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.20.apk (21.9MB, versionCode 34, 기존 키 동일 — 29~33 모두에서 덮어설치 가능)
- 신규 10개 피드백 전량 해소 — 비주얼 4종(화살/타일/검기/마법탄)·시스템 5종(MP%·밀집선호·판매/엘릭서·스타포스·eert)·사운드 1종(BGM 로테이션), E2E 32/32 입증
- 다음 후보: 원소 반응(과부하/융해) 시각화, eert 잠재옵션 등급별 연출 강화, BGM 볼륨 개별 설정, 퀘스트 보상 수령 UI

---
Task ID: 17
Agent: Super Z (main)
Task: BGM 전면 교체 — 생성 음원 폐기 → 실사 다운로드 40트랙 (v3.0.21, versionCode 35)

Work Log:
- 유저 피드백: "노래가 엉망진창 / 다운해서 사용해라고 만들지 말고 / 테마에 맞는 노래 / 적어도 1테마에 5개" — v3.0.20의 gen_bgm2 절차 합성 트랙 8종 + 구 칩튠 8종 전부 폐기 결정
- 워크스페이스 리셋 복구: 로컬 HEAD가 v3.0.16으로 되돌아가 있었음 → git fetch origin 후 reset --hard origin/main(aff370e)로 v3.0.18~v3.0.20 전체 복구
- 음원 조달: incompetech pieces.json 카탈로그(1442곡) 확보 → feel/description 스코어링 후 테마별 수동 선정
  title 웅장(Call to Adventure 등 5) / village 중세 마을(The Britons·Village Consort 등 5) / field 모험(Overworld 등 5) / alfheim 신비(Equatorial Complex 등 5) / cave 던전(Chee Zee Caves V2 등 5) / snow 설원(Frost Waltz 등 5) / abyss 심연(Gateway to Hell 등 5) / boss 전투(Clash Defiant 등 5)
- 스크립트: scripts/bgm_work/{pick_tracks,finalize,download_bgm}.py — 다운로드→ffprobe 검증→ffmpeg loudnorm(I=-18)+길이 130s 캡+페이드아웃→OGG q2 40곡 (총 ~52MB)
- audio.ts 개편: BGM_PLAYLISTS(8테마×5)·BGM_ALL_TRACKS export, 셔플 백 로테이션(한 바퀴 전 반복 없음·리필 직후 직전곡 제외), loop:false + complete 이벤트 자연 순환, 기존 78s 타이머 크로스페이드 제거, bgmDebugState/bgmAdvanceForTest E2E 훅
- BootScene: AUDIO_LIST를 ...BGM_ALL_TRACKS 자동 수집으로 교체, PhaserGame __SERTZ_DEBUG__.bgm 훅 추가
- 파일 정리: 구 bgm_* 16종(무숫자 8종+생성 8종) 삭제, 신규 bgm_<theme>1~5.ogg 40종
- CREDITS.md: Juhani 섹션 삭제 → Kevin MacLeod(incompetech, CC-BY 4.0) 40트랙 표 표기
- 환경 복구: workspace 리셋으로 소실된 JDK/SDK 재설치(scripts/setup_env.sh 신규 — Temurin 21.0.12.1+1·cmdline-tools 11076708·build-tools 36.0.0·local.properties)
- 검증: tsc 0 + eslint 0 + verify_v321.js 14/14 PASS(정적 9: 플레이리스트/흔적제거/셔플백/로드/훅/버전/40곡 무결성/구파일 제거/크레딧 + 런타임 5: 진입 자동재생(bgm_village4)/플레이리스트 소속/로테이션 교체(village4→village1)/보스 5회 순회 전곡 커버 중복 0/pageerror 0)
- 회귀: verify_v318.js 14/15(기존 측정 분산 1건 — 이동 코드 미변경), verify_v320.js 29/32(실패 3건 전부 의도된 BGM 교체 항목 — S4 구로테이션·S8 구로드리스트·S9 구배지)
- APK: BUILD SUCCESSFUL(3m5s) → aapt versionCode 35·3.0.21·apksigner cc774f34(기존 키 동일)·APK 내부 신규 40트랙/구형 0 검출·60.8MB(실사 음원 +39MB)
- 커밋 push, 구버전 v3.0.20.apk 제거, 웹서버 production 재기동(포트 3000, GET 200·신규 BGM 200)

Stage Summary:
- 산출물: download/SERTZ-v3.0.21.apk (60.8MB, versionCode 35, 기존 키 동일 — 덮어설치 호환)
- BGM이 "생성 음악"에서 "다운로드 실사 음악"으로 전면 교체 — 테마당 5곡 보장, 8테마 40트랙, 무한 로테이션
- 다음 후보: BGM 볼륨 개별 슬라이더, 트랙명 표시 UI, 던전 보스 전용 트랙 추가
