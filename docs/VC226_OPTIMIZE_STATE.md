# vc226 — 최적화 결과와 GameState 1단계

지시: **"최적화 우선 방식으로 ㄱㄱ"** → 3번(FA 최적화) → 1번(GameState) → 2번(에셋 조사)

---

## 3. FA 로딩 최적화 — **완료**

### 측정한 낭비

| 항목 | 실측 |
|---|---|
| `fa-p2`/`fa-p3` 를 참조하는 코드 | **0곳** |
| 그런데 로드되던 프레임 | **180개** (FA 전체의 67%) |
| 부팅 전체 요청 | 약 1,032개 |
| FA 비중 | **26%** (268개) |

`Player` 는 `fa-p1-*` 키만 쓴다. p2/p3 아트는 파일로만 존재하고 아무도 안 읽는데
매 부팅마다 180개 요청이 나가고 있었다.

### 조치

1. **p2/p3 로드 제거** — 파일은 `public/assets/fa/p2·p3` 에 그대로 남겨둠
   (캐릭터 선택에 붙일 때 로드하면 된다. 지금 안 쓰는 것을 부팅에 얹을 이유가 없다)
2. **개별 PNG 268장 → 아틀라스 1장**
   - `tools/pack_fa_atlas.py` 로 `public/assets/fa/p1.png`(1024×510) + `p1.json` 생성
   - 프레임 이름은 JSON 에 원래 키(`fa_p1_idle__0`) 그대로 → 코드 참조 방식만 변경
   - **색 손실 없음**: 리샘플·양자화 없이 픽셀을 그대로 격자 배치. 여백이 투명이라
     한 장에 모으면 반복 영역이 한 번만 저장된다

### 결과

| | 전 | 후 | 감소 |
|---|---|---|---|
| FA 요청 | 448개 | **2개** | -99.6% |
| FA 바이트 | 514KB | 102KB | **-80%** |
| **부팅 전체 요청** | 1,032 | **586** | **-43%** |

### 검증 (브라우저 실측)

```
초기   anim=fa-p1-idle  tex=fa_p1  frame=fa_p1_idle__2  scale=1.17
걷기   anim=fa-p1-run   tex=fa_p1  frame=fa_p1_run__0   vx=240
정지   anim=fa-p1-idle  tex=fa_p1  frame=fa_p1_idle__0
```

텍스처키가 `fa_p1`(아틀라스 단일)이고 프레임이 JSON 좌표대로 추출된다.
아틀라스 프레임 **89개**(88프레임 + `__BASE`).

---

## 1. GameState 1단계 — **완료**

### 왜 1단계만 했나

`docs/VC225_REFACTOR_1_6.md` 에서 리팩터링 4~6 을 멈춘 이유는 상태가 씬에 흩어져
있어서였다(`restoreFromSave` 330줄이 씬 멤버 **87개** 직접 사용).

83개 필드를 `this.state.x` 로 **일괄 치환하면** 17,000줄에 걸친 수백 곳이 바뀌고,
한 곳만 틀려도 진행도/세이브가 **조용히** 깨진다. 그건 리팩터링이 아니라 도박이다.

그래서 3단계로 나눈다:

| 단계 | 내용 | 위험 | 상태 |
|---|---|---|---|
| **1** | 상태 **정의 + 미러** (아무도 안 읽음) | **0** | **완료** |
| 2 | `buildSave`/`restoreFromSave` 를 GameState 기준으로 이전 | 중간 | 대기 |
| 3 | 읽는 쪽을 파일 단위로 치환 | 낮음(분할) | 대기 |

### 만든 것

`src/game/state/gameState.ts` — `GameState` 타입 + `createGameState()`.

- 필드 이름은 `WorldScene` 과 **1:1** (같은 이름을 쓴다 — 2단계 치환과 세이브 스키마 정합)
- `InfState` 등 하위 타입은 여기서 다시 선언한다. 이유: 이 모듈이 `infinite.ts` 를
  import 하면 `infinite → gameState → WorldScene` 순환이 생긴다. 대신 테스트가
  실제 소스에서 필드명을 뽑아 대조한다.

`WorldScene.syncStateMirror()` — `restoreFromSave` 끝에서 한 번 호출해 미러를 채운다.
**아직 읽는 쪽은 기존 필드 그대로**라 동작 변화가 없다.

배열/객체는 **얕은 복사**로 넣는다. 참조를 그대로 넘기면 씬이 새 배열을 할당했을 때
미러가 옛 배열을 붙들고 있게 된다.

### 검증 — `tests/gamestate.test.mjs` 21 PASS

| 검사 | 결과 |
|---|---|
| 최상위 필드 47개가 양쪽에 존재 (오타로 유령 필드 방지) | PASS |
| 스칼라 23개 초기값이 WorldScene 선언과 일치 | PASS |
| 배열/객체/Set 기본값 일치 | PASS |
| `InfState` 필드가 `InfSave` 와 일치 (11개) | PASS |
| `syncStateMirror` 존재 + 호출 + **할당 52개** | PASS |
| `createGameState()` 가 매번 새 객체 (공유 참조 방지) | PASS |

**왜 초기값 일치를 테스트하나**: 다르면 2단계에서 새 게임 시작 시 진행도가 어긋난다.
**왜 할당 개수를 세나**: 미러가 절반만 채우면 2단계에서 조용히 stale 값을 읽는다.

---

## 2. 남은 에셋 조사 — **완료 (쓸 것 없음)**

상세: `docs/VC226_REMAINING_ASSETS.md`

| 영역 | 크기 | 판정 |
|---|---|---|
| sonniss | 897M | **부적합** — WAV 46개뿐, 전부 수 분짜리 환경음(비 254M·기차 234M) |
| uni / Toon Shaders | 26M | **불가** — Unity ShaderLab, Phaser 와 무관 |
| uni / Classic_RPG_GUI | 131M | **불가** — React DOM UI 와 충돌 |
| uni / HeroEditor4D | 116M | **불가** — 레이어 합성 파츠 (현 파이프라인과 상이) |
| x1 / PuzzleLevelMapPack | 1.7G | **불가** — 퍼즐 장르 맵 메이커 |

**11.2GB 중 새로 쓸 수 있는 자산은 사실상 없다.** 이미 뽑아 쓴 것
(FA 팩, Warrior 세트, VFX 프리렌더 19개)이 실질 전부였다.

큰 폴더 3곳이 모두 안 맞은 이유는 용량이 아니라 **적합성**이다:
장르 불일치(퍼즐·캐주얼) / 엔진 불일치(Unity `.shader`·`.prefab`) / 용도 불일치(앰비언스·파츠).

---

## 게이트

```
tsc 0 · eslint 0 · next build exit 0
gamestate 21 · fa-assets 25 · eventbus-balance 5 · hitstop-overlap 13
keyhint-sync 10 · save-migration 7 · melee-tier 12
shake-scale 30 · shake-accessibility 21 · utility-ai 22 · input-extraction 12
```

## 다음 (2단계)

`buildSave`/`restoreFromSave` 를 `GameState` 기준으로 이전한다.
이게 끝나면 그제서야 리팩터링 4번(세이브 → `save/`)이 "이동"이 된다.
