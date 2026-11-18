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

---

## 7. 2차 분석 (2026-11-18) — 메타 시스템·열거값

1차 분석은 전투(어픽스·상태이상)를 다뤘다. 2차는 **열거값(enum)과 메타 진행 시스템**을 읽어
CERTZ에 아직 없는 설계만 추렸다. 같은 메타데이터다(SHA-256 `87565c5d…4de14a`, 1차와 일치).
도구는 메타데이터 v31 헤더·타입·필드 테이블을 읽는 Node 파서이며, 코드나 에셋은 가져오지 않았다.

### 7-1. 샘플 주의

이 APK는 개발사 빌드가 아니라 **APKVISION 재패키징본**이다. 서명은 자체 서명 `CN=APKVISION.ORG`이고,
모드 메뉴가 주입돼 있다. 주입된 코드는 `libAPKVISION.so`(Dobby 후킹), `libstub.so`(NP Manager DCC 보호, 암호화된 HTTP 호출 포함),
`classes5.dex`(LGL 모드 메뉴)다. 아래 분석은 게임 원본 메타데이터만 사용했고 모드 코드는 제외했다.
기기에 설치하지 않는다. 상세: `C:\SERTZ\Endless-Wander-v4.2.1-mod-findings.md`.

### 7-2. 새로 관찰한 열거값 (observed)

| 타입 | 값 |
|---|---|
| `RunModifierType` | AoeOnDeath, ProjectileOnEnemies, HarderBosses, MoreShieldEnemies, EnemiesEnrage, Bulb, ShieldPillar |
| `RoomType` | Starting, Fight, Fountain, Boss, EndOfArea, Merchant, Alchemist, AttributePillar, MoneyRoom, Peace, DestructibleShardsRoom, Cutscene 외 |
| `RoomRewardType` | Skill, Affix, Passive, BiElem, MerchantGold, MaxHp, Heal, Chest, Resource, RunBonus, RandomRunUpgrade, AttributePillar, SchoolBonusPillar 외 |
| `ClassPlayStyle` 필드 | offense, survivability, mobility, range, complexity (5축) |
| `StoryDifficultyMode` / `GameMode` | Normal, Nightmare / Story, StoryNightmare, Fracture, BiWeeklyEvent, Event, LoreRun 외 |
| `UnlockType` | ProgressionScreen, BlacksmithInHub, CartographerInHub, MissionBoard, CashShop, Revive, ReviveWithAds 외 + `CutsceneBlacksmith`·`CutsceneCartographer` 등 컷신 짝 |
| `UnlockableMechanicsAndChapterRequirement` 필드 | `_unlockableMechanics`, `_chapterIdRequired` (기능 개방 조건 = 챕터) |
| `PeriodType` | Daily, Weekly, Lifetime |
| `GameMetricType` | RunFinished, ReachedArea, EnemyKilled, UsedCharacterSkill, Revive, SpentResource, UsedAttributePillar 외 30여 종 |
| `HiddenMissionsConfig` | 별도 숨김 미션 목록 |
| `PurchaseMethod` | RealCurrency, InGameCurrency, WatchAd, None |
| `RarityBaseEnum` | Common, Rare, Epic, Legendary, Mythic |

추론(inferred): 일일·주간·평생 미션, 업적, 숨김 미션, 배틀패스가 **`GameMetricType` 이벤트 하나**를 공유하고,
각 시스템은 `Specifications`/`Filters` 쌍으로 조건만 다르게 건다. 기능 개방은 챕터와 허브 NPC 컷신에 묶인다.

### 7-3. CERTZ에 이미 있는 것 (반영 불필요)

| Endless Wander | CERTZ 기존 구현 |
|---|---|
| BattlePass, PeriodicMissions Daily/Weekly | `src/game/pass.ts` 시즌 패스 + `SEASON_DAILY/WEEKLY_MISSIONS` + `missionsByHook` |
| 공유 메트릭 이벤트 | `MissionHook`(hunt/boss/closet/gate/dailyClaim/market) — 같은 역할, 범위만 좁음 |
| Achievements | `src/game/isekai.ts:452` `ACHIEVEMENTS` (누적 수치형) |
| PetGacha 규칙·이력 | 확률 공시 + 천장(`POT_PITY_MAX`, `STAR_PITY_*`) |
| 기능 개방 표 | `src/game/unlocks.ts` `UNLOCKS` + 기능별 튜토리얼 |

