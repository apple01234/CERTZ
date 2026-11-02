# vc231 — 영준 프린세스 편(하울르스톤) 1기 15화 구현

## 무엇을 했나

`vc230` 이 "사양 없음"으로 미뤄 둔 **영프 중간편**을, 이제 제공된 **기획서 1기 15화 원문**으로 구현했다.
`docs/VC230_STORY_GATE.md` 마지막 절이 예고한 그대로다:

> 영프 편 실제 콘텐츠(중간편 필드·보스·엔딩 트리거)는 여전히 미구현이다.
> 그 콘텐츠가 들어오면 `STORY_SEQUENCE` 의 `howlrstone` status 를 바꾸고,
> 엔딩 처리부에서 `youngPrincessCleared = true` 를 세우면 된다.

| 항목 | vc230 | vc231 |
|---|---|---|
| 영프 편 필드 | 0 (마을만) | **50** (5챕터 × 10구역) |
| 영프 보스 | 0 | **5** (해롤드·베로니카&딘·페르온·스칼렛 환영·스칼렛) |
| `youngPrincessCleared` 설정 | **없음**(읽기만) | 영프 5-10 격파 시 **true** |
| 그랜드 플레닛 게이트 | 데이터 파생으로 우회 | 정상 잠금 (엔딩 필요) |

## 원문 대응

기획서 1기 15화를 5챕터로 묶었다(3화씩 — 원문 막 구조와 일치).

| 챕터 | 원문 | 보스 | 핵심 사건 |
|---|---|---|---|
| `howlrstone1` | 1~3화 | 해롤드 | 왕립도서관·「웨폰마스터를 위한 정리서」·에벤트왕국 서신·크라켄 |
| `howlrstone2` | 4~6화 | 베로니카·딘 | 에벤트왕국·아리·리안·도깨비·라일락 연합 결성·루시 |
| `howlrstone3` | 7~9화 | 페르온 | 엔젤릭 영프·거대 골렘·2대2 교전·다크엑스칼리버·라일락의 희생 |
| `howlrstone4` | 10~12화 | 스칼렛의 환영 | 어둠의 성채·4개의 문(물·바람·번개·불)·아이온·알다바오트·저주 표식 |
| `howlrstone5` | 13~15화 | 스칼렛 | 태양의 표식·THE END TIME·시간의 초월자·New Beginning |

원문에 없는 대사는 **창작하지 않았다**. 원문 문장을 그대로 쓰거나, 시스템 안내(퀘스트 설명·목표 라벨)만 새로 썼다.
예: `"과거의 향기는 라일락꽃밭보다 진하다"`, `"3분뒤에 보시죠"`, `"꽃말이 추억이라… 너의 이름을 부르는 사람마다 추억이 되라고 이름을 지었어"`.

## 왜 `CHAPTERS` 에 넣지 않았나

`tests/story-portraits-audio.test.mjs` 가 `CHAPTERS` 를 **불변식**으로 고정하고 있었다:

```js
assert.deepEqual(CHAPTERS, before.CHAPTERS, '기존 챕터/인덱스/대사/밸런스 보존');
```

거기에 챕터를 끼우면 `num` 기반 인덱스(`CH_EXP[num-2]`, `ELITE_TITLE[num-2]`, `questNeedByLv`)가
전부 어긋나 **본편 밸런스가 회귀**한다. 그래서:

- 데이터는 `src/game/howlrstone.ts` (**런타임 의존 없는 순수 데이터** — `stages.ts` 를 값으로 import 하지 않아 모듈 순환 없음)
- 스테이지 생성은 `stages.ts` 안의 별도 블록(기존 `CHAPTERS` 루프 **뒤**, 같은 방식으로 `STAGES`/`NEXT_STAGE`/`PREV_STAGE`/`STAGE_SHORT` 를 채움)
- 밸런스는 각 챕터의 전용 `scaleMul` — `stageScale()` 이 이 값을 **최우선**으로 쓰므로 기존 곡선 무영향

## 체인

```
본편 1~10장 → (엔딩) → village ──portal──▶ youngprincessv
                                            │
                                            ├─▶ howlrstone11 … howlrstone110
                                            │   howlrstone21 … howlrstone210
                                            │   howlrstone31 … howlrstone310
                                            │   howlrstone41 … howlrstone410
                                            └─▶ howlrstone51 … howlrstone510
                                                        │ (스칼렛 격파 → youngPrincessCleared = true)
                                                        ▼
                                                  dlcstargate1 (그랜드 플래닛)
```

- `NEXT_STAGE.youngprincessv` : `null` → `howlrstone11` (vc230 의 막다른 길 제거)
- `NEXT_STAGE.howlrstone510` : `dlcstargate1`
- `PREV_STAGE.dlcstargatev` : `youngprincessv` (기존 유지)

## 게이트

