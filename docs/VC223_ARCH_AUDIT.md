# vc223 — `web-game-foundations` 스킬 기준 아키텍처 감사

`/web-game-foundations` 지시에 따라 스킬의 **6개 아키텍처 규칙**과 실제 코드를 대조했다.
**감사만 수행**했고 구조를 바꾸지 않았다(리팩터링은 별도 결정 사항).

## 규칙별 판정

| # | 스킬 규칙 | 판정 | 근거(실측) |
|---|---|---|---|
| 1 | 시뮬레이션과 렌더 분리 | **심각 위반** | `WorldScene.ts` **17,609줄**, 385 메서드에 11개 관심사 |
| 2 | 입력을 액션 맵으로 명시적 매핑 | **부분** | `keymap.ts` 있음(18 export)이나 `setupInput()` 이 **1,865줄** |
| 3 | 에셋 로딩을 1급 시스템으로 (매니페스트 키) | **부분** | `BootScene` 에 개별 `load.image` 25곳, 매니페스트는 `assets_dl/` 에 별도 |
| 4 | 세이브는 직렬화 가능한 시뮬레이션 상태만 | **준수** | `config.ts` 내 렌더러 타입 참조 **0** |
| 5 | 메뉴/HUD 는 DOM 오버레이 | **준수** | React 12개 컴포넌트, 캔버스 텍스트 **8개뿐** |
| 6 | 3D 런타임 규약 고정 | 해당 없음(2D) | — |

## §1. 규칙 1 — 가장 큰 문제

`src/game/scenes/WorldScene.ts` 한 파일이 **전체의 94%**(18,815줄 중 17,609줄)다.

### 385개 메서드의 관심사 분포 (실측)

| 관심사 | 메서드 수 |
|---|---|
| 이동/물리 | 65 |
| UI/HUD 배너 | 36 |
| 카메라/연출 | 32 |
| 네트워크(원격 동기화) | 30 |
| 보스 | 20 |
| 퀘스트 | 17 |
| NPC/대화 | 17 |
| 인벤/장비 | 15 |
| 전투 | 12 |
| 저장/로드 | 11 |
| 상점/경제 | 7 |
| **합계** | **262 / 385** |

스킬의 요구:
> "Simulation owns entities, turns, timers, collisions, progression, and saveable state.
>  The renderer owns scene composition, animation playback, camera, particles, and input plumbing."

지금은 **11개 관심사가 한 클래스**에 있고, 그 안에서 시뮬레이션(데미지·판정·경제)과
표현(카메라·파티클·배너)이 같은 메서드 안에서 섞인다.

### 가장 긴 단일 함수 (13개가 200줄 초과)

| 줄 수 | 함수 |
|---|---|
| **1,865** | `setupInput` |
| 827 | `createInner` |
| 550 | `update` |
| 507 | `playRemoteSkillFx` |
| 448 | `grantPrologueGrace` |
| 406 | `placeDecor` |
| 331 | `restoreFromSave` |
| 290 | `onEnemyKilled` |

`setupInput` 1,865줄은 규칙 2 위반이기도 하다 — **키 매핑 모듈은 있지만 실제 입력 처리는
씬 안에 있다.** 액션 이름은 `keymap.ts` 에 정의돼 있고, 그 액션을 받아 게임 상태를 바꾸는
로직은 전부 `setupInput` 안에 있다.

## §2. 잘 되어 있는 것 (건드리지 않음)

### 규칙 4 — 세이브 경계가 깨끗하다

`config.ts`(세이브 스키마) 안에 `Sprite`/`Text`/`Image`/`Container`/`Body` 참조가 **0건**이다.
직렬화 가능한 데이터만 저장한다는 원칙을 정확히 지킨다. `vc219` 에서 도입한
`SaveData.v` + `migrateSave()` 도 이 경계를 유지한다.

### 규칙 5 — DOM 오버레이 우선

React 컴포넌트 12개(`HUD.tsx`, `Panels.tsx`, `Overlays.tsx`, `DialogueBox.tsx` …)가
텍스트 중심 UI 를 전담하고, 캔버스 내 `add.text` 는 **8개**뿐이다. 스킬의
"text-heavy HUD, menus, settings, accessibility-sensitive controls" 를 DOM 에 두라는
지침과 일치한다.

### 규칙 3 — 부분적이나 방향은 맞다

`assets_dl/assets_manifest.json`(25KB)에 매니페스트가 있고 `build_manifest.py` 도 있다.
다만 `BootScene` 이 여전히 개별 `load.image` 25곳을 직접 호출해 **매니페스트를 우회하는
경로가 남아 있다** — 파일명이 사실상 API 가 되는 지점이다.

## §3. 왜 지금 리팩터링하지 않았나 (판단 근거)

스킬은 "Lock conventions **before** implementation starts" 라고 말한다. 이 프로젝트는
이미 57k 줄이 동작 중이고, 최근 세션에서 다음을 검증했다:

- 7개 테스트 스위트 **121 PASS**(damageModel 28, utility-ai 22, shake-a11y 21,
  hitstop 13, melee-tier 12, keyhint 10, save-migration 7, morale 8)
- `tsc` 0, `eslint --max-warnings 0` 0, `next build` 0

`WorldScene` 을 쪼개는 작업은 **모든 판정·연출 경로를 건드리는** 대규모 이동이라,
지시 없이 진행하면 회귀 위험이 검증 이득보다 크다. 감사 결과만 남긴다.

## §4. 실행한다면 — 위험도 순 (권고)

| 순위 | 작업 | 범위 | 위험 | 근거 |
|---|---|---|---|---|
| 1 | `setupInput`(1,865줄) → 입력 핸들러 모듈 분리 | 1 파일 | **낮음** | 순수 이동. 액션 이름이 이미 `keymap.ts` 에 있어 경계가 명확 |
| 2 | 원격 동기화(30 메서드) → `net/` 모듈 | 1 파일 | 낮음 | 씬 상태를 읽기만 함(`netEmitAction` 패턴) |
| 3 | 배너/토스트(36 메서드) → `fx/Notice.ts` | 1 파일 | 낮음 | 이미 `EventBus.emit("banner:show")` 단일 경로가 있음 |
| 4 | 세이브/복원(11 + `restoreFromSave` 331줄) → `save/` | 2 파일 | 중간 | `SaveData` 경계가 이미 깨끗해 이동은 쉬움 |
| 5 | 퀘스트/상점/인벤(39 메서드) → `systems/` | 3 파일 | 중간 | 상태 소유권 이전 필요 |
| 6 | 이동/물리(65 메서드) → `sim/` | 다수 | **높음** | 판정·충돌과 직결. 테스트 커버리지 부족 |

**1~3 은 순수 이동이라 테스트로 즉시 검증 가능**하다. 6 은 별도 계획이 필요하다.

## 남은 한계

- 메서드 분류는 **이름 패턴 기반 추정**이다(`hud|banner|show` 등). 실제 책임과
  어긋나는 메서드가 있을 수 있다 — 정확한 의존 그래프 분석은 하지 않았다.
- `WorldScene` 을 실제로 분리했을 때의 성능/부팅 영향은 측정하지 않았다.
- `web-game-foundations` 는 "구현 전" 스킬이라, 이미 완성된 프로젝트에 적용할 때
  어디까지가 실효적인지는 스킬이 명시하지 않는다. 이 문서의 판단은 그 공백을 메운 것이다.
