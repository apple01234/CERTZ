# SERTZ v1.0.2 테스트 보고서 (TEST_REPORT)

날짜: 2026-09-08 · 빌드: versionCode 67 / versionName 1.0.2 · 환경: dev 서버(localhost:3000) + agent-browser 헤드리스 실측

## 1. 자동 데이터 검증 (bun scripts/validate_data.ts)

| 검사 항목 | 결과 |
|---|---|
| 중복 아이콘 그룹 | **0그룹** (수정 전 32그룹/122종) |
| price 0 일반 아이템 | **0건** (weapon_1/armor_1 포함 가격 부여, 보스 드롭 9종은 의도적 tradeLock) |
| 아이콘 파일 존재 | 전부 존재 (신규 94종 포함) |
| SHOP/BM/TRADE/DEAL 참조 | 전부 유효 (SHOP 83종) |
| 퀘스트 targetKey | 전부 유효 |
| 대사 화자 초상화 매핑 | 직접 매핑 누락 0 (보스 토큰 fallback 정상) |
| BGM 파일 40곡 | 전부 존재 |
| 챕터 보스 배치 | 9종 중복 없음 |

## 2. 컴파일/린트

- `tsc --noEmit` — 0 에러
- `eslint .` — 0 에러 0 경고
- `next build`(APK_EXPORT) — 성공

## 3. 런타임 실측 (agent-browser)

| # | 테스트 | 결과 |
|---|---|---|
| 1 | PC 2340×1080 HUD/버튼 오버플로우 | 통과 (overflow 0건) |
| 2 | 모바일 가로 — 인벤토리 패널 화면 적합 | 통과 (panelFits true, 세로 회전 프롬프트 미노출) |
| 3 | 세이브 복원 NaN 수정 | 통과 — 불완전 세이브 주입 후 "공격 42 · HP 9999/9999" 정상 복원 |
| 4 | 가방 — 자동 강화 UI/동작 | 통과 — 목표 ★10 설정, ★7→★10 도달 후 자동 종료, 배너 표시 |
| 5 | 가방 — 등급업 큐브 | 통과 — [등급업 ×2] 클릭 1회 → ×1로 정확히 1개 소모, 스탯 반영 |
| 6 | 가방 — eert 버튼 | 표시 확인 (처리 잠금은 코드 검증: 260ms 가드) |
| 7 | 시즌 패스 — 한번에 받기 | 통과 — XP 주입 후 Lv.6 도달, [한번에 받기 (6건)] 클릭 → 보상 팝업 + 버튼 소멸(중복 방지) |
| 8 | 업적 UI | 통과 — 필터 4종(전체/수령 가능/진행 중/수령 완료), 진행도 바(0/100), 수령가능 금색 강조 |
| 9 | GM 게이트 (비관리자) | 통과 — GM NPC 비주얼 4건 전부 hidden, adminRole null |
| 10 | NPC 대화 초상화 | 통과 — 주민 대화에 spum_villager_m.webp 렌더 |
| 11 | 상점 데이터 | 통과 — potion_hp6~10/mp6~10 포함(83종), 엘릭서 미포함(BM 전용) |

## 4. 서버 실측 (curl)

| # | 테스트 | 결과 |
|---|---|---|
| 1 | 관리자 가입 → role=admin | 통과 (`"role":"admin"` 응답) |
| 2 | /api/auth/me 롤 노출 | 통과 |
| 3 | GET /api/admin/summary (관리자) | 통과 — users/listings/audit 반환 |
| 4 | GET /api/admin/summary (일반 유저) | **403** |
| 5 | GET /api/admin/summary (미인증) | **403** |
| 6 | 레이트리밋 — 연속 가입 11회 | 통과 — 10회 후 429 (Retry-After 포함) |
| 7 | 감사 로그 | 통과 — db/audit.log에 register/login_fail/summary JSONL 기록 |
| 8 | 기존 /api/auth/me · /api/market 하위호환 | 통과 (guest 조회, 스냅샷 동일) |

## 5. 보스 컷씬 카메라 (코드 레벨 검증)

- `bossIntroCinematic`: 보스 pan(900ms) → `bossIntroPending` 플래그 → **대사 종료 이벤트에서만** 복귀
- 복귀 경로 3중 정합: ①정상 대사 종료(resumeFromDialogue) ②20초 자가치유 ③이미 본 대사(1.1초 홀드 후 복귀+물리 resume)
- 임시방편(WaitForSeconds류 고정 타이머 복귀) 제거 — 대사/타임라인 완료 이벤트 기준으로 상태 관리

## 6. 미실측 항목 (투명하게 기재)

- 실기기(APK 설치) 전투/결제 — Play 결제는 Play Console 상품 등록 후에만 실측 가능
- BGM 실청 — stageTrack 매핑 로직 단위 검증으로 대체(파일 존재 + 챕터 배치 표 검증)
- 851×391 초소형 가로 — 테스트 도구 뷰포트 최소값 제한으로 2340×1080 기준 실측,
  Safe Area CSS(max(env)) 적용으로 노치 대응 보완
