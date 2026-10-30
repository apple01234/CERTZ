# SERTZ 진단 리포트 — game-feel + 코드 감사

> **모드**: 읽기 전용. 이 문서는 코드를 바꾸지 않는다.
> **측정 시점**: v1.4.48 / vc208 (2026-10-30)
> **도구**: `grep` / `wc` / Python AST 없이 정규식 스캔, 실제 파일 읽기
> **가정한 부하**: 모바일 단일 사용자, 동시 세션 수십 명, GitHub Contents API를 DB로 사용

---

## What this repo does

`SERTZ`는 Next.js 16 + Phaser 4로 만든 픽셀 액션 RPG다. 9챕터 × 10서브스테이지,
35직업, 9보스. 게임 로직 대부분이 `WorldScene.ts`(17,379줄)와 `Player.ts`(8,639줄)
두 파일에 있다. 서버는 GitHub 저장소를 DB로 쓰고(`src/lib/ghdb.ts`), 계정·거래소·채팅·
파티를 Next API 라우트 24개로 제공한다. 웹 / APK / EXE 세 가지로 배포된다.

**전체 규모**: `src/` 134파일, 71,460줄. 테스트 1개(`escrow.test.ts`, 7케이스).

---

## 게임필 진단 — "재미없음"을 숫자로

### 결론 먼저

| 항목 | 측정값 | 판정 |
|---|---|---|
| 지속 보상 상태가 HUD에 표시되는가 | 연속킬 콤보 O (바 + 임계 스타일) | ✅ 있음 |
| 온보딩이 입력을 요구하는가 | 3단계 전부 실제 행동 요구 | ✅ 있음 |
| **능동 방어 입력(회피/패리/가드)이 있는가** | **없음** | ❌ **핵심 결손** |
| 피격 시 무적 프레임 | 600ms (피격 후 자동) | ⚠️ 수동 아님 |
| 회피 mechanic 제거 이력 | 없음 (한 번도 구현된 적 없음) | 신규 제안 가능 |

### 1. 코어 루프에 방어 입력이 없다 — 최대 결손

`src/game/keymap.ts:11-31` 의 액션 전체:

```
attack, skill1~5, skill5b, fishing, potHp, potMp,
interact, bag, shop, job, stat, quest, opt,
collection, autohunt, friends
```

**회피·구르기·패리·가드가 하나도 없다.** `Player.ts` 의 무적은 전부 자동이다:

| 위치 | 값 | 발동 조건 |
|---|---|---|
| `Player.ts:7114` | 600ms | 피격당하면 자동 |
| `Player.ts:8632` | 2200ms | 부활하면 자동 |
| `Player.ts:5421` | 8000ms | 궁극기 "천국의 문" |

즉 플레이어가 적 공격을 **읽고 대응할 수단이 없다**. 모든 전투가
"때린다 → 맞는다 → 물약 먹는다"의 체력 교환으로 수렴한다.
`autohunt`(자동사냥)가 있는 게임에서 이건 치명적이다 — 손으로 해도 자동과
결과가 같으면 조작할 이유가 없다.

**왜 이게 최우선인가**: 스킬을 100개 더 넣어도 이 구조는 안 바뀐다. 반대로
회피 하나만 넣어도 보스전 난이도·손맛·리플레이 가치가 동시에 바뀐다.
비용은 낮다(입력 1개 + 타이머 1개), 효과는 코어 루프 전체다.

**⚠️ 이건 버그 수정이 아니라 설계 변경 제안이다.** 스킬 문서가 말하는 대로
"obviously correct한 버그픽스"로 제시하면 안 되고, 사용자가 거절할 수 있는
제안으로 제시해야 한다. (제거 이력이 없으므로 되살리는 위험은 없음 —
`grep -rniE 'dodge|parry|회피|패리' src/game/` 결과 0건, 히트 33건은 전부
`overflow-y-auto` 스크롤이다.)

### 2. 이미 고쳐져 있는 것 (중복 지적 방지)

| 항목 | 근거 | 상태 |
|---|---|---|
| 연속킬 콤보 HUD 상시 표시 | `HUD.tsx:247-266` — 잔여 시간 감소 바 + 5/10 임계 색상 | ✅ 이미 있음 |
| 온보딩 행동 요구 | `Tutorial.ts:36-52` — 대화/포탈/3마리 처치 | ✅ 이미 있음 |
| 자동사냥 AI | `WorldScene.ts` `autoHunt` 그룹, 550줄 | ✅ 의도된 기능 |

