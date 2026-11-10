# REBIRTH — 독립 돌진 1차 변경 검증

검증일: 2026-11-10. 기반 커밋: `3908f63d1b5fce7514a1cc8a40b1e8ecc2613c71`.

## 범위와 판정

이번 변경은 기존 GameRoot/WorldScene 진입점의 독립 돌진 코드와 자동화 테스트를 저장하는 체크포인트이다. 전체 리메이크 완료 또는 실제 플레이 합격 보고가 아니다.

- PC Shift와 모바일 `input:dash`는 동일한 진입 메서드를 사용한다.
- 기본 180ms, 700px/s, 개방 경로 총 126px. MP·쿨타임·무적·피해를 추가하지 않는다.
- 기존 S2와 저장 필드, 장비/아이템/퀘스트, 계정 및 서버 전투 코드는 보존한다.
- 에셋을 생성하거나 변경하지 않았다. 기존 걷기 애니메이션만 사용한다.
- 게임패드, 원소별 원본 FX, 기존 돌진 슬롯의 신규 공격 교체, 서버 권위 전투 및 실제 멀티플레이 동작은 미완료/미검증이다.

## 재현·수정 근거

| 문제 | 증거 / 원인 | 변경 파일 / 변경 내용 | 검증 / 결과 |
|---|---|---|---|
| 벽 접촉 상태에서 벽 반대 방향 돌진도 차단 | 추가 테스트에서 0 !== 1 실패 재현. 포함 경계 충돌식이 표면 접촉을 관통으로 해석 | `combat/freeDash.ts`: 수치 오차 허용 범위 내 표면 접촉 분리 | 벽 반대/평행 방향 허용, 벽 내부 방향 차단 테스트 통과 |
| 남은 거리에 비례한 속도 설정으로 프레임 간격에 따른 이동량 오차 가능 | 이전 코드의 잔여시간 기반 속도식 확인. 화면에서 재현한 결함은 아님 | `entities/Player.ts`: 경과 시각 기준 swept 이동, 종료 시각 상한, body reset으로 물리 좌표 동기화 | 세분/거친/지연 프레임에서 실제 Player 메서드 실행, 126px 검증 통과 |
| 돌진 연타에 의한 중복 이동·종료 후 재사용 | 실제 Player 메서드를 AST로 추출하여 엔진 포트 대역과 실행 | `Player.ts`: 진행 중 재진입 차단, 정확한 종료 시각 재사용 | 진행 중 연장 금지, 즉시 재사용 및 누적 거리 테스트 통과 |
| 입력 봉인 중 돌진 잔류 위험 | 대화/패널/수면/컷씬/채팅/physics pause 조건 확인 | `WorldScene.ts`: 공통 입력 가드와 진행 중 중단, 이벤트 해제 | 배선 계약 검사 통과. 브라우저 복원 동작은 미검증 |

## 2026-11-10 최종 자동화 실행

- `git diff --check`: 통과.
- `npx tsc --noEmit`: 종료 코드 0.
- `npm run lint:strict`: 종료 코드 0, 경고 0.
- 독립 돌진 테스트: 13개 통과. 실제 Player 메서드 실행 + 충돌 순수 함수 + 입력 소스 배선 계약. Phaser 엔진 통합/화면 테스트와 동일하지 않다.
- 전체 테스트: 호환 로더로 `tests/*.test.mjs tests/campaign/*.test.mjs` 실행, 554개 통과 / 실패 0 / 건너뜀 0, 약 91.7초.

### 테스트 실행 방식의 제한

저장소 기본 `npm test`는 `--experimental-strip-types`와 `node:module.stripTypeScriptTypes`를 요구하므로 앞선 실행에서 시작하지 못했다. 로컬 전용 호환 로더가 기존 의존성 TypeScript로 `.ts`를 변환하고, 테스트에서만 `stripTypeScriptTypes` import를 대체했다. 제품 코드 및 package.json, 기본 테스트 명령은 이 우회를 위해 바꾸지 않았다. 이전 3개 실패는 이 기능 부재에 따른 import 단계 실패였으며, 이번 호환 실행에서는 모두 통과했다.

호환 실행은 기본 런타임의 strip-only 실행과 완전히 동일하다고 보장하지 않는다. 저장소 권장 런타임에서 다음 정식 명령을 추가 확인해야 한다:

```sh
npx prisma generate
npx tsc --noEmit
npm test
npm run test:campaign
npm run lint:strict
npm run build
```

## 빌드와 화면 검증: 미합격/미수행

