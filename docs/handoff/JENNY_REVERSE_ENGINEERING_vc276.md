# JENNY 리버스 엔지니어링 → SERTZ 이식 보고서 (vc276)

> 대상: `JENNY - Windows.zip` (Google Drive, 245MB)
> 작업: PCK 추출 → GDScript 디컴파일 → 설계 분석 → 선별 이식

---

## 1. 대상 정체 (실측)

| 항목 | 값 |
|---|---|
| 엔진 | **Godot 4.6.1** (`project.godot` config_version=5, features `Forward Plus`) |
| 배포 형태 | `Jenny Game.exe` (104MB) + `Jenny Game.pck` (253MB) |
| PCK 포맷 | `GDPC` magic, **format v3**, `file_base=112`, `dir_offset=252,977,472` |
| 파일 수 | **6,722개** (추출 241.2MB, md5 불일치 **0**) |
| 스크립트 | **800개** GDScript (`.gdc` 바이트코드 → GDRETools 로 `.gd` 복구) |
| 텍스처/씬 | PNG 1,338 · `.tscn` 470 · `.tres` 184 |
| 장르 | **런앤건 액션** (로봇 적 · 총기 · 버프 · 스테이트 차트 AI) |
| 커스텀 기능 | `demo,steam` |

### 추출 파이프라인

1. Drive 확인 페이지 우회 (`confirm=t` + `uuid`)
2. **자체 PCK 파서 작성** (`godot4_pck.py`) — Godot 4 v3 포맷
   - `file_base` + `dir_offset` 구조, 엔트리 = `u32 path_len / path / u64 ofs / u64 size / md5[16] / u32 flags`
3. **GDRETools v2.7.4** 로 전체 복구 (`--recover`) — 3분 32초
   - aarch64 호스트에서 x86-64 바이너리 실행: `qemu-x86_64-static -cpu max` + `libc6:amd64`/`libstdc++6:amd64`/`zlib1g:amd64`
   - 결과: `.gdc`→`.gd` 800개, `.ctex`→`.png` 1,338개, `.scn`→`.tscn` 470개
   - 실패 1건: `addons/gut/source_code_pro.fnt` (폰트에 텍스처 없음 — 애드온 리소스라 무관)

---

## 2. 참고할 만한 설계 (선별)

JENNY 는 SERTZ(2D 액션 MORPG)와 장르가 다르다. **아키텍처 사고방식**만 선별했다.

### 2-1. `FloatModStack` — 배율 스택 ★이식함

`system/mod_stack/float_mod_stack.gd`

수치 배율을 **uid 별 bit** 으로 관리하고 `priority → uid` 로 정렬해 순차 적용한다.

- 같은 버프를 여러 번 넣어도 uid 로 갱신 → **이중 적용 없음**
- 버프 3개 중 1개만 만료돼도 **나머지 2개의 곱이 그대로 유지**된다
- `dirty` 플래그 캐시 → 매 프레임 재계산 없음

SERTZ 는 `buff * sky * slow` 처럼 인라인 곱셈이라 이 속성이 없다.

### 2-2. `DamageData` 파이프라인 ★이식함

`system/traits/health_trait.gd` 의 내부 클래스 + `_damage()` / `process_resistances()`

- 피해를 **숫자가 아닌 객체**로 다룬다 (가해자·방향·원소·원본값·실제감소량·치명여부)
- **`original_damage` 보존** — 배율이 여러 번 곱해져도 원래 값 추적
- **방향 자동 계산** — 호출부가 매번 `dir` 넘기다 틀리는 문제 제거
- 파이프라인 순서 고정: `pre → 저항/면역 → 적용 → damaged 신호 → 사망 판정`

### 2-3. `Timescale` 시스템 — 미이식 (SERTZ 에 이미 유사 구조)

`system/globals/timescale_system.gd`

- `FloatModStack` 기반 시간배율 + `Engine.time_scale` 일원화
- 오디오 피치까지 함께 조절 (`AudioServer.playback_speed_scale`, 0.25~2.0 클램프)
- 콜백 모드 4종(STACK/QUEUE/REPLACE/LONGEST)

SERTZ 는 `hitStop(ms)` 로 이미 동작하며, 오디오 동기화까지 넣으면 리스크가 크다.
**필요해지면 그때 2-1 의 ModStack 으로 확장**하는 편이 낫다.

### 2-4. 그 외 관찰 (참고만)

| 시스템 | 요지 | SERTZ 판단 |
|---|---|---|
| `AwarenessTrait` | 시야 Area2D + 적 선택(최근/최근접 확률 0.75) + 이탈거리 + 추측 항법 | SERTZ 적 AI 는 단순 추격 — 도입 시 이득 있으나 이번 범위 밖 |
| `godot_state_charts` | 상태머신을 리소스로 정의 (guard/parallel/history state) | Phaser 에 1:1 대응 없음 |
| `HealthGroup` | 그룹별 피해 배율 (친화/약점) | `resolveDamage` 배율로 흡수 가능 |
| `SplatSystem` | 혈흔/데칼 누적 (522줄) | 모바일 발열 우려 — 미도입 |