`autohunt` 는 "재미없음"의 원인 후보로 보이지만 **의도적으로 넣은 기능**이다.
없애자는 제안은 하지 않는다. 다만 **방어 입력이 없으면 autohunt와 수동 플레이의
결과가 동일**해진다는 점이 진짜 문제다.

---

## Must fix

### 1. 테스트가 1개뿐 — 리팩터링 게이트가 없다
(`src/lib/__tests__/escrow.test.ts`, 7케이스)

- **What this is:** 서버 재화 이동(거래소 에스크로)만 테스트가 있다.
- **Problem:** 게임 로직 71,460줄 중 8,600줄(`Player.ts`)이 데미지·쿨다운·상태이상
  계산인데 테스트가 0이다. `Player.ts`를 한 줄 고쳐도 회귀를 잡을 방법이 없다.
  이미 이번 세션에서 `awayScratch` 141곳 치환, `zoomPunch` 36곳 증폭,
  `yDepthFor` 21곳 치환을 테스트 없이 했다. `tsc`는 타입만 보고 수치는 안 본다.
- **Fix:** 순수 함수부터 뽑아 테스트한다. `rollDamage(mult, crit)` →
  `calcDamage(atk, mult, def, defPct, rng)` 로 분리하고, 경계값
  (배율 0, 방어 100%, defPct 1.0, 크리 0%/100%)을 고정한다. 파일 1개, 20줄.
- **If we skip it:** 다음 밸런스 수정에서 조용히 깨지고, 사용자가 "왜 또 안 되냐"로 발견한다.

### 2. `LAYER` / `LAYER_ORDER` / `LAYER_TINT` — 3개 다 미사용
(`src/game/layers.ts:32-84`, 85줄 전체)

- **What this is:** RE로 뽑은 12레이어 스택을 상수로 정의한 파일.
- **Problem:** 파일 도입부에 "새 오브젝트에만 쓴다"고 적혀 있지만
  **실제 사용처가 0건**이다. 즉 85줄이 아무 일도 하지 않는다. 같은 파일에
  `LAYER`·`LAYER_ORDER`·`LAYER_TINT` 3개 export가 모두 미참조다.
- **Fix:** ① 실제로 `WorldScene`의 신규 오브젝트 depth에 적용하거나
  ② 파일을 지운다. 지금 상태(문서만 있고 코드는 안 씀)가 가장 나쁘다 —
  다음 세션이 "레이어 시스템이 있다"고 오해한다.
- **If we skip it:** RE 문서와 코드가 어긋난 채로 남고, 다음 RE 작업이 중복된다.

### 3. `autotileKey()` — 정의만 있고 호출 0회
(`src/game/autotile.ts:124`)

- **What this is:** 오토타일 경계 키 계산 함수.
- **Problem:** `autotile.ts`는 vc204에서 만든 파일이다. 그런데 `WorldScene`은
  `autotileKey()` 대신 `autotile_edge` 아틀라스를 직접 인덱싱한다.
  함수가 죽어 있다.
- **Fix:** 호출부를 `autotileKey()`로 통일하거나 함수를 지운다. 12줄.
- **If we skip it:** 경계 계산 규칙이 두 곳(함수 + 호출부 인라인)에 존재하게 되고,
  한쪽만 고쳐지는 순간 타일이 어긋난다.

---

## Should fix

### 4. `WorldScene.ts` 17,379줄 — 20개 관심사 혼재

메서드를 이름으로 그룹핑한 실측 (합계 약 16,600줄, 나머지는 필드·import):

