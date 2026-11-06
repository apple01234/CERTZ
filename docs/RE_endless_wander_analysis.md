# Endless Wander v4.2.1 → CERTZ 적용 분석

> 대상 APK: `Endless-Wander-v4.2.1-mod-apkvision.apk` (358.83 MB)
> SHA-256: `F10DB6BF5B44875750DFA69B4BC79E88BB874A10FC64C15D799E3BDB2ED7DCE7`
> 분석일: 2026-11-06

## 1. 무엇을 분석했나

Unity IL2CPP 게임이다. `libil2cpp.so`(90.8 MB)와
`assets/bin/Data/Managed/Metadata/global-metadata.dat`(14.5 MB,
SHA-256 `87565C5D...ED14A`)를 추출해 메타데이터를 디코딩했다.

| 항목 | 수치 |
|---|---|
| 메타데이터 버전 | 31 |
| 이미지(어셈블리) | 140 |
| 타입 | 18,381 |
| 메서드 | 119,050 |
| 필드 | 75,996 |
| 문자열 리터럴 | 20,182 |

게임 로직은 `Assembly-CSharp.dll`(타입 인덱스 1693–4373, 2,681개)에 있다.
분석은 **이름·구조 관찰**이며 런타임 동작 관찰이 아니다.
필드/파라미터 타입과 네이티브 주소는 바이너리를 함께 넣지 않는 한 복구되지 않는다.

## 2. 원본의 시스템 구조 (관찰된 사실)

### 전투 — 효과 합성 파이프라인

`Run.CombatEffectsAppliers` 아래에 4계층 구조가 있다:

- `SkillCore`(67) → `SkillBehaviour`(13) + 13개 파생
- `StatusCore`(41) → `StatusBehaviour`(15) + 20개 파생
- `AffixCore`(23) → `AffixBehaviour`(7)
- `CombatEffect` 41종 (`DealDamageCombatEffect`, `ApplyStatusesCombatEffect`,
  `ModifyAttributeCombatEffect`, `InstantiateProjectileCombatEffect` 등)

핵심은 **트리거 기반 발동**이다. `StatusBehaviour` 파생 20종이
`ApplyOnDamageDealt`, `ApplyOnSkillCast`, `ApplyOnStatusApplied`,
`ApplyOnDeath`, `ApplyOverTime`, `ApplyOverHpLost` 같은 발동 조건을 담는다.

어픽스는 8개 원소 계열로 나뉜다:
combustion / cosmos / ice / light / mist / reinforcement / sharpness / water.

### 성장 — 레벨 스케일링 데이터화

`Run.Scaling` 네임스페이스:
`LevelScalableFloat` / `LevelScalableInt` / `SelectableScalingFloat` /
`SelectableScalingInt` / `ScalingPreset` / `ScalingType`.
밸런스 수치가 코드가 아니라 **데이터 테이블**로 존재한다.

### 로그라이트 런 구조

- `FloorGenerator`(49) → `RoomSetupController`(64) → `RunSetupController`(64)
- 방 종류: `FightStandard` / `FightBoss` / `Merchant` / `Money` /
  `DestructibleCurrency` / `InstantlyCleared` / `FightSpecific`
- 바이옴: `RunBiomeConfig`, `RandomRunBiomesPoolConfig`,
  `PresetRunBiomesPoolConfig`, `SetSeedRunBiomesPoolConfig`
- 보상: `RunBonus` 6종 컨트롤러
  (Attribute / SchoolDamage / Heal / AffixSlot / AffixSlotUpgrade / SkillSlotUpgrade)

### 메타 진행

- `SaveUpgrade_*_Config` 7개 — 세이브 스키마 버전별 마이그레이션
- `SerializableFractureModeState` — **Fracture 레벨** 누적 난이도 트랙
- `SerializableTechTreeState`, `SerializableSkillTreeProgressionState`
- `SerializableProgressionState`(30), `SerializableFullSaveState`(57)

### UX/연출

`FxManager`(29), `TimeScaleManager` / `TimeScaleModifier`(히트스톱),
`FloatingTextsManager` / `FloatingTextConfig`, `HapticsFeedback`,
`FreezeFrameType`(프레임 정지).

## 3. CERTZ와의 비교

