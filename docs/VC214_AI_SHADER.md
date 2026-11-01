# vc214 — 스킬 기반 AI · 셰이더 도입

`/use game-studio`, `/agd-ai-behavior-trees-utility-ai`, `/agd-shader-programming` 요청에 따라
세 스킬을 읽고 **실제 코드에 반영한 기록**. 어떤 원칙을 어디에 썼고 무엇으로 검증했는지 남긴다.

## game-studio — 라우팅 확인
- 이 프로젝트는 **2D Phaser 4** 경로다(스킬 기본값과 일치). 엔진 교체 불필요.
- 따라서 스킬이 지시한 대로 `phaser-2d-game` 계열(=`agd-phaser-*`)로 라우팅하고,
  UI/에셋/QA를 한 계획 안에서 유지했다. 새 스택 도입은 하지 않았다.

## agd-ai-behavior-trees-utility-ai — Utility AI 도입

### 배경 (측정)
`src/game/ai/` 에는 `FSM.ts` 하나뿐이었고, 도주는 `opts.flee` **정적 플래그**(황금 몬스터 전용)로만
가능했다. 일반 몬스터는 체력 1 이어도 계속 돌진했고, 저체력 판단 로직은 코드에 없었다.

### 구현 (`src/game/ai/utility.ts`, `src/game/ai/morale.ts`)
스킬의 설계 원칙을 그대로 적용:
1. **모든 consideration 은 0..1 정규화** — `Curve.linear/inverse/exponential/sigmoid/smoothstep`
2. **곱셈 결합 + 보상(compensation)** — 인자가 늘수록 점수가 0으로 눌리는 것 방지
3. **히스테리시스 0.08** — 임계 근처 fight↔retreat 진동 방지
4. **틱마다 노드/클로저 생성 금지** — 액션 배열·스크래치 ctx 를 인스턴스에 보관
5. **FSM 은 유지** — 검증된 상태 전이·연출·사운드를 건드리지 않고,
   사기 판단이 `retreat`/`flee` 일 때만 FSM 앞에서 이동을 덮어쓴다.

### 스킬 지침을 어기며 실제로 잡은 버그 3개
| 버그 | 증상 | 원인 | 수정 |
|---|---|---|---|
| `compensate(0)` 누출 | 배제돼야 할 행동이 선택됨 | `Math.max(product,1e-6)` | `product<=0 → return 0` |
| 동료 0 을 곱셈 인자로 사용 | **fight 점수가 항상 0** → 어떤 행동도 선택 불가 | `linear(allies,0,3)` 가 0 | `0.35 + 0.65*linear(...)` 바닥값 |
| px 값을 sigmoid 에 직접 투입 | retreat 점수 **1e-66** → 영구 0 | `sigmoid(120, 150, k=5)` | `dist/aggro` 로 0..1 정규화 후 적용 |

추가로 **의미 오류** 1건: retreat 의 거리 항이 "멀수록 높음"이어서 멀리서 혼자 후퇴하는
이상 동작이 됐다 → "가까울수록 높음"으로 반전(붙어 있는 위협에서 벌린다).

### 최종 밸런스 (실측)
```
단독, dist=120:  hp 100~45% fight → 35~8% retreat → 3% flee
동료 3+        :  hp 15% 에서도 retreat 점수 0.546 → 0.196 (덜 후퇴)
상대 빈사      :  hp 8% 에서 flee 점수 0.557 → 0.267 (덜 도망)
거리           :  hp 35% 에서 dist 40 → retreat 0.380 / dist 450 → 0.129
```

### 검증
- `tests/utility-ai.test.mjs` — **22 PASS / 0 FAIL** (커브 범위, 0 배제, 보상 단조성, 히스테리시스, minScore)
- `tests/morale-ai.test.mjs` — **8 PASS / 0 FAIL** (체력·동료·상대체력·거리 축 단조성, fight 비배제)
- 실행: `node --experimental-strip-types tests/utility-ai.test.mjs`
  `node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/morale-ai.test.mjs`
  (`ts-resolve-hook.mjs` 는 소스가 확장자 없는 import 를 쓰기 때문에 테스트에서만 필요하다)

## agd-shader-programming — 소멸 dissolve 셰이더

### 배경
적 사망 시 파티클만 터지고 **60ms 뒤 즉시 destroy** 되어 "팟 하고 사라지는" 인상이었다.
스프라이트가 사라지는 과정 자체가 없었다.

### 구현 (`src/game/fx/DissolveFX.ts`)
Phaser 4 `ShaderQuad` + 노이즈 임계값 dissolve. 스킬의 경고를 **전부 회피**:

1. **"amount=0 에도 노이즈<edge 픽셀이 남아 반짝이는 점이 생긴다"**
   → `cut = amount*(1+edge) - edge`. 실측 검증: `cut(0) = -0.16` (음수), 모든 노이즈에서
   `keep` 최소값 **1.0000** → 완전히 보임 상태에 점이 생기지 않는다.
2. **"smoothstep(e0>=e1) 은 GPU 별 미정의 동작"**
   → 항상 `smoothstep(cut, cut+edge, n)` 오름차순. 실측: 위반 케이스 **0**.
3. **"discard 는 early-Z 를 깨고 모바일 타일 GPU 에서 비싸다"**
   → `discard` 미사용, 알파 합성으로 처리(어차피 반투명 소멸).
4. **Phaser 4 NORMAL = 프리멀티플라이드 알파**
   → `gl_FragColor = vec4(col * a, a)` (`PortalFX.ts` 의 기존 규약과 동일).

### 검증 (수식 실측)
```
amount=0.00: 살아남는 노이즈 101%   (완전히 보임)
amount=0.25: 80%
amount=0.50: 51%
amount=0.75: 22%
amount=1.00:   0%  (완전 소멸)
```
단조 감소 확인 → 진행도가 그대로 소멸량이 된다.

### 연결
`Enemy.die()` 에서 현재 스프라이트의 `texture.key`/`frame.name`/`scale`/`flipX` 를 그대로 넘겨
**같은 자리에** dissolve 를 얹는다. WebGL 이 아니면 `spawnDissolve` 가 `null` 을 돌려주고
기존 연출이 그대로 동작한다(Canvas 폴백 안전). 원소별 밴드색(ice=청백, fire=주황) 적용.

## 게이트
| 검사 | 결과 |
|---|---|
| `node tests/utility-ai.test.mjs` | 22 PASS / 0 FAIL |
| `node tests/morale-ai.test.mjs` | 8 PASS / 0 FAIL |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src --max-warnings 0` | exit 0 |
| `next build` | exit 0 (Compiled successfully) |

## 남은 한계
- dissolve 는 **WebGL 전용**이다. Canvas 폴백에서는 기존 연출만 나온다(의도된 안전 동작).
- 사기 판단은 **0.35초 주기**로만 갱신한다. 순간적인 피격 반응은 기존 FSM/넉백이 담당한다.
- `retreat` 는 이동만 바꾼다(공격 쿨다운을 별도로 초기화하지 않음) — windup 중에는
  `ai.set("wander")` 로 강제 해제하지만, 투사체는 남아 있을 수 있다.
- 프레임워크 단위 테스트 러너가 없어 Node 스트립 모드 + 커스텀 리졸버로 돌린다.
  CI 에 넣으려면 `tsx` 또는 `vitest` 도입이 필요하다.
