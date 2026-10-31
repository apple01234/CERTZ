# ponytail-audit — SERTZ 전수 감사

> **모드**: 읽기 전용. 코드를 바꾸지 않았다.
> **측정**: v1.4.48 (vc209 진행 중) · 2026-10-30
> **가정한 부하**: 모바일 단일 사용자 세션 수십 명, GitHub Contents API를 DB로 사용,
>  APK/EXE/웹 3종 배포. `WorldScene` 갱신 60fps.

---

## What this repo does

`SERTZ`는 Next.js 16 + Phaser 4로 만든 픽셀 액션 RPG다. 9챕터 × 10서브스테이지,
35직업, 9보스. 게임 로직 대부분이 `WorldScene.ts`(17,379줄)와 `Player.ts`(8,639줄)
두 파일에 있고, 서버는 GitHub 저장소를 DB로 써서(`src/lib/ghdb.ts`) 계정·거래소·채팅·
파티를 Next API 라우트 24개로 제공한다.

**규모**: `src/` 134파일 **71,460줄**. 의존성 83 + 개발 11. 테스트 **1파일**(7케이스).

---

## Must fix

### 1. `setupInput()` 이 1,901줄 단일 함수 — 이벤트 리스너 112개가 한 덩어리
(`src/game/scenes/WorldScene.ts:9206-11106`)

- **What this is:** 입력 배선 함수 하나. `EventBus.on` 112개, `EventBus.off` 111개,
  키 등록, 포인터 처리, UI 콜백이 전부 여기 있다.
- **Problem:** 함수 하나가 1,901줄이다. `EventBus.on("input:attack")` 이 **두 번**
  등록돼 있고(`input:move`·`input:skill1`도 중복 2건), 그중 어느 것이 실제로
  유효한지 코드만 보고 알 수 없다. 리스너 하나를 지우려면 1,901줄을 읽어야 한다.
  씬 `shutdown` 핸들러는 11개뿐이라, 이 112개 중 일부는 해제 경로가 다르다.
- **Fix:** 관심사별로 쪼갠다 — `wireCombatInput()`, `wireUiInput()`, `wireSocialInput()`.
  각 함수가 자기 `off` 를 자기 안에서 등록하게 하면 짝이 지역적으로 보인다.
  한 번에 다 쪼개지 말고 **`wireSocialInput`(거래·파티·채팅)부터** — 가장 덜 위험하다.
- **If we skip it:** 입력 버그가 날 때마다 1,901줄을 다시 읽는다. 중복 등록 2건은
  지금도 실제 동작이 불명확하다.

### 2. `useSkill5b()` 이 1,714줄, `case` 37개 — 직업별 분기가 한 함수
(`src/game/entities/Player.ts:5319`)

- **What this is:** 제2궁극기 시전. 35직업의 5차 각성 스킬이 전부 여기 있다.
- **Problem:** `case` 37개가 한 함수 안에 있다. 직업 하나의 궁극기를 고치려면
  1,714줄 중 해당 `case` 를 찾아야 하고, `switch` 안에서 `return` 을 빠뜨리면
  다음 직업 스킬이 연달아 실행된다. `useSkill5()` 도 같은 구조(1,000줄+)다.
  `useSkill3` 569줄, `useSkill4` 356줄도 같은 패턴.
- **Fix:** `case` 본문을 직업별 함수로 뺀다 — `ult5b_<jobKey>()`. `switch` 는
  디스패치만 하고 본문은 밖으로. 37개를 한 번에 옮기지 말고 위험도 순서로
  3~5개씩. 각 이동 후 `tsc` + 인게임 스킬 1회 시전 확인.
- **If we skip it:** 신규 직업을 추가할 때마다 1,714줄 함수에 `case` 를 더한다.
  지금 37개인데 35직업 × 2(궁극기 2종)이면 한계에 가깝다.

### 3. 테스트가 1파일뿐 — 회귀를 잡을 방법이 없다
(`src/lib/__tests__/escrow.test.ts`, 7케이스)

- **What this is:** 거래소 에스크로만 테스트가 있다.
- **Problem:** 71,460줄 중 게임 로직 8,639줄(`Player.ts`)의 데미지·쿨다운·상태이상
  계산에 테스트가 **0**이다. `rollDamage` 호출이 77곳, 거리 계산이 112곳인데
  경계값(배율 0, 방어 100%, 크리 0%/100%)을 고정한 테스트가 없다.
  `tsc` 는 타입만 보고 수치는 안 본다.