| 관심사 | 줄 | 메서드 수 |
|---|---|---|
| 입력 | 2,498 | **5** |
| 라이팅 | 2,283 | 25 |
| 무한/탑/시련/파크/클로젯/게이트 | 1,259 | 40 |
| 전투 스킬/VFX 스폰 | 1,308 | 47 |
| 스폰/적 관리/보스 | 1,245 | 25 |
| UI/HUD/미니맵/퀘스트로그 | 1,138 | 22 |
| 컷씬/연출/프롤로그/튜토리얼 | 1,083 | 18 |
| 맵/타일/데코/충돌 | 823 | 14 |
| 포털/스테이지 이동 | 596 | 17 |
| 자동사냥 AI | 550 | 14 |
| 저장/로드 | 542 | 9 |
| 퀘스트/업적/미션 | 461 | 19 |
| NPC/대화/상점 | 418 | 11 |
| 가구/집/필드데코 배치 | 382 | 14 |
| 스킬 아이콘/투사체 풀 | 377 | 6 |
| 인벤/드랍/루팅 | 321 | 13 |
| 네트워킹/리모트 | 267 | 12 |
| 낚시/채집/요리 | 215 | 10 |
| SFX 래퍼 | 50 | 13 |

- **What this is:** 한 클래스가 전투·저장·연출·네트워킹·낚시를 전부 한다.
- **Problem:** `update()`는 11113~11644 (**532줄**)로 전체의 3%만 차지한다.
  즉 나머지 97%는 이벤트·헬퍼다. 문제는 **파일이 커서가 아니라 경계가 없다는 것**이다.
  `save()`를 고치다 스폰 로직을 건드리는 사고가 구조적으로 가능하다.
- **Fix:** 줄 수가 아니라 **관심사 단위**로 자른다. 우선순위:
  `SaveBridge`(저장/로드 542줄) → `CutsceneDirector`(1,083줄) →
  `FieldDecor`(가구/데코 382줄). 각 추출 후 `tsc`/`eslint`/빌드 게이트 필수.
  한 커밋에 하나만.
- **If we skip it:** 새 기능 1개당 회귀 면적이 계속 커진다. 지금도 71k줄에 테스트 1개다.

### 5. `Panels.tsx` 6,678줄 — UI 한 파일
(`src/components/game/Panels.tsx`)

- **What this is:** 모든 게임 패널(상점·인벤·스탯·퀘스트·거래소 등)이 한 파일.
- **Problem:** `WorldScene.ts`와 같은 문제인데 UI 쪽. 6,678줄에 컴포넌트가
  수십 개. `displayName` 헬퍼가 이 파일 안에 있고(`Panels.tsx:564`),
  서버 `google/route.ts:41` 에도 동명 로컬 변수가 있어 이름이 겹친다.
- **Fix:** 패널별 파일 분리. `Panels/Shop.tsx`, `Panels/Inventory.tsx` …
  → `tsc` 게이트. UI는 로직 의존이 적어 분리가 안전하다.
- **If we skip it:** 패널 하나 추가할 때마다 6,678줄 파일을 다시 읽어야 한다.

### 6. 미사용 export 59개

전체 997 export 중 **참조 0회 59개**. 대표적인 것:

| 심볼 | 파일 | 비고 |
|---|---|---|
| `LAYER`, `LAYER_ORDER`, `LAYER_TINT` | `layers.ts` | Must fix #2 |
| `autotileKey` | `autotile.ts` | Must fix #3 |
| `addVfxSprite` | `fx/atlasAnim.ts` | atlasAnim은 쓰이는데 이 함수만 죽음 |
| `SKILL3_DESC`, `SKILL4_DESC` | `classes.ts` | `SKILL_LABELS`가 대체 |
| `BGM_ALL_TRACKS`, `SFX_THROTTLE_MS_V` | `audio.ts` | |
| `COLORS`, `GENDER_LABELS`, `SKIN_OPTIONS`, `UPGRADE_BONUS`, `JobSkinKey` | `config.ts`/`data.ts` | |
| `RUNE_SLOTS`, `ROLE_META` | `isekai.ts` | |
| `carvePlateaus` | `mapgen.ts` | |
| `cn` | `lib/utils.ts` | shadcn 관례 잔재 |
| `clearActiveChar`, `classJoinedCode`, `combatPower` | 각 파일 | |

- **Problem:** 각각 5~40줄. 합계 1,000줄 이상으로 추정된다. 읽는 사람이
  "이게 쓰이나?"를 매번 확인해야 한다.
- **Fix:** `SKILL3_DESC`/`SKILL4_DESC`처럼 **대체품이 있는 것만** 먼저 지운다.
  `BGM_ALL_TRACKS` 같이 디버깅용으로 남긴 것은 주석으로 표시한다.
- **If we skip it:** 죽은 코드가 살아 있는 코드처럼 보여 탐색 비용이 계속 든다.