---

## 3. 이식 내용

### 3-1. `src/game/combat/modStack.ts` (신규)

`FloatModStack` 을 TypeScript 로 옮겼다. **원본과 다른 점 2가지를 명시**했다:

| 차이 | 원본 JENNY | SERTZ | 이유 |
|---|---|---|---|
| base 엔트리 | `op: ADD` | `op: MULTIPLY` | SERTZ 값은 배율 의미론(`base × 곱들`) |
| 시작값 | `result = 0` | `result = base` | 0 에서 시작하면 `0 × 1.0 = 0` 으로 전부 무력화 |
| base priority | `0` | `-1e9` | `-Infinity` 는 `a-b = NaN` 이 되어 sort 무효 |

세 차이 모두 **테스트가 실제 실패로 잡아낸 것**이다(기대 2 vs 실제 1.0).

`enum` 대신 `as const` 를 쓴 이유: 이 저장소 테스트는 `node --experimental-strip-types`
(strip-only)로 돌아가고, 이 모드에서 `enum` 은 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` 다.

### 3-2. `src/game/combat/damageData.ts` (신규)

`DamageData` / `HealData` / `resolveDamage` / `applyDamage` 를 순수 함수로 분리.

- `makeDamage()` — 기본값 단일 출처
- `ensureDirection()` — 가해자→대상 단위벡터 자동 (0 나눗셈 방어)
- `resolveDamage()` — 원소 → 특화 → 방어 → 받는피해 순서 고정, 각 단계 최소 1 보장
- `applyDamage()` — 체력 적용, `invulnerable`/`immortal`/`noKill` 옵션

**기존 코드를 건드리지 않는다.** `Enemy.takeDamage` 는 그대로 두고, 새 피해원
(도트·반사·환경)을 추가할 때 이 파이프라인을 쓰면 된다.

### 3-3. `Player.recalcSpeed()` 변경 (연결)

```ts
// 종전
this.speed = Math.round(Player.BASE_SPEED * (1 + growth/100) * buff * sky * slow);
// 변경
stack.clear();
stack.base = Player.BASE_SPEED;
stack.addBit(1, 1 + growth/100, MULTIPLY, 10);
stack.addBit(2, buff, MULTIPLY, 20);
stack.addBit(3, sky,  MULTIPLY, 20);
stack.addBit(4, slow, MULTIPLY, 20);
this.speed = Math.round(stack.value);
```

**핵심 함정 (테스트가 잡음)**: 부동소수점 곱셈 **순서**가 반올림 경계에서 1 을 바꾼다.
- 종전: `225 × 1.4 × 0.7 = 220.5` → `round = 221`
- 스택: `(1.0 × 1.4 × 0.7) × 225 = 220.49999999999997` → `round = 220`

같은 수학식인데 유저가 체감하는 이속이 1 다르다. → `base` 를 `BASE_SPEED` 로 두어
곱셈 순서를 종전과 동일하게 만들었다.

---

## 4. 검증 (실제 출력)

```
# tests 312
# pass 312
# fail 0
```
(기존 286 + 신규 26)

- `tsc --noEmit` → **0**
- `eslint src --max-warnings 0` → **0**
- `next build` → **성공**

### 신규 테스트

| 파일 | 개수 | 고정하는 계약 |
|---|---:|---|
| `tests/mod-stack.test.mjs` | 7 | 중첩 곱 · **부분 해제 정확성** · priority 정렬 결정성 · base 보호 · DIVIDE 0 |
| `tests/damage-data.test.mjs` | 14 | 원본값 보존 · 방향 자동계산 · 배율 순서 · 최소1 · pure/instakill · invulnerable/immortal/noKill |
| `tests/speed-modstack-equivalence.test.mjs` | 5 | **288개 조합에서 종전 식과 결과 완전 동일** (회귀 0) |

---

## 5. 재현 방법

```bash
# 1) PCK 추출 (자체 파서, 의존성 없음)
python3 godot4_pck.py "Jenny Game.pck" extracted

# 2) GDRE 로 디컴파일 + 리소스 변환 (x86-64 호스트는 qemu 불필요)
qemu-x86_64-static -cpu max ./gdre/gdre_tools.x86_64 \
  --headless --recover="Jenny Game.pck" --output=recovered
```

## 6. 못 한 것 / 남은 것

- **AwarenessTrait(시야/적 선택)는 이식하지 않았다.** SERTZ 적 AI 개선은 별도 과제로
  분리하는 게 맞다 — 이번 변경은 배율/피해 파이프라인까지만.
- **실기기 확인 없음.** 이번 변경은 순수 계산 로직이고 288개 조합 동등성 테스트로
  결과가 동일함을 확인했으나, S20+ 에서 이속 체감은 유저 확인이 필요하다.
- JENNY 원본 프로젝트는 `/root/.hermes/cache/scratch/jenny/recovered` 에 보존했다
  (캐시 정리 시 사라질 수 있음 — 보존이 필요하면 별도 경로로 옮길 것).