- **Fix:** 순수 함수부터. `calcDamage(atk, mult, def, defPct, crit)` 를 뽑아
  경계값 4개를 고정한다. 파일 1개, 20줄. 그 다음 `cdMult` 적용 결과를 고정.
- **If we skip it:** 밸런스 수정이 조용히 깨지고 플레이어가 발견한다.

---

## Should fix

### 4. `WorldScene.ts` 17,379줄 / 363개 메서드 — 20개 관심사 혼재

최대 메서드 실측:

| 메서드 | 줄 | 성격 |
|---|---|---|
| `setupInput` | **1,901** | 입력 |
| `createInner` | 755 | 씬 생성 |
| `update` | 532 | 매 프레임 |
| `playRemoteSkillFx` | 496 | 네트워킹 |
| `placeDecor` | 404 | 필드 장식 |
| `restoreFromSave` | 330 | 저장 |

- **Problem:** `update()` 가 532줄인 건 문제가 아니다(프레임당 할당은 `.filter` 1곳뿐).
  문제는 **`setupInput` 1,901줄**과 `createInner` 755줄이 한 클래스에 있다는 것.
  저장(`restoreFromSave`) 고치다 스폰 로직을 건드리는 사고가 구조적으로 가능하다.
- **Fix:** `setupInput` 분해가 1순위(Must #1). 그 다음 `SaveBridge`(저장/로드 542줄)
  추출, `FieldDecor`(장식 404줄) 추출. **한 커밋에 하나만**, 매번 게이트.
- **If we skip it:** 새 기능 1개당 회귀 면적이 계속 커진다.

### 5. `Panels.tsx` 6,678줄 — UI 한 파일

- **Problem:** 모든 게임 패널(상점·인벤·스탯·퀘스트·거래소)이 한 파일.
  6,678줄에 컴포넌트 수십 개. 상점 하나 고치려면 파일 전체를 다시 읽어야 한다.
- **Fix:** 패널별 파일 분리(`Panels/Shop.tsx` 등). UI는 로직 의존이 적어 안전하다.
- **If we skip it:** 패널 추가마다 6,678줄 파일을 다시 읽는다.

### 6. 미사용 export 59개 (997개 중)

참조 0회 확정. 대표:

| 심볼 | 파일 | 비고 |
|---|---|---|
| `LAYER`, `LAYER_ORDER`, `LAYER_TINT` | `layers.ts` | **파일 85줄 전체가 미사용** |
| `autotileKey` | `autotile.ts` | 호출부는 인라인 인덱싱 |
| `addVfxSprite` | `fx/atlasAnim.ts` | 모듈은 쓰이나 이 함수만 죽음 |
| `SKILL3_DESC`, `SKILL4_DESC` | `classes.ts` | `SKILL_LABELS` 가 대체 |
| `BGM_ALL_TRACKS`, `SFX_THROTTLE_MS_V` | `audio.ts` | |
| `COLORS`, `GENDER_LABELS`, `SKIN_OPTIONS`, `UPGRADE_BONUS`, `JobSkinKey` | `config.ts`/`data.ts` | |
| `RUNE_SLOTS`, `ROLE_META` | `isekai.ts` | |
| `carvePlateaus` | `mapgen.ts` | |
| `cn` | `lib/utils.ts` | shadcn 관례 잔재 |
| `clearActiveChar`, `classJoinedCode`, `combatPower` | 각 파일 | |

- **Problem:** 각 5~40줄, 합계 **1,000줄 이상** 추정. 읽는 사람이 "이게 쓰이나?"를
  매번 확인해야 한다. 특히 `layers.ts` 는 내가 RE로 만들고 **한 번도 안 썼다**.
- **Fix:** 대체품이 있는 것부터(`SKILL3_DESC`/`SKILL4_DESC`, `layers.ts`).
  디버깅용으로 남길 것은 주석으로 표시.
- **If we skip it:** 죽은 코드가 산 코드처럼 보여 탐색 비용이 계속 든다.

### 7. `firebase` 의존성 — 코드에서 직접 import 0회
(`package.json:72`, `^12.6.0`)

- **What this is:** Firebase JS SDK 12.6.0.
- **Problem:** `import ... from "firebase"` 가 **0파일**이다. 실제로는
  `@capacitor-firebase/authentication`(앱)과 `firebase/app`(웹, `googleAuth.ts` 동적 import)
  으로 쓰인다. `firebase` 패키지를 직접 참조하는 곳이 없다 — 번들에는 들어가지만
  진입점이 없다.
- **Fix:** `firebase/app`·`firebase/auth` 를 쓰는지 확인 후, 안 쓰면 제거하거나
  서브패스만 남긴다. **번들 크기 수백 KB 차이.**
- **If we skip it:** APK/웹 번들이 불필요하게 커진다.

### 8. 리스너 해제 불일치 6건 — 전부 앱 수명, 실제 누수 0
`EventBus.on` 146종 / `off` 143종, `window.addEventListener` 13종 / `remove` 10종.

| 이벤트 | 위치 | 판정 |
|---|---|---|
| `fx:battery` | `PhaserGame.ts` | 앱 수명 — 누수 아님 |
| `trade` | `trade.ts` | 동일 |
| `vfx3d` | `fx/Vfx3D.ts` | 동일 |
| `error`/`unhandledrejection` | `crashGuard.ts:51,64` | 전역 크래시 핸들러 — 의도적 |
| `beforeunload` | `mpMqtt.ts:245` | 브라우저 종료 훅 — 의도적 |

- **Problem:** 6건 모두 씬 재시작과 무관하다. **결함 0건.**
- **Fix:** 없음. 다만 `setupInput` 이 씬 스코프 리스너 112개를 들고 있으므로,
  새 리스너는 `this.events.once(SHUTDOWN)` 에 묶는 규칙을 문서화할 만하다.

---

## Nice to have

### 9. `update()` 는 깨끗하다 — 손대지 말 것
`WorldScene.update()` 532줄 안에서 매 프레임 새 객체를 만드는 곳은
`this.enemies.filter()` **1곳**(L11256)뿐. 나머지는 스크래치 재사용
(`dirVecScratch`, `targetScratch`)과 프레임 캐시(`targetCacheFrame`)가 적용돼 있다.
`getAllTargets()` 는 `WorldScene.ts:15127` 에서 프레임 단위 캐시를 반환한다.

### 10. 보안 — Must 0건

| 점검 | 결과 |
|---|---|
| 시크릿 하드코딩 | `ghp_`/`sk-` **0건**. `googleAuth.ts:33` apiKey 는 Firebase 공개 클라이언트 키(정상) |
| 인증 없는 상태변경 라우트 | `auth/*`(로그인·가입·로그아웃) + `chat`/`party`/`support` — **전부 설계상 공개** |
| 레이트리밋 | login·register·google·chat(8/30s)·support(5/10min)·claimname·cloud-save·gmcheck·nametaken — **존재** |
| 거래소 재화 권위 | `buy` 구매자 골드 서버 차감 + 402, `collect` 서버 직접 지급 + `serverGold` — **수정 완료** |
| 소유권 검증 | `buy`/`cancel` 모두 `l.seller !== me.id` 403 — **존재** |
| `mutateDb` 원자성 | sha 낙관 잠금 + 409/422 재시도 **최대 4회** — **존재** |
| IAP | `purchaseToken` 만 받아 Google Developer API 로 서버 검증 — **존재** |

### 11. 빈 catch 1건 — 의도적
`src/game/slots.ts:143` `try { dispatchEvent(...) } catch {}`. CustomEvent 미지원
환경 대비. **결함 아님.**

### 12. 0 나눗셈 2건 — 실제 위험 낮음
`Boss.ts:506` `this.hp / this.maxHp`, `Enemy.ts:595` `(24*this.hp)/this.maxHp`.
`maxHp` 는 정의상 항상 > 0 이라 도달 불가. **결함 아님.**

---

## Verdict

**Must fix 3건, Should fix 5건.** 구조 자체는 건강하다 — `update()` 최적화, 보안,
거래소 재화 권위, 리스너 짝은 전부 실제로 잘 돼 있다. 문제는 **두 개의 거대 함수**
(`setupInput` 1,901줄, `useSkill5b` 1,714줄)와 **테스트 1개**다.

순서: ① 데미지 순수함수 테스트 → ② `setupInput` 분해 → ③ `useSkill5b` case 분리
→ ④ 미사용 export 정리.

**Lean: -1,000줄, -1 의존성(firebase) 가능.**

**Not checked:**
- `Panels.tsx` 6,678줄 내부 컴포넌트 개별 검토 (파일 크기·구조만 확인)
- `data.ts`(3,344줄) 밸런스 수치 전수 검증
- APK 실기기(Galaxy S20+) 동작
- 실 GPU 렌더 성능 (헤드리스 SwiftShader)
- 24개 API 라우트 전부의 body 타입 검증 상세 (인증·소유권·레이트리밋은 확인)