`STORY_SEQUENCE` 의 `howlrstone` status 를 `not-implemented` → `implemented` 로 바꿨다.
`storyProgression.MIDDLE_CHAPTER_IMPLEMENTED` 가 이 값에서 파생되므로 **코드 변경 없이** 게이트가 잠긴다:

```ts
MIDDLE_CHAPTER_IMPLEMENTED = STORY_SEQUENCE.some(s => s.id === "howlrstone" && s.status !== "not-implemented")
```

결과: 영프 엔딩(`youngPrincessCleared`) 없이는 `dlc*` 진입이 막힌다 — 설계 의도대로.

## 엔딩 처리

`WorldScene.onBossDead()` 에 추가:

```ts
const howlFinal = howlFinalStage(this.stageDef.key);
if (howlFinal) {
  this.youngPrincessCleared = true;
  this.time.delayedCall(1200, () => this.showDialogueOnce("howlrstoneEnding"));
}
```

`final` 판정(`NEXT_STAGE === null`)으로 처리하지 않은 이유: 영프 5-10 의 다음은 `dlcstargate1` 이라 null 이 아니다.
따라서 `this.cleared`(본편 세계 구원)를 건드리지 않도록 `if (!howlFinalStage(...)) this.cleared = final;` 로 분리했다.

## 검증

```
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/howlrstone.test.mjs
  → ALL CHECKS PASS: 50 howlrstone stages (5 chapters x 10) / CHAPTERS untouched (19) /
    chain youngprincess → 1-1 … 5-10 → Grand Planet / gate locked after ending

tests/*.test.mjs 25개    → 전부 통과
npx tsc --noEmit         → exit 0
npx eslint (변경 5파일)   → 0 warning
npm run build:next       → exit 0
```

`tests/howlrstone.test.mjs` 가 고정하는 것:
1. 5챕터 × 10구역 = 50 필드, 빈 퀘스트/빈 스폰 없음
2. `CHAPTERS` 19개 불변 + `stageScale` 을 **HEAD 와 직접 대조**(회귀 0)
3. 체인 전 구간(내부 순차 + 챕터 경계 + 그랜드 플래닛 연결)
4. 게이트 잠금/해제, `youngPrincessCleared` 유무별 분기
5. 보스 5종이 `BOSS_DEFS` 에 실존, 인트로 대사 키 실존, 스폰/퀘스트 몬스터가 `ENEMIES` 에 실존
6. `WorldScene` 이 공용 헬퍼(`howlFinalStage`)를 쓰고 상수를 직접 참조하지 않음

## 밸런스

본편 10장(abyss, lvGate 126) 이후를 전제로 5챕터를 이어 붙였다. 전용 곡선:

| 챕터 | lvGate | HP × | ATK × | EXP × | GOLD × |
|---|---|---|---|---|---|
| 1장 | 130 / 140 | 9.0 | 3.1 | 26,000 | 5.6 |
| 2장 | 146 / 156 | 12.4 | 3.7 | 48,000 | 6.4 |
| 3장 | 164 / 174 | 16.8 | 4.4 | 90,000 | 7.4 |
| 4장 | 184 / 194 | 22.5 | 5.2 | 170,000 | 8.6 |
| 5장 | 204 / 214 | 30.0 | 6.2 | 320,000 | 10.0 |

보스 5종 HP 46,000 → 130,000 (본편 아부디토스 34,000 의 1.35~3.8배 구간).
기존 그랜드 플래닛 DLC 시작(130/140, HP ×?)과 같은 진입 레벨대에서 시작하도록 맞췄다.

> **주의**: 이 수치는 `stageScale` 곡선 기준의 상대 배율이다. 실기기(S20+) 체감 밸런스는
> 아직 측정하지 않았다 — 실제 플레이 튜닝이 남아 있다.

## 남은 것

- **실기기 밸런스 측정** (S20+). 현재 배율은 본편 곡선에서 역산한 값이다.
- **신규 아트 없음** — 보스 5종은 기존 아틀라스 재사용(`boss_jorm`·`boss_vord`·`boss_gram`·`boss_skoll`·`boss_abudditos`).
  영프 전용 보스 아트가 들어오면 `howlrstone.ts` 의 `tex` 필드만 바꾸면 된다.
- **영프 전용 마을 없음** — `youngprincessv` 하나를 5챕터가 공유한다. 챕터별 마을이 필요하면
  `HOWLRSTONE_CHAPTERS` 에 마을 정의를 추가하고 `NEXT_STAGE` 체인에 넣으면 된다.
- **BGM** — `stageTrack` 이 `HUNT_THEME_OF` 에 영프 키가 없어 본편 테마로 폴백한다.
  전용 트랙을 넣으려면 `audio.ts` 의 `HUNT_THEME_OF` 에 `howlrstone1~5` 를 등록하고 ogg 를 추가한다.