- 앞선 `npm run build`는 Next 빌드 단계를 마친 뒤 후처리에서 standalone `server.js`를 찾지 못해 종료 코드 1이었다. 이번 최종 검사에서는 빌드를 재실행하지 않았다. 빌드 통과로 표시하지 않는다.
- PC 실제 플레이, 모바일 배치/멀티터치, 컷씬 복원, 적/장판 피격, Phaser 물리 통합, 멀티 서버 판정, 저사양 성능, 구 세이브 복원은 이번 체크포인트에서 직접 검증하지 않았다.
- 화면 스크린샷/영상 증거 없음. 실제 플레이 합격은 후속 작업으로 남긴다.
- Drive 캐릭터 내부/라이선스 검증과 전체 80항목 감사는 미완료다. 없는 에셋을 대체 생성하지 않는다.

## 커밋 범위

코드: `src/game/combat/freeDash.ts`, `src/game/entities/Player.ts`, `src/game/scenes/WorldScene.ts`, `src/game/scenes/input/keyRegistration.ts`, `src/components/game/TouchControls.tsx`.
테스트: `tests/rebirth-free-dash.test.mjs`.
문서: `docs/rebirth/ARCHITECTURE_AUDIT.md`, 이 문서, `worklog.md`.

푸시는 변경분 저장을 위한 사용자 명시 요청에 따른다. 배포 성공, 전체 요구사항 완료 또는 화면 검증 합격을 의미하지 않는다.

## 2026-11-10 후속 — 실제 월드 온보딩 및 Craft Anything

기준을 사용자 지정 최신 `2f6f8dd0dd1ffab09be88c2501cd9c38d409d54a`로 갱신하고 그 커밋의 독립 돌진을 보존했다. 이번 범위는 기존 기본 게임의 프롤로그/실습/공용 컷씬과 로컬 분석 도구 설치다. 전체 REBIRTH/80항목 합격 보고가 아니다.

### 정식 자동화 및 빌드

- Node `v24.19.0`에서 저장소의 정식 `npm test` 실행: **570 통과 / 0 실패 / 0 건너뜀**. 앞선 문서의 임시 TypeScript 호환 로더를 사용하지 않았다.
- `npx tsc --noEmit --pretty false`: 종료 코드0. 최종 `npm run build` 안의 TypeScript 검사도 통과.
- `npm run lint:strict`: 종료 코드0, ESLint 경고0.
- `npm run build`: Prisma Client 생성 → Next 프로덕션 빌드/페이지 생성 → standalone 서버 래퍼/정적 파일 복사 → 에셋 보존 후처리까지 종료 코드0. 앞선 기록의 standalone server.js 실패를 이번 환경에서 재현하지 않았다.
- Bun이 없어 기존 Node fallback으로 후처리를 수행했다. FC 전용 socket 번들 주입은 생략되므로 빌드 성공을 원격 멀티플레이 동작 인증으로 해석하지 않는다.
- `git diff --check`: 통과. 신규 게임 의존성·신규 그래픽/오디오 생성 없음.

추가 회귀는 실제 Tutorial 클래스의 단계/실행 결과, 실제 DialogueBox 컴포넌트의 선택 경합, 실제 Drop의 자석/직접 획득, 실제 WorldScene 의뢰 메서드의 취소 및 원자적 보고 저장, 실제 공용 카메라 소유자의 live skip, 작은 화면/카메라 줌에서 실제 HUD 투영을 실행한다. 기존 Player 테스트는 새 공용 가드 메서드도 추출해 실행하며 가드를 제거한 대역으로 통과시키지 않는다.

### 실제 브라우저

`scripts/playtest-tutorial.mjs`: 스탯 변경·GM 이동 없이 정상 로비에서 새 캐릭터를 생성했다. 실제 키/선택지로 라일락 오프닝 → 이동 → 특정 NPC 대화 → 기존 수련터 전환 → 기본 공격 명중 → 실제 공격 예고 회피 → 스킬 명중 → 직접 물약 획득 → 물약 가방 열기/닫기 → 의뢰 수락 → 지정 대상 처치 → 보고/보상 → 마지막 대사 → 일반 플레이를 진행했다. **공격 실습 중 실제 페이지 새로고침 후 같은 단계로 복구하여 끝까지 진행했다.** 브라우저 JavaScript 오류0. 전체 실습 결과는 `docs/qa/2026-11-10/tutorial/full-browser.log`에 있다.

`scripts/playtest-tutorial-recovery.mjs`: 정상 전체 실행에서 얻은 로컬 저장본을 복제한 별도 fixture만 사용했다. 완료 저장, 버전 없는 구 저장, 공격/의뢰 수행/보고/끝 연출 단계의 실제 새로고침 및 건너뛰기 사례를 확인했다. 기존 보유 골드에서 건너뛰기 보상은 정확히 +500G/뽑기권+1, 단계 종료 및 물리/카메라 잠금 해제를 검사했다. 단계별 모든 skip의 중복 지급과 늦은 콜백은 클래스 실행 검사로 추가 확인했다. 개별 복구 사례의 통과 영수증은 `recovery-cases.log`에 있다.

