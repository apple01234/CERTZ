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
