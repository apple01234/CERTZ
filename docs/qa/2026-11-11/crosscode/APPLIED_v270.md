# GM 패널 버튼·권한 가드 — v2.2.14 / vc270

이번 변경은 CrossCode 조사가 아니라 **사용자 요청 8번**(GM 패널을 가방 왼쪽에, admin 로그인 시에만) 구현이다.

## 배경 (변경 전 상태)

`GmPanel`은 이미 존재했지만(`Panels.tsx`) **마을 우물 옆 GM NPC와 대화해야만** 열 수 있었다.
관리자가 GM 도구를 쓰려면 매번 맵을 찾아가 NPC를 찾아야 했고, `HUD`에는 진입점이 없었다.
또 `GmPanel` 자체에 권한 검사가 없어, 열리기만 하면 누구나 도구를 볼 수 있는 구조였다.

## 변경

1. **HUD 진입점** (`src/components/game/HUD.tsx`)
   가방 버튼 **왼쪽**에 GM 버튼(`Crown` + `GM` 배지) 추가. `isAdmin`일 때만 렌더한다.
2. **권한 상태** (`src/components/game/GameRoot.tsx`)
   `authMe()`의 `role === "admin"`으로 판정하고 `auth:changed` 이벤트로 로그인/로그아웃 즉시 갱신한다.
   기존 `PanelKind`에 `"gm"`이 이미 있어 `togglePanelSfx("gm")`으로 기존 `GmPanel`을 그대로 연다.
3. **패널 내부 가드** (`src/components/game/Panels.tsx`)
   UI 숨김과 별개로, `GmPanel`이 로딩 중이면 아무것도 그리지 않고, 비관리자면 "관리자 전용" 안내만 그린다.
   **UI 숨김은 편의일 뿐 보안이 아니다** — 실제 GM 액션 권한은 서버 API가 계속 검사한다.

## 검증

- `npx tsc --noEmit` 통과 (편집 중 LSP가 잡은 두 오류 — `authMe` 미import, `"gm"` 유니온 누락 — 모두 해결)
- `npm run lint:strict` 통과 (`--max-warnings 0`)
- `npm test` **622 통과 / 0 실패**
- `npx next build --webpack` 성공
- 런타임 `scripts/playtest-gm-button.mjs` → **PASS**

| 조건 | GM 버튼 | 가방 버튼 | DOM 순서 |
|---|---|---|---|
| 비관리자 | false (숨김) | true | — |
| 관리자(`role=admin`) | true | true | `gm-before-bag` |

관리자 케이스는 `/api/auth/me` 응답을 라우팅으로 대체했다. 이는 **UI가 role 에 반응하는지만** 확인하며,
서버 권한 검증을 대신하지 않는다. 비관리자 케이스는 실제 로그아웃 상태 그대로 측정했다.

## 검증하지 못한 것

- 실제 GM 계정으로 운영 서버에 로그인해 버튼이 뜨는지는 확인하지 않았다. 서버 계정·자격증명이 필요하다.
- GM 액션(아이템 지급 등)의 서버측 권한 거부 응답은 이번에 호출하지 않았다.
- 실기기(S20+) 터치로 GM 버튼을 누르는 동작은 미확인.

## 참고

이번 커밋은 vc269 체크포인트(외형·전체 로딩·파티)를 포함한다. 그 체크포인트는 인계 문서에
"전체 회귀·빌드 재검증 미실시"로 적혀 있었으므로, 이번에 다음을 실제로 돌렸다.

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 (29s) |
| `npm test` | 622/622 통과 (113s) |
| `npm run lint:strict` | 통과 (63s) |
| `npm run build:next` | 성공 |
