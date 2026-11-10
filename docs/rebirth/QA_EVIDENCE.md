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
