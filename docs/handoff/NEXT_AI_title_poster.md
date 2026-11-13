# 다음 AI 작업 지시서 — 시작 화면 포스터 후속

작성: 2026-11-12 · 기준: main (시작 화면 포스터 교체 커밋 직후) · 버전 변경 없음(2.2.23 / vc279 유지)

## 0. 먼저 읽을 것
1. `AGENTS.md` (특히 "이 앱" 절의 시작 화면 항목)
2. `worklog.md` 마지막 Task — "시작 화면을 움직이는 포스터로 교체"
3. 이 문서

## 1. 현재 구조 (바꾸지 말 것)
- 배경: `src/components/game/TitlePoster.tsx` (React, 순수 CSS 애니메이션) — 스타일은 `src/app/globals.css`의 `.tp*`.
- 에셋: `public/assets/title/*.webp` 11개. 원본은 사용자 첨부 `Poster_AE_Kit`(1024×571, asset_manifest.json 좌표). 좌표·피벗 수치는 TitlePoster.tsx 상단 상수에 있다.
- 메뉴: `TitleScreen`(Overlays.tsx)의 `.title-menu` — 가로 화면은 포스터 타이틀 상자 바로 아래(CSS 변수 `--w --h --sx --sy`로 계산), 세로 화면은 타이틀 아래 중앙.
- `TitleScene.ts`는 배경색·BGM·`game:new`/`game:continue` 이벤트만 담당한다. 배경 연출을 Phaser로 되돌리지 않는다.
- 계약 테스트: `tests/title-poster.test.mjs`, `tests/title-install-guide.test.mjs`(삭제 확인·RotatePrompt), `tests/retired-story-removal.test.mjs`(옛 서사 문구 금지 — 주석에도 쓰지 말 것).

## 2. 남은 확인 (우선순위 순)
1. **실기기/Android WebView**: 개별 CSS 속성(`translate`/`rotate`/`scale`)과 컨테이너 쿼리 단위(`cqw`)가 동작하는지, 프레임이 부드러운지. 안 되면 `.tp-*` 키프레임을 `transform` 한 줄로 합치고 `--w` 계산을 `vw/vh`로 바꾼다.
2. **저장이 있는 상태**: "마지막 플레이" 칩 + 삭제 버튼이 보일 때 짧은 가로 화면(844×390)에서 메뉴가 푸터와 겹치지 않는지, 스크롤로 닿는지.
3. **중간 비율(4:3, 1.25~1.5)**: 포스터 타이틀이 좌측에서 잘리지 않는지. 필요하면 `--fx` 값을 비율별로 조정.
4. 로비(캐릭터 선택)가 열려 있는 동안 포스터 애니메이션을 멈출지 결정(현재는 계속 구동, 로비가 위를 덮음).
5. 타이틀 문구 정합: 포스터는 "하루는 웨폰마스터가 되었다."이고 문서 title·브랜드는 SERTZ다. 사용자가 원하는 표기를 확인.

## 3. 하지 말 것
- 포스터 PNG 원본(4MB)을 `public/`에 그대로 넣지 않는다(WebP 변환본 사용).
- 키트 밖 이미지를 새로 생성하거나 다른 게임의 에셋을 섞지 않는다.
- 새 의존성 추가 금지, 시작 화면의 접이식 안내/출처(CC-BY)/삭제 확인을 제거하지 않는다.
- 세이브 필드·밸런스·서사는 건드리지 않는다.

## 4. 검증 절차
`npx tsc --noEmit` → `npm test`(723개 이상 통과) → 개발 서버에서 1440×810 / 844×390 / 390×844 캡처.
개발 서버 CSS가 바뀌지 않으면 Turbopack 캐시 문제다: `.next`를 지우고 서버를 다시 시작한다(이번에 실제로 겪음).
