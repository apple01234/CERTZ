# REBIRTH 아키텍처 진단 — 1차 / 2026-11-10

기준 HEAD 및 origin/main: `3908f63d1b5fce7514a1cc8a40b1e8ecc2613c71`. 기능 변경 전 작성.
이 문서는 전체 정밀 분석 완료 보고가 아니다. 화면 검증은 아직 없다.

## 확인한 실행 경로
- `/`: src/app/page.tsx → GameRoot → 기존 Phaser WorldScene → Player/Boss.
- WorldScene은 키보드 및 EventBus input:skill1~5b를 Player.useSkill*에 연결한다.
- 별도 CampaignRoot/CampaignScene과 campaign/battle.ts가 공존한다. multiplayer/campaign/server.mjs는 stepBattle을 사용한다. 이 공유 전투만 바꾸면 `/`의 Player가 바뀌지 않는다.
- Player는 body 20×44, world bounds 충돌과 WorldScene.solidGroup collider를 사용한다.
- 기존 S2는 MP 20과 skill2Cd를 사용한다. 독립 무료 이동으로 재활용할 수 없다.
- campaign/battle.ts dodge는 1350ms 재사용 간격과 420ms 무적이다. 돌진과 별개로 보존한다.
- Boss는 def.faceLeft와 플레이어 상대 위치를 사용한다. twin은 !본체.flipX를 사용한다. 실제 원본 방향은 미확인이다. Gram 포함 전역 반전 금지.
- GameRoot는 cinematic:state 구독으로 HUD를 숨긴다. 스킵/종료 후 복구 화면은 미확인이다.
- WorldScene은 화살표/WASD 선택을 지원한다. 화살표 기본 배치의 A/S/D는 스킬·물약 키이므로 강제 WASD 추가 금지.

## 지침 충돌과 적용
AGENTS.md/정본의 ‘하루 혼합 금지’, ‘필요시 에셋 생성 허용’은 최신 사용자 지시로 대체한다. 하루 중심 재각색을 허용하되 기존 주요 인물의 사건과 역할을 보존한다. 신규 그림/오디오 생성은 전면 금지한다. 전체 원문 1~8의 순차 정독과 34장 대조는 아직 미완료이므로 이번 변경에 서사 개작을 넣지 않는다.

## 이번 최소 변경 범위
독립 돌진만 별도 이동 상태로 추가한다. 기존 S2/ID/저장 필드/MP/쿨타임/무적/계정/서버 전투는 변경하지 않는다. Shift와 모바일 이벤트를 동일 진입 메서드에 연결한다. 연출 에셋 확보 전 새 도형/FX를 추가하지 않는다. 게임패드 및 멀티 서버 동작은 미완료이다.

## 요구→파일→회귀
- 34/35/36: combat/freeDash.ts, Player.ts, WorldScene.ts, keyRegistration.ts, TouchControls.tsx → pure geometry 및 Player 메서드 실행 테스트, 입력 배선 계약, tsc/lint.
- 01/02: Boss.ts/stages.ts/원본 시트 → 양방향/Gram/쌍둥이 화면 재현 전 보류.
- 23: Drive 템플릿 확인→로더/방향/장비/멀티 연계. 파일/라이선스 확인 전 보류.
- 47/73/74: catalog/progress/config/buildSave/서버 검토가 추가로 필요. 이번에 데이터 스키마를 바꾸지 않는다.

## 미완료 진단
스킬 전체 ID/실사용 추적, 애니메이션 프레임별 검증, 저장 복원·서버 신뢰 경계 전수, 원본 라이선스 전수, 34장 원문 대조, 참고 영상 직접 관찰, 80항목 화면 검증은 아직 미완료다. 과거 조사 문서는 현재 실행 증거로 간주하지 않는다.
