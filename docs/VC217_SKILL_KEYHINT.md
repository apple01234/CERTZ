# vc217 — 스킬 버튼 단축키 표시 동기화

지시: **"스킬 버튼에 단축키 변경시에도 동기화 되는 단축키 (ex. Q) 를 표시해줘"**

## 진단 — "동기화" 로직은 이미 있었고, 두 곳이 깨져 있었다

먼저 오해를 풀어야 했다. 단축키 표시 기능은 **이미 구현돼 있었다**:
`SkillButton` 의 `keyHint` prop, `km` 상태 + `keymap:changed` 구독, `applyKeyBinding` 의
`writeKeyMap` 까지 전부 연결돼 있었다. 그래서 "없는 기능을 새로 만드는" 게 아니라
**왜 안 보이는지**를 찾는 문제였다.

### 원인 ① 배지가 원 밖으로 잘려나갔다 (진짜 원인)

`SkillButton` 의 배지는 `left-0.5 top-0.5`(2px, 2px) 에 있었고 버튼은
`rounded-full` + **`overflow-hidden`** 이다. 원(지름 56px, 반지름 28px) 안에서
배지 위치를 계산하면:

| 지점 | 좌표 | 중심거리 | 원 내부 |
|---|---|---|---|
| 배지 좌상단 | (2, 2) | **36.8px** | ✗ |
| 배지 중심 | (11, 8) | 26.2px | ✓ |
| 배지 우하단 | (20, 14) | 16.1px | ✓ |

좌상단 모서리가 반지름 28px 밖이라 **`overflow-hidden` 이 잘라낸다.**
즉 배지가 원호 바깥 사분면에 앉아 대부분 잘려 보이지 않았다.

**수정**: `left-[10%] top-[10%]` 로 원 안쪽으로 밀어넣고, 크기를 8px→9px,
`min-w-[13px]` + `flex` 중앙정렬로 키 한 글자가 또렷하게 보이게 했다.

### 원인 ② 터치 기기에서 무조건 숨겼다

```tsx
keyHint={isTouch ? undefined : keyLabel(...)}   // 이전
```

`isTouch` 판정은 `pointer: coarse` 또는 `width < 900` 인데, 이 조건은
**블루투스 키보드를 붙인 태블릿/폰도 포함**한다. 그 기기에서는 키가 실제로
동작하는데 힌트만 사라져 "동기화가 안 된다"는 인상을 줬다.

**수정**: 기기 무관하게 표시. 키보드가 없으면 배지가 보일 뿐 손해가 없다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/components/game/SkillButton.tsx` | 배지를 원 안쪽(10%)으로 이동, 9px/`min-w-13px` 로 확대 |
| `src/components/game/TouchControls.tsx` | 스킬 1~4·궁극기 1·2 의 `isTouch ? undefined :` 제거, **공격 버튼에 배지 신규 추가** |

공격 버튼은 단축키 표시가 **아예 없었다**(`aria-label="공격"` 만). 스킬과 같은 규칙
(원 안쪽 10%, 동일 배지 스타일)으로 맞춰 불일치를 없앴다.

## 동기화 경로 (검증된 계약)

```
설정 패널에서 키 입력
  → applyKeyBinding(km, action, key, scheme)   // 중복이면 swap, 이동키는 거부
  → writeKeyMap(next)                          // localStorage 저장
  → EventBus.emit("keymap:changed", next)
  → TouchControls 의 onKm → setKm(loadKeyMap()) // 리렌더
  → SkillButton keyHint={keyLabel(km.skillN)}   // 배지 갱신
```

`keyLabel` 이 `UP/DOWN/LEFT/RIGHT` 를 `↑↓←→` 로 바꿔주므로 화살표 배정도 표시된다.

## 검증 — `tests/keyhint-sync.test.mjs` **10 PASS / 0 FAIL**

```
PASS  기본 skill5b = Q (Q)
PASS  keyLabel(Q) = Q
PASS  keyLabel(UP) = ↑
PASS  keyLabel(LEFT) = ←
PASS  skill5b Q→T 반영 (Q → T)
PASS  중복 배정은 swap (attack X→Z, skill1 Z→X)
PASS  이동 전용 키 거부 (Q)
PASS  스킴별 키맵 분리 (17개 액션에서 다름: skill3,skill4,skill5,skill5b,potHp…)
PASS  skill5b 스킴별 상이 (arrows=Q / wasd=E)
PASS  모든 스킬/공격에 라벨 존재 (attack=X skill1=Z skill2=C skill3=V skill4=A skill5=S skill5b=Q)
```

### 테스트 작성 중 잡은 오탐

처음엔 `arrows.skill1 !== wasd.skill1` 로 스킴 분리를 검사했는데 FAIL 이 났다.
원인은 **테스트가 틀린 것**이었다 — 두 스킴 모두 `attack=X, skill1=Z` 로 겹친다.
전체를 비교하니 **17개 액션이 다르다**(skill3 V→F, skill5 S→Q, skill5b Q→E …).
`attack`/`skill1` 만 보면 "버그"로 오판하는 함정이었다.

## 게이트

| 검사 | 결과 |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint src --max-warnings 0` | exit 0 |
| `utility-ai.test.mjs` | 22 PASS |
| `morale-ai.test.mjs` | 8 PASS |
| `keyhint-sync.test.mjs` | 10 PASS |
| `next build` | exit 0 (`Compiled successfully in 62s`) |

## 남은 한계

- 배지는 **키 한 글자(또는 화살표 기호)** 기준으로 설계됐다. `Space` 처럼 여러 글자인
  바인딩은 `min-w` 를 넘겨 배지가 넓어진다 — 실제로는 스킬에 `Space` 를 배정하기
  어렵지만(`interact` 기본값), 이론상 원 밖으로 밀릴 수 있다.
- 배지는 **텍스트 라벨**이다. 게임패드 버튼 아이콘(Xbox/PS)은 지원하지 않는다.
- 실기기(S20+) 육안 확인은 미완 — 이 환경에서는 `next build` 와 정적 검증까지만 가능했다.