### 7-4. 참고할 설계 (제안, 미구현)

우선순위는 기존 구조를 깨지 않고 붙일 수 있는 순서다. 모두 데이터 선언 + 기존 화면 재사용으로 끝나는 크기다.

| 우선 | 제안 | 원본 근거 | CERTZ 연결 지점 | 주의 |
|---|---|---|---|---|
| 1 | **주간 변이(모드 변형자)** — 무한의 탑·보스러시·게이트에 주마다 1~2개 규칙을 바꾼다 (예: 적 사망 시 폭발, 보스 강화, 보호막 적 증가, 격노). 보상 배율을 함께 표시 | `RunModifierType` 7종, `RunModifierConfig{_type,_icon,_description}` | `infinite.ts`, `bossRush.ts`, `pass.ts`의 `weekKey()`로 결정적 선택. 효과는 `eliteAffix.ts` volatile/warded 재사용 | 스토리 본편에는 넣지 않는다 (README: 진행에 반복 요구 금지) |
| 2 | **직업 플레이스타일 5축** — 공격·생존·기동·사거리·난이도 1~5 막대를 직업 선택/전직 화면에 표시 | `ClassPlayStyle` 5필드, `CharacterPlayStyleAttributesUiHandler` | `classes.ts` `ClassDef`에 `style` 필드 1개 추가, 현재 `desc` 한 줄 옆에 표시 | 수치는 감각값이 아니라 실제 계수(사거리·HP 배율)에서 뽑아야 거짓 정보가 안 된다 |
| 3 | **챕터 기반 개방 + NPC 소개 컷신** — 레벨 대신(또는 레벨과 OR로) "N장 클리어"로도 기능을 열고, 해당 NPC가 거점에 짧은 컷신과 함께 등장 | `UnlockableMechanicsAndChapterRequirement._chapterIdRequired`, `UnlockType`↔`Cutscene*` 짝 | `unlocks.ts` `UnlockDef`에 선택 필드 `chapter?`, 연출은 `cutsceneCast.ts` 재사용 | README 원칙(스토리 진행에 레벨 요구 없음)과 맞추는 방향. 기존 레벨 표는 유지 |
| 4 | **숨김 업적** — 달성 전에는 `???`로 표시 (예: 보스 무피격 처치, 회피만으로 패턴 1회 넘기기) | `HiddenMissionsConfig` | `ACHIEVEMENTS`의 `AchDef`에 `hidden?: true` 1필드 | 진행 수치 함수(`prog`)는 기존 방식 그대로 |
| 5 | **악몽 재도전** — 클리어한 챕터 보스를 예고 시간 단축 + 정예 어픽스 +1로 다시 도전, 보상은 외형/칭호만 | `StoryDifficultyMode` Normal/Nightmare, `GameMode.StoryNightmare` | 보스 재도전(`unlocks.ts` `boss`) 경로, `eliteAffix.ts` 챕터별 개수 규칙에 +1 | 능력치 보상 금지 (README: 외형 상품은 전투력을 팔지 않음 — 같은 원칙 적용) |
| 6 | **웨이브 사이 선택 노드** — 게이트 N웨이브마다 "회복 샘" 또는 "능력 기둥(이번 판 한정 스탯)" 중 택1 | `RoomType.Fountain`·`AttributePillar`, `RunBonusType` | 게이트 웨이브 종료 지점, 기존 `reward:show` 팝업 재사용 | 1차 분석이 거절한 "방 선택 로그라이트"가 아니라 웨이브 모드 안의 선택지 1개로 한정 |

### 7-5. 가져오지 않을 것

| 원본 | 이유 |
|---|---|
| 전투 능력 펫 가챠, 캐릭터 성급 강화를 캐시 상품으로 판매 (`CharacterProgressionConfig._cashShopItemSingle/_cashShopItemBundle`) | README: 외형/슬롯 상품은 전투 능력을 판매하지 않는다 |
| 방치 보상 + 방치 속도 업그레이드 (`IdleRewards*UpgradeConfig`) | 성장 격차를 접속 시간·결제로 벌리는 장치. 현재 방향과 반대 |
| 광고 시청 부활 (`UnlockType.ReviveWithAds`, `PurchaseMethod.WatchAd`) | 보스는 예고·회피로 공략하는 설계다. 실패 비용을 광고로 지우면 학습 고리가 깨진다 |
| 캐릭터·지역·펫 이름, 스토리, 에셋 | 레퍼런스 원칙: 이름·캐릭터·스토리·아트는 가져오지 않는다 |