### 7. 리스너 해제 불일치 6건 (경미)

| 이벤트 | 등록 | 해제 | 판정 |
|---|---|---|---|
| `fx:battery` | `PhaserGame.ts` | 없음 | 앱 수명 전체 — 실제 누수 아님 |
| `trade` | `trade.ts` | 없음 | 동일 |
| `vfx3d` | `fx/Vfx3D.ts` | 없음 | 동일 |
| `error` / `unhandledrejection` | `crashGuard.ts:51,64` | 없음 | 전역 크래시 핸들러 — 의도적 |
| `beforeunload` | `mpMqtt.ts:245` | 없음 | 브라우저 종료 훅 — 의도적 |

전체: `EventBus.on` 117 / `off` 116, `window.addEventListener` 29 / `remove` 25.
- **Problem:** 6건 모두 **씬 재시작과 무관한 앱 수명 리스너**라 누수가 아니다.
  즉 실제 결함 0건.
- **Fix:** 없음. 다만 `EventBus`가 146종 이벤트를 쓰므로, 씬 스코프로 등록하는
  리스너는 `Scene.events.once(SHUTDOWN)`으로 묶는 규칙을 문서화할 만하다.

---

## Nice to have

### 8. `update()` 는 깨끗하다 — 손댈 필요 없음
`WorldScene.update()` 532줄 안에서 매 프레임 새 객체를 만드는 곳은
`this.enemies.filter()` **1곳뿐**(`11256`). 나머지는 스크래치 재사용
(`dirVecScratch`, `targetScratch`)과 프레임 캐시(`targetCacheFrame`)가 이미 적용돼 있다.
`getAllTargets()`는 `WorldScene.ts:15127`에서 프레임 단위 캐시를 반환한다.
→ **최적화 여지 거의 없음.** 이건 칭찬할 부분이다.

### 9. 순환 import 위험 — 낮음
`src/game/`이 `src/components/`를 import하는 경우 0건(단방향).
`displayName`은 `Panels.tsx:564`(클라)와 `google/route.ts:41`(서버 로컬 변수)에
각각 존재하지만 **같은 함수가 아니라 이름만 같다** — 실제 중복 아님.

### 10. 보안 — Must 0건
| 점검 | 결과 |
|---|---|
| 시크릿 하드코딩 | `ghp_`/`sk-` **0건**. `googleAuth.ts:33` apiKey는 Firebase 공개 클라이언트 키(정상) |
| 인증 없는 상태변경 라우트 | `auth/*`(로그인·가입·로그아웃) + `chat`/`party`/`support` 뿐. **전부 설계상 공개** |
| 레이트리밋 | login·register·google·chat(8/30s)·support(5/10min)·claimname·cloud-save·gmcheck·nametaken — **있음** |
| 거래소 재화 권위 | `market/buy` 구매자 골드 서버 차감 + 402, `collect` 서버 직접 지급 — **수정 완료** |
| `mutateDb` 원자성 | 반환값 기반 + MAX_TRY=6 + 5xx 재시도 — **수정 완료** |

→ 감사 23건 수정이 실제로 유효함을 확인했다.

---

## Verdict

**Must fix 3건, Should fix 4건.** 구조는 건강하지만 **테스트가 없다는 점이
가장 큰 부채**다. 지금 상태에서 기능을 더 넣는 것보다 (1) 데미지 계산 순수함수
테스트, (2) 죽은 레이어/오토타일 코드 정리, (3) `save` 경계 추출이 순서상 먼저다.

게임필 쪽은 **방어 입력 부재 1건**이 전부다. 이미 잘 된 것(콤보 HUD, 행동형
온보딩, 프레임 캐시)을 다시 손대지 말고, 방어 입력 하나만 설계 제안으로 올린다.

**Lean: -1,000줄, -0 의존성 가능** (미사용 export 59개 + `layers.ts` 85줄 기준).

**Not checked:**
- `Player.ts` 스킬 배율 35직업 전체 표 — 서브에이전트가 중단되어 미완
- `stages.ts` 보스 TTK 이론 계산 — 동일
- 실 GPU 렌더 성능 — 헤드리스가 SwiftShader라 측정 불가
- APK 실기기(Galaxy S20+) 동작 — 이번 세션 미실시
