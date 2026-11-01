# vc222 — 화면 흔들림 접근성 + 중복 구현 제거

## 배경

`vc221`(타격감 감사) 문서에서 "셰이크 강도 접근성 옵션이 없다"고 한계로 적었다.
이어서 "계속" 지시를 받아 **새로 구현하려 했는데, 이미 완성된 시스템이 있었다.**

## 발견 — 이미 있었다 (vc222 로 이미 배선됨)

`src/game/fx/shakeScale.ts` — 4단계 배율 시스템이 **이미 완성·배선**되어 있었다:

```ts
export type ShakeScale = "off" | "low" | "normal" | "strong";
export const SHAKE_FACTORS: Record<ShakeScale, number> = {
  off: 0, low: 0.45, normal: 1, strong: 1.45,
};
export const SHAKE_STORAGE_KEY = "sertz_shake_scale";
```

배선 지점 (모두 이미 연결됨):

| 위치 | 역할 |
|---|---|
| `PhaserGame.ts:388` | 부팅 시 `loadShakeScale()` 로 복원 |
| `ImpactFX.ts:99` | 일반 타격 셰이크에 `intensity *= k` |
| `UltCinematic.ts:71` | 궁극기 시네마틱 `ox/oy` 에 `* k` |
| `WorldScene.ts:10920` | `fx:shake` 이벤트 → `setShakeScale` + 배너 안내 |
| `Panels.tsx:5785~` | 설정 패널 4버튼 UI (끔/약하게/보통/강하게) |

UI 문구도 접근성 목적을 정확히 밝힌다:
> "멀미가 있다면 "끔"이나 "약하게"를"

라벨과 실제 배율도 일치한다 — `low` = 0.45 (55% 감소), `strong` = 1.45.

## 한 일 — 중복 구현 제거 (내가 만든 것)

`vc221` 말미의 "한계" 판단이 **틀렸다.** 시스템이 없어서가 아니라 내가
`src/game/fx/` 를 훑지 않았던 것이다. 그 상태로 구현을 시작해 두 곳을 중복으로 건드렸다:

### 되돌린 것 ① — `config.ts` 의 `FxSettings.shake`

`FxSettings` 에 `shake: number` (0~200) 를 추가하고 `FX_DEFAULTS` 를 도입했으나,
`shakeScale.ts` 와 **저장 키·단위·의미가 모두 다른 두 번째 시스템**이 된다.
사용자가 설정 패널에서 어느 쪽을 바꾸든 다른 쪽과 어긋난다. 전부 되돌렸다.

### 되돌린 것 ② — `WorldScene.doShake` 의 배율 적용

```ts
// 내가 넣었던 것 (제거)
const mul = this.shakeScale();
if (mul <= 0) return;
this.impactFX.shake(duration, intensity * mul);
```

`ImpactFX.shake` 가 **이미** `shakeFactor()` 를 곱한다. 여기서 또 곱하면
`off`/`low` 가 이중 적용되어야 할 흔들림이 남는다(0 × 0.45 = 0 이라 겉보기엔
괜찮지만, `low` 에서 0.45×0.45 = 0.2 로 **의도보다 2배 이상 약해진다**).

```ts
// 현재
doShake(duration: number, intensity: number) {
  if (this.fxLevel === 0) return;
  /* 접근성 배율은 `ImpactFX.shake` 안에서 곱해진다 (`fx/shakeScale.ts`).
   * 여기서 또 곱하면 off/low 설정이 두 번 적용되어 꺼야 할 흔들림이 남는다. */
  this.impactFX.shake(duration, intensity);
}
```

## 검증 — `tests/shake-accessibility.test.mjs` **21 PASS / 0 FAIL**

```
[1) 계약]   off=0 / low=0.45 / normal=1 / strong=1.45, 기본 normal      (6 PASS)
[2) 범위]   ImpactFX 곱함 ✓ / UltCinematic ox·oy 곱함 ✓ / off 면 연출 건너뜀 ✓  (3 PASS)
[3) 중복]   doShake 가 배율을 또 곱하지 않음 ✓ / ImpactFX 위임만 ✓        (2 PASS)
[4) 무영향] 배율이 damageModel 에 없음 ✓ / 판정·전투 모듈 import 안 함 ✓   (2 PASS)
[5) 저장]   localStorage 키 ✓ / 잘못된 값 기본값 복구 ✓ / 저장 실패해도 세션 적용 ✓ / 부팅 복원 ✓ (4 PASS)
[6) 수치]   off→0 / low→0.45 / strong→1.45 / normal→변화없음            (4 PASS)
```

**3)과 4)가 이번 작업의 핵심 검사다** — 이중 곱이 없고, 게임플레이 수치에
전혀 닿지 않는다는 것을 코드 수준에서 못박았다.

## 게이트

| 검사 | 결과 |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint src --max-warnings 0` | exit 0 |
| `damageModel` | 28 PASS |
| `shake-accessibility` | 21 PASS |
| `hitstop-overlap` | 13 PASS |
| `melee-tier` / `save-migration` / `utility-ai` / `morale-ai` / `keyhint-sync` | 12 / 7 / 22 / 8 / 10 PASS |
| `next build` | exit 0 (`Compiled successfully in 61s`) |

## 교훈

접근성 항목을 "없다"고 판단하기 전에 **`src/game/fx/` 전체를 먼저 확인**해야 한다.
이 프로젝트는 `fx/` 디렉터리에 이미 여러 축(강도·플리커·흔들림·2.5D·화질모드)이
분리되어 있고, 각각이 독립 모듈로 배선돼 있다. 새 축을 만들기 전에
기존 축의 **저장 키와 단위**를 확인하지 않으면 두 시스템이 조용히 갈라진다.

## 남은 한계

- **히트스톱 자체는 접근성 옵션이 없다.** 흔들림은 줄일 수 있지만 55ms 정지는 그대로다.
  멀미보다 편두통·피로에 영향을 줄 수 있는 축인데, 이번 지시 범위를 넘으므로 두었다.
- 실기기(S20+)에서 4단계 흔들림을 눈으로 비교하지 못했다.