---

## 8. 3차 분석 (2026-11-18) — 스킬 이펙트·맵 구조

같은 메타데이터의 필드 테이블과 Addressables 카탈로그(`assets/aa/catalog.bin`)의 프리팹 이름을 읽었다.
에셋 번들 안의 실제 배치·수치는 열지 않았다(관찰은 이름·필드 목록까지).

### 8-1. 스킬 이펙트 — 원본 구조 (observed)

| 타입 | 필드/값 | 의미 (inferred) |
|---|---|---|
| `Vfx.FreezeFrameType` | None, OnPlayerHit, OnEnemyHit, OnLastEnemyKilled, OnEnemyImpactfulHit, SlowMo, ShortSlowMo | 히트스톱을 **사건 이름**으로 고른다. 마지막 적 처치는 슬로모션 |
| `FreezeFrameTypeSetup` | Type, Delay, Duration, Timescale | 사건별 지연·길이·배속을 한 표에서 관리 |
| `Cameras.ScreenShakeType` / `ScreenShakeTypeSetup` | None, Small, Medium, Big, Huge / Duration, Amplitude, Frequency | 흔들림 5단계 프리셋 |
| `ApplyFxCombatEffect` | `_screenShake`, `_freezeFrame`, `_particles`, `_glow`, `_animateRoomLight`, `_animateRoomLightDurationIn/Out`, `_animateRoomLightMultiplier` | 스킬 한 번이 흔들림·정지·파티클·**방 조명 펄스**를 같이 지정 |
| `Run.Schools.SchoolColorTheme` | PrimaryTransparent·Light·Medium·Dark·VeryDark, SecondaryLight·Medium·Dark, PrimaryAccent, SecondaryAccent | 원소마다 10색 팔레트. 파티클·글자·맵 장식이 같은 팔레트를 쓴다 |
| `ParticleFxPerStackAmount` | ParticleFx, MinStackAmount, MaxStackAmount, PlaySound | 상태이상 **중첩 수에 따라** 이펙트가 바뀐다 |
| `StatusParticleRevolvingClipFx` | `_timeForFullRotation`, `_xDistance`, `_yDistance` | 상태 표시 파티클이 대상 주위를 타원 궤도로 돈다 |
| `FloatingTextConfig` | Xs/S/M/L 크기 설정, `_grandTotalMaxConcurrentFloatingTexts`, `_maxFloatingTextsHandledPerFrame` | 피해 숫자 **동시 표시 상한 + 프레임당 상한** |
| `SkillCore` | `_recoveryTime`, `_delayCastTime`, `_showOutlineOnCast`, `_canMoveDuringWindUp/Skill/Recovery`, `_hitType`(Heavy/Light) | 시전 전·중·후 3단계, 시전 시 외곽선 강조 |
| `HitstunPreset` / `KnockbackPresetBaseEnum` | NoHitstun~Heavy + BlockMove/BlockCast/Interrupts / None~VeryHeavy, Custom | 경직·넉백도 이름 붙은 프리셋 |
| `Run.Fighters.GraphicsHeight` | Feet, Torso, HpBar, Head, WeaponCenter, CharacterCenter | 이펙트 생성 위치를 신체 기준점으로 지정 |
| `Vfx.FxSpawnSortingLayer` | FX, Default, Floor | 바닥 이펙트와 공중 이펙트의 그리기 층 분리 |

### 8-2. 맵 구조 — 원본 구조 (observed)

- **방은 절차 생성이 아니라 손으로 만든 프리팹**이다. 카탈로그에 방 프리팹 292개가 있다.
  바이옴별 Islands 42 · Temple 41 · Forest 38 · WorldTree 22 · Coast 21 · Mine 21, 이벤트 변형(Attacked*) 105.
- 방 종류별: FightRoom 104, Starting·Peace·Money·Merchant·EndOfArea·AttributePillars·Alchemist 각 18, DestructibleShards 14, Fountain·EndOfFracture·Boss 각 9.
- **같은 배치를 `_SingleExit` / `_DoubleExit` 두 벌로** 만든다 (예: `Forest_FightRoom1_SingleExit` / `_DoubleExit`).
  `RoomsByTypeConfig{_singleDoorRoom,_doubleDoorRoom}`, `RoomModelConfig{_doorRewardObject,_hideRewardOnDoor}` → 출구가 둘이면 **문 위에 보상을 보여 주고 고르게 한다**.
