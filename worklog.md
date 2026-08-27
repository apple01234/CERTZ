# SERTZ 개발 작업 로그

---
Task ID: rebuild-1
Agent: Super Z (main)
Task: 워크스페이스 리셋으로 소스 전체 유실 → 사용자 피드백 6건(늑대퀘스트 해제 제외 5건 + 유지 항목)을 반영한 게임 전면 재구축

Work Log:
- 워크스페이스가 초기 커밋만 남긴 채 리셋된 것 확인 → fullstack-dev 스킬로 환경 재초기화, phaser@3.90.0 설치
- 게임 전면 재구축 (외부 리소스 0: 절차적 픽셀아트 + WebAudio 합성):
  - src/game/textures.ts — 캔버스 픽셀아트 전량(주인공 3프레임 베기 모션 포함), 결정적 LCG 랜덤
  - src/game/audio.ts — WebAudio 신스 SFX 13종 + 경량 BGM 스케줄러(필드/보스/타이틀)
  - src/game/data.ts — STAGES/QUESTS/ENEMIES/DIALOGUES (오리지널 명칭)
  - src/game/entities/Player.ts — F5: 전방 130px X축 히트박스, 3프레임 베기+참격 이펙트, 러지, 히트스톱 45ms, 넉백, 상하공격, 회전베기/돌진베기
  - src/game/entities/Enemy.ts — 늑대/하수인 상태머신 AI(wander/chase/windup/cooldown)
  - src/game/entities/Boss.ts — F4: 24발 고정 투사체 풀, 텍스처 텔레그래프, 분노 페이즈
  - src/game/scenes/WorldScene.ts — F1 꽃 ≤10송이, F2 빛기둥 비컨+가장자리 화살표+거리표시, 풀링 FX(텍스트12/참격5/공유이미터2)
  - src/game/scenes/BootScene.ts, TitleScene.ts, PhaserGame.ts — Scale.FIT 반응형
  - React UI: GameRoot/HUD/TouchControls(멀티터치 조이스틱)/DialogueBox/Overlays(타이틀/배너/보스바/엔드/회전안내)
- Agent Browser E2E 검증 중 **치명 버그 2건 발견·수정**:
  1. **Enemy.die(): this.destroy() 후 this.scene 접근 → scene=null TypeError → 킬 카운트 영원히 미진행 (과거 늑대 퀘스트 버그의 근본 원인)** → 씬 참조 선(先)캡처로 수정
  2. **buildFxPools: 씬 재시작 시 데미지텍스트 풀 누적 → 파괴된 Text.setText 크래시** → 풀 리셋+파괴 가드 추가
  3. 승리 시 ui:title 이벤트가 엔드화면을 덮는 문제 → 엔드화면이 최종 화면이도록 수정
  4. TouchControls viewport 리사이즈 시 재평가 추가
- E2E 전체 통과: 타이틀→인트로→파편줍기(quest 0→1, atk+5)→늑대4킬(quest→2, 포탈 개방)→알프헤임→하수인5킬→보스 소환→분노→보스 격파→클리어 세이브→이어하기 복원 / 사망→부활(진행 보존) / 조이스틱 실드래그 이동(dx+291) / 스페이스 실입격 격파(exp+14)
- 성능: 보스전 내내 displayObjects 73개 불변(0 누수), 헤드리스 소프트웨어 렌더링 환경 특성상 FPS 수치는 무의미 — 객체 churn 제거가 이전 렉의 구조적 해결
- TypeScript 0 에러, ESLint 통과, dev 서버 정상

Stage Summary:
- 산출물: src/game/**, src/components/game/**, next.config.ts(APK 분기 복원), capacitor.config.ts
- APK 미빌드 (사용자 지시 시에만): 빌드 시 필요 — bun add @capacitor/core @capacitor/cli @capacitor/android && bun run build:apk(스크립트 추가 필요: APK_EXPORT=1 next build && rm -rf out && mv .next-apk out) && bunx cap sync android && gradlew assembleDebug (JDK21/Android SDK 재다운로드 필요 — 이전 세션 .jdk21/.android-sdk 소실)
- 제약 준수: "apk 빌드해 라고 할때만 빌드" — 코드 수정만 수행, 패키징 없음