실제 CDP 터치로 **844×390 및 390×844**에서 조이스틱 포인터를 유지한 채 두 번째 포인터로 돌진을 두 번 입력했다. MP가 줄지 않고 실제 위치가 이동했으며 버튼의 화면 내 배치, 실습 중 미니맵 숨김, 브라우저 오류0을 확인했다. 세로 진입은 게임이 제공하는 ‘세로 화면으로 계속하기’를 실제로 눌렀다. 최초 통합 QA 스크립트는 이 회전 안내를 처리하지 않아 세로 진입에서 중단되었고, 테스트 절차를 고친 후 모바일 두 사례를 다시 통과했다(`mobile-browser.log`).

세로 캡처에서 기존 HUD가 카메라 줌과 함께 확대되어 잘리는 결함을 발견했다. 최종 HUD는 역배율로 화면상 폭331px/높이84px을 유지한다. 추가 투영 회귀와 최종 프로덕션 서버에서 세로 재검사/캡처를 통과했다(`portrait-production.log`, `tutorial-mobile-390.png`). 연출의 캔버스 미니맵/퀘스트 화살표도 일반 UI와 함께 숨긴다. `tutorial-mobile-cinematic-390.png`는 공용 대화와 배우만 남긴 최종 프로덕션 화면이다.

기초 수련 때도 기존 퀘스트 패널에서 실제 1마리 의뢰를 볼 수 있도록 해당 실습의 퀘스트 창만 레벨 잠금을 우회한다. 일반 플레이의 기존 개방 레벨/저장 해금 조건은 변경하지 않는다. 수락은 특정 NPC의 기존 선택지에서 수행한다. 별도 프로덕션 fixture에서 정상 개방 레벨 미만인 캐릭터로 실제 의뢰 제목/0/1 목표 표시와 닫기를 확인했다(`quest-production.log`, `tutorial-real-quest.png`).

초기 PC 전체 흐름 캡처(`tutorial-real-opening/lilac/inventory/mission/finished.png`)는 마지막 캔버스 UI 및 세로 HUD 보정 전의 흐름 기록이다. 최종 UI 판정은 위 프로덕션 캡처와 투영 검사에 근거한다. 스크린샷은 QA 증거이며 배포용 그래픽 에셋이 아니다.

### 남은 범위

- 실기기 APK, 게임패드, 저사양 FPS, 실계정/원격 서버/라이브 다중 클라이언트는 이번 검증 범위 밖이다. 로컬 개발 서버의 인증/릴레이 API는 운영 GITHUB_TOKEN이 없어 오류를 반환했고, 튜토리얼 JavaScript 오류0은 네트워크 API 무오류를 뜻하지 않는다.
- 최초30초에 이동/공격/돌진을 모두 경험하게 하는 REBIRTH 목표는 긴 필수 오프닝과 별도 조정/측정이 필요하다.
- Drive 남녀 템플릿, 전 보스 방향, 10검식 및34장 선물, 원소별 FX/오디오/서버 전투 전체 교체는 미완료다. 상태는 `IMPROVEMENT_AUDIT_80.md`에 분리했다.
- 이번 튜토리얼에는 추가 그래픽 에셋이 필요하지 않았다. 기존 픽셀 맵/캐릭터/초상/적/물약/FX/UI를 재사용했다.
- Craft Anything0.6.0 공식 CLI의 SHA256 검증, Codex MCP 등록, doctor, stdio 도구 목록, 실제 TypeScript9개 정적 분석은 `CRAFT_ANYTHING_SETUP.md`에 별도로 기록했다. 참고 게임들의 런타임 분석을 새 도구로 모두 다시 끝냈다는 뜻은 아니다.


## 2026-11-10 KST — vc264 통합·전수 숙련·서버 복구

f760542를 통합하고 실제 원래 Player의 준비 취소/경고 진행, 전수 기술 10종의 상한 있는 숙련 및 저장·전직 창을 연결했다. 정식 테스트577개, 타입 검사·strict lint·운영과 같은 build:next 통과. PC/터치 실제 입력, 취소 후 피해/FX 제거, 정상 적중, 19→20회 숙련 및 재접속 복원을 검증했다.

운영 DB401은 유효한 fine-grained PAT로 복구했다. 온라인 공통 읽기 API200, 파티 생성/탈퇴/제거, APK 출처 OPTIONS204를 확인했으며 계정·암호화키는 유지했다. 상세 근거와 한계: [REFERENCE_AND_MASTERY.md](REFERENCE_AND_MASTERY.md). 스냅샷·JSON은 docs/qa/2026-11-10/reference-mastery/에 보존했다.