- 런 구성: `RunBlueprintConfig → _areasConfig[] → RunAreaConfig._subAreas[] → SubAreaConfig._roomGroups → RunRoomGroupsConfig{ForcedEnemyWaves, RoomsGroups}`.
  구역 끝은 `EndOfArea`(샘 포함/미포함), 마지막 구역은 `_isLastBossArea`.
- 타일맵 9층 (`TilemapType`): Background, Holes, Floor, Walls, DefaultLayerDecorations, FloorDecorations, FloorDecorationsTop, CeilingDecorations, CeilingDecorationsTop.
- `WeightedSprite{Sprite, Weight, CanBeRotated}` — 바닥 타일 무작위 변형을 가중치로 섞고, 회전 가능 여부를 타일마다 지정.
- `SchoolColorSwapper{_layer,_spriteRenderer}`, `HolesSchoolColorApplier` — 구역 원소에 맞춰 장식·구덩이 색을 바꾼다.
- `SingleRoomConfig`: FloorLayers, `CameraConfiningBox`(방마다 카메라 제한), EntranceDoor, ExitDoors, EnemySpawns, RoomLights.
  `Door`: 들어가기 전 대기 → 걸어 들어가기 → 들어간 뒤 대기, 세 구간 시간을 따로 둔다.
- 보스전 `FightRoomPhase`: 다음 페이즈 조건(`FightEventTrigger` PhaseStart/BossHpUpdate/TimeSpan/PhaseEnd), HP%, 제한 시간, 페이즈 컷신, 이벤트 목록.
  `EventActionType` 18종: SummonEnemies, RestrictSkills, MoveToWaypoint, CastSkill, ToggleImmunities, UpdateMusicParameter, GoToPhase 등.

### 8-3. CERTZ 현재 상태

| 항목 | CERTZ | 출처 |
|---|---|---|
| 히트스톱 | `ImpactFX.hitStop(ms)` 겹침 처리 우수. 프로필은 basic/crit/skill 3종이지만 **호출 8곳이 숫자를 직접 넘긴다** (26·55·60·70·100·120·140ms) | `src/game/fx/ImpactFX.ts:13,57`, `Enemy.ts:905,991,1094`, `Player.ts:5719,5993,7476,7755` |
| 흔들림 | `IMPACT_PROFILES` + 접근성 배율 `shakeScale.ts` | `src/game/fx/shakeScale.ts` |
| 원소 색 | `ELEMENT_META` 원소당 1색 | `src/game/data.ts:1311` |
| 피해 숫자 | 피해/공격력 비율로 크기 단계 결정. 동시 표시 상한은 `spawnDamageText`(5204–5240행)에서 찾지 못함 | `src/game/scenes/WorldScene.ts:5204` |
| 상태이상 표시 | 상태 종류는 있으나 중첩 수에 따른 이펙트 변화 없음 (검색 0건) | `src/game/combat/statusEffects.ts` |
| 방 조명 | 챕터별 고정 분위기 `ambientFor()`. 스킬에 따른 조명 변화 없음 | `src/game/fx/Lighting.ts:51` |
| 맵 생성 | 스테이지 키 시드의 개미굴형 셀 성장 | `src/game/mapgen.ts` |
| 방 스타일 | 던전 계열만 검은 배경 위 방 하나 (vc278) | `src/game/framedRoom.ts` |
| 수작업 배치 / 레이어 | `authoredLayouts.ts`, `AuthoredMapLayers.ts`. 레이어 스택 분석은 `docs/RE_LAYER_STACK.md`에 이미 있음 | — |

### 8-4. 스킬 이펙트 — 참고할 설계 (제안, 미구현)

프로젝트 철칙("스킬에만 화려한 이펙트, 기본공격·처치는 절제")에 맞춰 골랐다.

