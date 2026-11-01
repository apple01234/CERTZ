# vc230 — 영프 마을 게이트 (막다른 길 제거)

## 문제

직전 작업에서 `youngprincessv`(하울르스톤: 영준 프린세스 시작 마을)와 함께
그랜드 플레닛 진입을 `youngPrincessCleared` 로 잠갔다.

- `storyProgression.storyPortalDestination` — 영프 마을에서만 `dlcstargate1` 반환
- `storyProgression.storyEntryAllowed` — `dlc*` 진입에 `cleared && youngPrincessCleared` 요구
- `PREV_STAGE.dlcstargatev = "youngprincessv"`

그런데 **`youngPrincessCleared` 를 true 로 만드는 코드가 src 전체에 없다**
(읽기·직렬화·복원만 존재: WorldScene 226 / 1403 / 16615행).
영프 마을에는 적·보스·퀘스트가 없어(`boss:false, enemies:[]`) 클리어 판정 지점도 없다.

결과: 본편 엔딩 후 마을 → 영프 마을 → **막다른 길**. 그랜드 플레닛(DLC 10챕터)이 영구 잠긴다.
테스트는 "잠긴다"를 정답으로 단언하고 있어 초록불이었지만, 실제 플레이는 진행 불가다.

## 왜 콘텐츠를 만들지 않았나

`docs/DLC_PLAN.md` 의 진입 조건은 `cleared` 하나뿐이고, 영프 중간편의 원문·챕터·엔딩 사양은
저장소 어디에도 없다. 사양 없이 중간편 스토리를 창작하면 이후 원문과 충돌한다.

## 수정

잠금을 **데이터에서 파생**시킨다. 영프 편이 실제로 구현되면 자동으로 잠기고,
미구현 상태에서는 마을이 경유지로 통과한다.

```ts
// storyProgression.ts
export const MIDDLE_CHAPTER_IMPLEMENTED = STORY_SEQUENCE.some(
  (s) => s.id === "howlrstone" && s.status !== "not-implemented",
);

// 영프 마을 → 그랜드 플레닛: 엔딩을 봤거나, 아직 중간편이 없을 때
progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED ? "dlcstargate1" : null

// dlc* 진입: 본편 클리어 필수 + (엔딩 || 중간편 미구현)
!!progress.cleared && (!!progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED)
```

바뀌지 않은 계약:
- 본편 `cleared` 없이는 영프 마을도 그랜드 플레닛도 열리지 않는다.
- `dlcTalked`(구 NPC 안내 대화 플래그)는 여전히 엔딩 판정에 쓰지 않는다.
- 세이브 키·챕터 인덱스·기존 스테이지 정의는 그대로다(신규 `youngprincessv` 1개만 추가).

## 검증

```
node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/story-progression.test.mjs
ALL CHECKS PASS: base ending → young princess start; Grand Planet gate follows MIDDLE_CHAPTER_IMPLEMENTED=false; base-clear requirement enforced

node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/story-portraits-audio.test.mjs
ALL CHECKS PASS: 205 hunt stages / 49 real Ogg tracks / 31 portrait mappings; chapter/save order unchanged

npx tsc --noEmit            → exit 0
npx eslint (변경 4파일)      → 0 warning
npm run build:next          → exit 0
tests/*.test.mjs 24개        → 전부 통과
```

## 남은 것

영프 편 실제 콘텐츠(중간편 필드·보스·엔딩 트리거)는 여전히 미구현이다.
그 콘텐츠가 들어오면 `STORY_SEQUENCE` 의 `howlrstone` status 를 `not-implemented` 가 아닌 값으로
바꾸는 것만으로 게이트가 잠기고, 엔딩 처리부에서 `youngPrincessCleared = true` 를 세우면 된다.
