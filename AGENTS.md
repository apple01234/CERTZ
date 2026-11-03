# SERTZ — 에이전트 작업 규칙 (ponytail: lazy senior dev mode)

> 출처: https://github.com/DietrichGebert/ponytail (MIT) — 전체 규칙은 `skills/ponytail/SKILL.md`.
> 이 저장소에서 작업하는 모든 AI 에이전트는 아래 사다리를 **코드를 쓰기 전에** 수행한다.

코드를 쓰기 전에, 먼저 걸맞은 단계에서 멈춘다:

1. 이게 있을 필요가 있나? → 없다: 한 줄로 이유를 쓰고 건너뛴다 (YAGNI)
2. 이미 이 코드베이스에 있나? → 다시 짜지 말고 가져다 쓴다 (data.ts의 ITEMS/BUFF_DEFS/PET_DEFS/COSMETIC_DEFS, EventBus, reward:show, startTransition 등)
3. 표준 라이브러리로 되나? → 쓴다
4. 네이티브 플랫폼 기능인가? → 쓴다 (CSS 연출 > JS 애니메이션 등)
5. 깔려 있는 의존성이 푸나? → 쓴다 (새 의존성 금지)
6. 한 줄로 되나? → 한 줄
7. 그제서야: 돌아가는 최소한

사다리는 문제를 이해한 **다음**에 밟는다. 변경이 닿는 코드를 읽고 실제 흐름을 추적한 뒤에 고른다.

## 프로젝트별 철칙 (유저 지시 누적)

- 기존 틀과 내용은 유지 — 최적화/리팩터가 콘텐츠를 죽이면 실패다.
- 스킬에만 화려한 이펙트. 기본공격·적 처치 등 **자주 호출되는 지점은 절대 과하게** (파티클 수/스케일 축소 유지).
- 씬 전환은 반드시 `startTransition()` 단일 통로로 — 검은 화면 버그 재발 금지.
- 세이브 필드 추가 시 config.ts SaveData + 복원 + buildSave 3곳 싱크.
- 사운드 파일 다운로드(soundeffect-lab)는 referer 헤더 필수.
- APK 빌드는 `JAVA_HOME=/home/z/jdk` (세션 리셋 시 툴체인 재구축 선행).
- 버전 싱크 6곳: android/app/build.gradle, server.js, next.config.ts, public/apk-guide.html, download/APK_다운로드_안내.txt, src/components/game/Overlays.tsx 배지.
- 마감 후 worklog.md에 Task 섹션 append.

## 게으름 관련 예외 (게으르면 안 되는 것)

- 신뢰 경계 검증(구매/결제 입력), 데이터 손실 방지(세이브), 보안, 접근성 기본.
- 유저가 명시적으로 요구한 것 (예: "아이템 100개 이상" — 데이터는 정직하게 100+ 채운다).
- 비자명한 로직에는 실행 가능한 체크 1개 남긴다 (tsc --noEmit 최소).

Mark deliberate ceilings with a `ponytail:` comment naming the upgrade path.

## 최신 사용자 지시 및 인계 (2026-11-03)

- 작업·커밋·푸시 대상은 **apple01234/CERTZ의 main**이다. 이전 SERTZ 전용 지시는 폐기한다.
- 기존 GameRoot/WorldScene/Player/장비/전직/하우징/계정/멀티플레이와 화면 구조를 유지하며 아뜰란티스·이그드라실 서사를 교체한다. 새 독립 캠페인 엔진으로 다시 만들지 않는다.
- 정본은 `docs/handoff/evernote-approved/1.txt`부터 `8.txt`까지 순서대로 읽는다. 다른 기획·스토리 문서는 읽지 않는다. 충돌 시 먼저 지정한 문서를 우선한다.
- 에셋은 기존 자료와 다운로드를 우선하고 꼭 필요한 경우에만 생성한다. 원본 런타임 에셋을 배포에서 제거하지 않는다.
- 2026-11-03 후속 수정: `/`는 원래 GameRoot로 복구했다. 옛 9개 지역은 서사/엔딩 없이 선택 수련 원정으로 남기고, 시작 거점에서 라일락 월드로 바로 연결한다. 옛 본편 클리어는 입장 조건이 아니다. 보존 패치는 과거 초안이므로 그대로 재적용하지 않는다.
- 다음 작업 전 `docs/handoff/DEEPSEEK_HANDOFF.md`를 읽는다. 아래 항목은 이전 구현의 역사이며 최신 지시와 충돌하면 적용하지 않는다.

## 이전 제품 기록 — 기억의 서약 (v2.0.0)

- 사용자 최신 지시가 과거의 ‘기존 9챕터 유지’ 규칙보다 우선한다. **9개의 바다를 새 게임에 되살리지 않는다.**
- 진입점: `src/components/campaign/CampaignRoot.tsx`. 정본·진행·전투: `src/game/campaign/`. 이전 WorldScene/데이터는 호환성 검사 및 과거 소스이며 새 게임 진입점이 아니다.
- 초기 15화 정본, 2부 10장, 새 각색 3부 9장. 후반 하루 리부트와 혼합 금지.
- 에셋은 사용자 Drive 소스의 SPUM 캐릭터·원본 초상·숲/마을/던전 소품과 DCSS 32px 지형/보스를 사용한다. Kenney Tiny Town/Tiny Dungeon을 새 캠페인에 다시 연결하지 않는다. 기존 `DECOR_SETS`/`DECOR_BUDGET`와 `npcportrait/_map.json`을 재사용하고 `campaign-assets.mjs` 배포 허용 목록을 유지한다.
- 구 저장 키/계정 자산은 읽기 전용 보관. 새 캠페인의 저장·거래·랭킹·구매 대장은 `memory-oath-v1`로 분리한다.
- 새 캠페인 테스트: `npm run test:campaign`, 브라우저: `npm run test:campaign:browser`. 온라인 전투는 별도 Node 24 서버가 판정한다.