| 우선 | 제안 | 원본 근거 | CERTZ 연결 지점 |
|---|---|---|---|
| 1 | **히트스톱 사건 프리셋** — 숫자 직접 호출 8곳을 `enemyHit`·`impactfulHit`·`playerHit`·`lastKill` 같은 이름으로 바꾸고 값은 `IMPACT_PROFILES` 한 곳에 둔다. 새로 `lastKill`(구역 마지막 적 처치 시 짧은 슬로모션)만 추가 | `FreezeFrameType`, `FreezeFrameTypeSetup` | `ImpactFX.ts` 표 확장, 8곳 호출 치환. 값은 현재 숫자를 그대로 옮겨 체감 변화 0으로 시작 |
| 2 | **스킬 시전 시 방 조명 펄스** — 궁극기·대형 스킬만 화면 밝기를 짧게 올렸다 내린다 (들어오는 시간·나가는 시간·배율) | `ApplyFxCombatEffect._animateRoomLight*` | `Lighting.ts`에 `pulse(in, out, mul)` 1개, 호출은 스킬 쪽만. 기본공격 금지 |
| 3 | **원소 10색 팔레트** — `ELEMENT_META`의 기준 색 하나에서 밝음·중간·어두움·강조색을 계산해 파티클·피해 숫자·상태 아이콘이 같은 색 계열을 쓰게 한다 | `SchoolColorTheme` 10칸 | `data.ts:1311` 옆에 순수 함수 1개. 기존 색 값은 유지 |
| 4 | **피해 숫자 동시 상한** — 화면 전체 상한과 프레임당 상한을 두고 넘치면 가장 오래된 것부터 지운다. 게이트·탑처럼 적이 많은 모드의 가독성·성능용 | `_grandTotalMaxConcurrentFloatingTexts`, `_maxFloatingTextsHandledPerFrame` | `WorldScene.spawnDamageText` 입구 한 곳 |
| 5 | **상태 중첩 표시** — 중첩 1·2·3단계마다 대상 주위를 도는 작은 표식 수를 늘린다. 화려한 파티클이 아니라 개수로 읽게 한다 | `ParticleFxPerStackAmount`, `StatusParticleRevolvingClipFx` | `statusEffects.ts`의 상태 데이터에 단계만 추가, 그리기는 기존 상태 아이콘 재사용 |
| 6 | **이펙트 기준점 통일** — 발·몸통·머리·무기 중심 중 어디에 생성할지 이름으로 지정해 캐릭터 크기·외형이 달라도 이펙트 위치가 맞게 한다 | `GraphicsHeight` | `classFxProfiles.ts`의 위치 지정 방식 점검 후 필요할 때만 (미확인) |

### 8-5. 맵 구조 — 참고할 설계 (제안, 미구현)

| 우선 | 제안 | 원본 근거 | CERTZ 연결 지점 | 주의 |
|---|---|---|---|---|
| 1 | **구역 리듬 템플릿** — 던전형 구역을 "시작 → 전투 → 쉬는 방(상점/회복/선택 중 하나) → 전투 → 샘 → 보스" 순서 틀로 짠다 | 방 종류별 개수가 각 바이옴에 1벌씩 고르게 있고, 구역 끝이 `EndOfArea`(샘)·보스 | `framedRoom.ts` 던전 계열 구역 | 야외 지역은 손대지 않는다 (vc278 범위 결정 유지) |
| 2 | **출구 1개/2개 변형 + 문 위 보상 표시** — 같은 방 배치를 출구 수만 다르게 두 벌 저장하고, 출구가 둘이면 각 문 위에 다음 방 보상 아이콘을 띄워 고르게 한다 | `_SingleExit`/`_DoubleExit` 292개, `RoomModelConfig._doorRewardObject` | `authoredLayouts.ts` 배치에 출구 수 필드 | 1차 분석이 거절한 "로그라이트 런 전체"가 아니라 던전 안 갈림길 한 번으로 한정 |
| 3 | **지역 원소 색 교체 + 변형 바이옴** — 같은 방 배치를 장식 색·적 구성만 바꿔 이벤트/악몽 버전으로 재사용 | `SchoolColorSwapper`, Attacked* 105개가 기본 바이옴과 같은 방 종류 구성 | 7-4의 5번(악몽 재도전)과 같이 쓰면 새 맵 제작 없이 콘텐츠 확장 | 새 에셋 생성보다 기존 에셋 색 교체 우선 (AGENTS 에셋 규칙) |
| 4 | **가중치 바닥 변형** — 같은 바닥 타일의 변형 그림을 가중치로 섞고, 회전해도 되는 타일만 회전 | `WeightedSprite{Weight, CanBeRotated}` | `autotile.ts` | 시드 고정 유지 (같은 구역은 항상 같은 모양) |
| 5 | **천장 장식 위층** — 지붕 끝·나뭇가지처럼 캐릭터 **위에** 그려지는 층을 바닥 장식과 분리 | `TilemapType.CeilingDecorations/Top` | `AuthoredMapLayers.ts` | `RE_LAYER_STACK.md`와 겹치는지 먼저 확인 (미확인) |
| 6 | **보스 페이즈 표** — 페이즈 전환 조건(HP%, 시간, 시작/종료)과 행동(소환, 무적 전환, 위치 이동, 음악 변경)을 데이터로 선언 | `FightRoomPhase`, `FightEventTrigger`, `EventActionType` 18종 | 보스 엔티티(`entities/Boss.ts`) | CERTZ 보스 구현 방식은 이번에 읽지 않았다. 이미 비슷하면 건너뛴다 |
| 7 | **문 통과 연출 3구간** — 문 앞 대기 → 걸어 들어감 → 들어간 뒤 대기를 따로 조절 | `Door._entranceWait*/_entranceWalkDuration` | 전환은 반드시 `startTransition()` 단일 통로 안에서 (검은 화면 버그 재발 금지) | — |

