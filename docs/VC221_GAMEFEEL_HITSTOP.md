# vc221 — `agd-game-feel` 스킬 기준 타격감 감사·수정

`/agd-game-feel` 지시에 따라 스킬의 함정 목록과 실제 구현을 대조했다.
**결론: trauma 셰이크는 이미 정확했고, hit-stop 에 실제 버그 2개 + 구조적 결함 1개가 있었다.**

## 잘 되어 있던 것 (수정하지 않음)

### trauma 셰이크 — 스킬 패턴과 완전히 일치

`fx/UltCinematic.ts` 의 `TraumaShake`:

```ts
this.trauma = Math.max(0, this.trauma - (dtMs / 1000) * 1.15);  // 감쇠
const s = this.trauma * this.trauma;                            // trauma² — 약한 건 거의 안 보임
this.t += dtMs / 1000 * 34;
this.ox = Math.sin(this.t * 1.7) * 18 * s;                      // 사인 샘플링
this.oy = Math.sin(this.t * 2.3) * 11 * s;
```

스킬의 4개 요구를 모두 만족한다:
1. `trauma²` (제곱 감쇠) ✓
2. **매 프레임 `Math.random` 이 아니라 사인 샘플링** ✓
   (스킬: "Random offset every frame buzzes like static")
3. 카메라 오프셋만 건드리고 바디는 안 건드림 ✓
4. 팔로우 결과 위에 더함 (`applyManualCameraFollow` 마지막에 `+= ox`) ✓

### ImpactFX.shake — vc209 에서 이미 고쳐진 상태

Phaser `Shake.start()` 의 `if (!force && isRunning) return` 때문에 진행 중인 셰이크가
새 요청을 **통째로 버리는** 문제를 이미 해결해 두었다. 남은 시간과 강도를 비교해
**더 강한 쪽만** 채택한다. `force=true` 의 반대 버그(700ms 연출이 90ms 에 잘림)도 회피.

## 버그 ① — 겹칠 때 첫 타이머가 두 번째 freeze 를 잘랐다

스킬이 **정확히 경고한** 케이스다:

> "Overlapping hit-stops (two hits 30 ms apart) let the first timer restore time scale
>  in the middle of the second freeze."

`ImpactFX.hitStop` 종전 구현:

```ts
hitStop(ms: number) {
  if (this.frozen || ms <= 0) return;   // ← 두 번째 타격의 지속시간을 통째로 버린다
  ...
}
```

`WorldScene.hitStop` 종전 구현도 같은 계열:

```ts
if (now < this.hitStopUntil) {
  this.hitStopUntil = Math.min(this.hitStopUntil + 12, now + 90); // 연장만, 타이머 없음
  return;
}
```

### 실측 (구현을 그대로 옮긴 시뮬레이션)

```
시나리오 B: 30ms 간격 2연타 (70ms 히트스톱)
  t=30: 히트스톱 겹침 → hitStopUntil=82, 새 타이머 없음
  t=80: paused=false  <-- 2타가 아직 진행 중인데 resume 됨
  → 두 번째 타격의 freeze 가 첫 타이머에 의해 잘렸다
```

## 버그 ② — 연타 시 실제 정지는 1회뿐

`hitStopUntil` 은 82→94→… 로 늘어나는데 물리 정지는 첫 1회만 일어났다.
**표시값과 실제 동작이 따로 놀았다.**

```
시나리오 C: 5연타 폭격
  hitStopUntil=118 (누적 상한 90 적용)
  pauses=1 (1회만 실제 정지)
```

## 구조적 결함 ③ — 물리 정지의 주인이 둘

`WorldScene.hitStop` 과 `ImpactFX.hitStop` 이 **각자** `world.pause()/resume()` 를 호출했다.
같은 프레임에 겹치면(근접 명중 → `takeDamage` → 원소 반응 `spawnElementReaction`) 한쪽
타이머가 다른 쪽의 정지를 먼저 풀어버린다.

## 수정

### 1) `ImpactFX.hitStop` — 세대 ID + 최댓값

```ts
const target = Math.max(this.hitStopUntil, now + ms);  // 더하지 않고 최댓값
this.hitStopUntil = target;
const myId = ++this.hitStopSeq;
if (!this.frozen) { this.frozen = true; world.pause(); }
this.scene.time.delayedCall(Math.max(0, target - now), () => {
  if (myId !== this.hitStopSeq) return;   // 최신 호출만 복원
  ...resume
});
```

스킬 처방 그대로: **"Let only the newest call restore it."**
겹칠 때 남은 시간을 **더하지 않는** 이유는 무한 연장 방지다(스킬은 "briefly" 강조).

### 2) `WorldScene.hitStop` — ImpactFX 로 위임

```ts
hitStop(ms = 26) {
  this.impactFX?.hitStop(ms);   // 소유권 단일화
}
```

죽은 필드 `hitStopUntil`/`hitStopSeq` 는 제거했다(제 변경으로 고아가 된 것만 정리).

### 3) 자가치유 블록 연동 — 빠뜨리면 수정이 무효가 되는 지점

`update()` 의 물리 자가치유가 `this.time.now >= this.hitStopUntil` 로 히트스톱을
존중하고 있었다. 위임 후 이 필드는 0 이 되어 **자가치유가 다음 프레임에 히트스톱을
잘라버린다.** `ImpactFX` 에 `get hitStopEndsAt()` 을 추가해 연결했다:

```ts
this.physics.world.isPaused && this.time.now >= (this.impactFX?.hitStopEndsAt ?? 0)
```

이 지점을 놓쳤다면 히트스톱이 16ms 만에 잘려 "고쳤는데 더 나빠진" 상태가 됐을 것이다.

## 검증 — `tests/hitstop-overlap.test.mjs` **13 PASS / 0 FAIL**

```
PASS  즉시 정지
PASS  자가치유가 자르지 않음 (40ms < 55ms)
PASS  종료 후 재개
PASS  pause 1 / resume 1
PASS  겹쳐도 정지 유지
PASS  46ms 에 아직 정지 (45짜리 두번째가 살아있음)
PASS  최종 재개
PASS  resume 1회
PASS  히트스톱 중 자가치유 미개입
PASS  히트스톱 후 정상 재개
PASS  폭격 중 정지 유지
PASS  폭격 후 재개
PASS  resume 1회 (중복 없음)
```

## 게이트

| 검사 | 결과 |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint src --max-warnings 0` | exit 0 |
| `damageModel.test.ts` | 28 PASS |
| `hitstop-overlap.test.mjs` | 13 PASS |
| `save-migration` / `melee-tier` / `utility-ai` / `morale-ai` / `keyhint-sync` | 7 / 12 / 22 / 8 / 10 PASS |
| `next build` | exit 0 (`Compiled successfully in 51s`) |

## 남은 한계

- **스킬이 권고한 "reduce screen shake / reduce flashing" 접근성 옵션은 없다.**
  설정 패널에 셰이더 강도(0~200)와 플리커 완화는 있지만 **셰이크 강도 항목은 없다**.
  민감한 사용자를 위한 별도 항목이 필요하면 추가해야 한다.
- 히트스톱 지속시간이 **최댓값** 방식이라, 26ms 타격 5회가 80ms 안에 몰리면
  총 정지는 70ms 선에서 멈춘다(무한 연장은 없지만 "연타가 더 묵직해진다"는 느낌은
  제한적). 의도된 트레이드오프다.
- 실기기(S20+)에서 타격 리듬을 눈으로 확인하지 못했다. 이 환경은 정적 검증까지.