| 항목 | Endless Wander | CERTZ (작업 전) | 판정 |
|---|---|---|---|
| 엔진 | Unity IL2CPP / C# | Next.js + Phaser 4 + TS | 이식 불가, 설계만 참고 |
| 전투 효과 | 4계층 합성 + 41 CombatEffect | `damageModel.ts` 단일 순수함수 | CERTZ가 단순하지만 일관됨 |
| 적 상태이상 | StatusCore(41) + 파생 47 | slow / stun / dot 3종 | **격차 큼** |
| 정예 설계 | AffixCore + 8원소 어픽스 | hp×7.5 / atk×1.5 + 이름접두어 | **격차 큼** |
| 빌드 시너지 | RunBonus 6종 컨트롤러 | 평면 스탯만 | **격차 큼** |
| 레벨 스케일링 | 데이터 테이블 | 부분 하드코딩 | 중간 |
| 런 구조 | 로그라이트 방 선택 | 선형 스테이지 + 4개 웨이브 모드 | 장르 차이 |
| 난이도 | Fracture 누적 트랙 | 보스 4단계 | 중간 |
| UX/연출 | FxManager + 프레임정지 | `ImpactFX` + 데미지텍스트 5단계 | **CERTZ 우수** |
| 메타 진행 | SaveUpgrade 7종 | 환생/별력/수집/유니온 등 | CERTZ 충분 |

CERTZ가 이미 잘하고 있는 것(건드리지 않음): 타격감(히트스톱·스크린셰이크·
데미지텍스트 5단계 색/크기), 접근성(셰이크 배율), 원소 상성 + 반응 7종.

## 4. 적용한 것

### 4-1. 정예 어픽스 — `src/game/combat/eliteAffix.ts` (신규)

원본 `AffixCore`의 "정예 = 단순 스탯 덩어리가 아니라 행동이 달라지는 개체"라는
설계를 CERTZ 규모에 맞게 6종으로 축약했다.

| 어픽스 | 효과 | 상한 |
|---|---|---|
| volatile | 사망 시 반경 150px 폭발 | 플레이어 최대HP 12% |
| warded | HP 50% 이하에서 1회 보호막 | 정예 최대HP 30% |
| swift | HP 낮을수록 이속 증가 | +40% |
| thorned | 피격 시 공격자에게 반사 | 준 피해의 8% |
| regenerating | 초당 HP 회복 | 정예 최대HP 2%/s |
| splitting | 사망 시 하위 개체 2기 | 어픽스 미상속 |

설계 규칙:
- **기존 배율을 대체하지 않고 곱한다.** 어픽스 0개면 `1.0` → 종전과 완전 동일.
- 상한은 데이터가 아니라 `Math.min`으로 **구조적으로** 보장. magnitude가
  범위를 벗어나도 캡을 넘지 못한다(테스트가 9.9까지 퍼징).
- 챕터에 따라 개수 증가: 1–3챕터 1개, 4–6챕터 2개, 7+ 3개.
- `maxHp` 좌표계를 분리: `volatileDamage`는 **플레이어** 최대HP 기준,
  `regenPerTick`/`wardedShield`는 **정예 자신**의 최대HP 기준.
  (정예 HP는 기본의 7.5배라 섞으면 12% 캡이 무력화되어 즉사기가 된다.)

### 4-2. 상태이상 확장 — `src/game/combat/statusEffects.ts` (신규)

원본의 트리거 모델을 순수 함수로 옮겼다. slow/stun/dot은 기존 것을 유지하고
chill/shock/mark/weaken을 추가했다.

## 5. 적용하지 않은 것과 이유

| 후보 | 왜 안 했나 |
|---|---|
| 8원소 어픽스 전체 | CERTZ는 이미 자체 원소 상성 9종 + 반응 7종이 있다. 두 체계를 겹치면 플레이어가 읽을 수 없다. 6종으로 축약. |
| 로그라이트 방 선택 | CERTZ는 선형 스테이지 + 4개 웨이브 모드 장르다. 방 선택을 넣으면 기존 스테이지 180개 구조가 무너진다. |
| Fracture 난이도 트랙 | 보스 4단계 난이도 + 무한의 탑 깊이 스케일링이 이미 같은 역할을 한다. |
| SaveUpgrade 마이그레이션 | CERTZ는 `migrateSave()` + `SAVE_VERSION`으로 이미 처리 중. |
| 데이터화된 레벨 스케일링 | `stages.ts`의 `stageScale()`이 이미 중앙화돼 있다. 순수 리팩터라 이득 없음. |

## 6. 출처 구분

- **관찰(observed)**: 타입/메서드 이름, 개수, 문자열, APK 내부 파일 목록.
- **추론(inferred)**: 각 클래스의 역할. 이름과 네임스페이스에서 유추했으며
  실제 동작을 실행해 확인한 것이 아니다.
- **미확인(unknown)**: 필드 타입, 밸런스 수치, 네이티브 주소, 런타임 동작.
  `global-metadata.dat`만으로는 복구되지 않는다.