### 8-6. 출처 구분

- **관찰**: 열거값, 필드 이름, 카탈로그의 프리팹 이름과 개수, CERTZ 파일·행 번호.
- **추론**: 필드 이름에서 읽은 각 기능의 역할. 원본 수치(히트스톱 ms, 흔들림 크기, 방 크기)는 번들 안에 있어 읽지 않았다.
- **미확인**: CERTZ의 `GraphicsHeight` 대응, 천장 레이어 존재 여부, 보스 페이즈 구현 방식.

## 9. 적용 기록 (2026-11-18)

| 구분 | 적용 | 파일 | 원본 근거 |
|---|---|---|---|
| 이펙트 | 히트스톱 사건 프리셋 8종. 숫자 직접 호출 9곳을 이름으로 치환, 값은 종전과 동일 | `src/game/fx/hitStopPresets.ts`, `ImpactFX.ts`(재수출), `Enemy.ts`, `Player.ts`, `WorldScene.hitStop` | `FreezeFrameType` |
| 이펙트 | 궁극기 시전 시 방 조명 펄스. 어둠 오버레이를 잠깐 걷었다가 원래 값으로 복귀. 깜빡임 완화·연출 끔이면 생략, 보스 조명 전환 시 중단 | `fx/Lighting.ts` `pulse()`, `UltCinematic.ts`, `WorldScene.skillLightPulse` | `ApplyFxCombatEffect._animateRoomLight*` |
| 이펙트 | 피해 숫자 풀 소진 시 새 숫자를 버리지 않고 가장 오래된 숫자를 재사용 | `WorldScene.spawnDamageText` | `FloatingTextConfig` 동시 상한 |
| 연출 | 게이트 웨이브 마지막 적 처치 순간 짧은 슬로모션(0.4배, 게임 90ms) | `WorldScene.playShortSlowMo`, `onGateWaveCleared` | `OnLastEnemyKilled` / `ShortSlowMo` |
| 연출 (버그) | 보스 사망 슬로모션이 1프레임만 보이던 문제. 워치독이 실제 시각과 비교하는데 기준을 씬 시각으로 넣었다 | `WorldScene.onBossDead` | — |
| 맵 | 전진 차원문 라벨에 다음 구역 종류 표시 (`→ 2-5 · 보스`, `→ … · 휴식`) | `src/game/portalPreview.ts`, `WorldScene.activatePortal` | `RoomModelConfig._doorRewardObject` |
| 맵/카메라 | 방을 한 화면에 맞추려면 평소 줌보다 낮춰야 하는 큰 방은 프레이밍하지 않고 평소 줌 추적 카메라 사용 | `framedRoom.framingKeepsZoom`, `WorldScene`(구역 로드 시 판정) | 사용자 지시 |
| 맵 (이미 있음) | 웨이브 사이 선택(8-5 표 6번)은 게이트 카드 선택(`onGateWaveCleared` → `gate:cards`)이 이미 같은 역할 | — | `RoomType.AttributePillar` |

테스트: `tests/fx-map-reference.test.mjs`(5), `tests/warp-groups.test.mjs`(3), `tests/framed-room.test.mjs`(+2).
미적용(8-4·8-5의 나머지): 원소 10색, 상태 중첩 표시, 이펙트 기준점, 구역 리듬 틀, 출구 1/2 변형, 색 교체 변형 지역, 가중치 바닥, 천장 층, 보스 페이즈 표, 문 통과 3구간.
