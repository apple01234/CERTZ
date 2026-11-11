# 대시 무적 적용 — v2.2.12 / vc268

기준: CERTZ/main `bb37a7f`. 이번 변경은 CrossCode 데모가 아니라 **CERTZ 자체 첫 보스 실측 데이터**에서 도출했다.

## 문제 (기존 기록에서 확인)

`docs/qa/2026-11-11/live-progression/first-boss-attempt.json`의 `final.boss`는 `mode: recover`인데,
봇은 HP 178,200 중 **2,578(1.45%)만 깎고** 사망했다. 보스 HP가 높아서가 아니었다.

| 시점 | 플레이어 HP | 보스 HP | 보스 모드 |
|---|---|---|---|
| 기록 A | 411 / 442 | 177,318 / 178,200 | charging |
| 기록 B | **80 / 442** | 175,727 / 178,200 | chargeTele |

플레이어가 두 번의 피격 사이에 **362 HP를 잃었다.** 즉 회피 입력이 있어도 피해를 막지 못했다.

## 원인 (코드에서 확인)

1. `src/game/combat/freeDash.ts` 주석이 명시했다: `no resource, damage or invulnerability`.
   대시에 무적이 **아예 없었다.** `tickFreeDash()`에도 `iframes` 설정이 없었다.
2. `Player.useFreeDash()`가 `if (this.state !== "idle") return false;`로 막았다.
   피격 직후 `takeDamage()`가 `iframes = 600`(0.6초)을 걸고, 그동안 `state`가 idle이 아니라
   **회피 입력이 전부 무시**됐다. 보스 연속기에 그대로 갇히는 구조였다.

## 변경 (최소 수정)

- `FREE_DASH`에 `iFrameMs: 420` 추가. 이동(180ms)보다 길고 피격 경직(600ms)보다 짧게 잡아
  **회피는 이득이되 무한 무적은 아니게** 했다.
- `useFreeDash()` 성공 시 `this.iframes = Math.max(this.iframes, FREE_DASH.iFrameMs)`.
  기존이 더 길면(성역 8초·부활 2.2초) 줄이지 않는다.
- 피격 경직 중에도 회피 허용: `const recovering = this.iframes > 0 && this.state !== "dead";`
  단 대시 중 재입력은 계속 막는다(중복 이동 방지).

보스 HP·플레이어 HP·데미지·스테이지 배율은 **변경하지 않았다.** 회피의 *결과*만 실제로 만들었다.

## 검증

### 자동 검사
- `npx tsc --noEmit` 통과
- `npm run lint:strict` 통과 (`--max-warnings 0`)
- `npm test` **612 통과 / 0 실패** (기존 609 + 신규 3)
  - 신규: 대시가 iframe을 부여, 이동보다 길고 피격 경직보다 짧음, 기존 긴 무적을 줄이지 않음, 피격 경직 중 회피 허용하되 대시 중 재입력은 차단
  - 기존 테스트 `creation: ...`의 `assert.equal(p.iframes, 0)`은 "대시는 무적이 아니다"라는 **옛 계약**이라 `FREE_DASH.iFrameMs`로 갱신했다(의도된 계약 변경).

### 실제 런타임 검증
`scripts/playtest-dash-iframes.mjs` → `PASS`.

| 항목 | 관찰값 |
|---|---|
| 대시 전 iframes | 0 |
| 대시 발동 | `returned: true`, iframes **420**, state `dash` |
| 무적 중 `takeDamage(50)` | HP **172 → 172 (차단됨)** |
| 무적 종료 후 `takeDamage(50)` | HP **172 → 122 (적용됨)** |
| 페이지 예외 | 0 |

HP/레벨/진행/보스 HP를 주입하지 않았다. `iframes`도 직접 설정하지 않고 `useFreeDash()` 호출로만 만들었다.
튜토리얼 게이트(`canPlayerAction`)만 통과시켰는데, 이는 "지금 대시를 배우는 단계인가"를 판단하는 별개 장치다.

## 검증하지 못한 것

- **보스전 실제 클리어**: 자연 진행으로 디오를 다시 잡아보지 않았다. 봇 사망만으로 막힘을 단정하지 않는다.
- 실기기(S20+) 발열·터치 체감은 미확인. PC 헤드리스 수치로 대체하지 않는다.
- CrossCode의 회피 무적 프레임 수치를 관찰로 확인하지 않았다. 이번 값은 CERTZ 기존 상수(이동 180ms, 피격 경직 600ms)에서 도출한 설계 선택이며 참고작 수치 복사가 아니다.

## 재현

```sh
npm run build
npx next start -H 127.0.0.1 -p 4321
DASH_QA_URL=http://127.0.0.1:4321 node scripts/playtest-dash-iframes.mjs   # PASS
```
