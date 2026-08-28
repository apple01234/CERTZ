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

---
Task ID: assets-1
Agent: Super Z (main)
Task: 사용자 지시 — itch.io 무료 탑다운 에셋으로 게임 그래픽 전환 ("이것들 이용해 / 너가 에셋 생성 최대한 하지마") + 업로드 zip 미도착 원인 파악

Work Log:
- 업로드된 "Pixel Crawler - Free Pack 2.11.zip"이 서버에 미도착 확인 (upload/ 비어있음, 파일시스템 전수검색 0건)
- "왜 만들던거 날라감?" → 이전 세션 워크스페이스 리셋 이력(worklog rebuild-1)으로 설명, 소스는 재구축 완료 상태로 온전함 확인
- itch.io 직접 다운로드는 안티봇으로 차단 → OpenGameArt/Kenney 직접 다운로드로 전환:
  - Zelda-like tilesets and sprites (ArMM1998, CC0): 주인공 4방향 걷기+4방향 검공격 4프레임, 타일, 꽃, 하트, 불꽃/반짝임/타격스타/수정
  - Kenney Tiny Dungeon (CC0): 고스트 하수인
  - Kenney Roguelike/RPG pack (CC0): 둥근나무/소나무/횃불 (17px 그리드 1px 마진 처리)
  - [LPC] Wolf Animation (williamthompsonj, CC-BY 3.0/4.0): 늑대 64x32 측면 프레임
  - Sotrak Rewop (gilgaphoenixignis, CC-BY 3.0/4.0): 보스
- scripts/build_assets.py — 원본 시트에서 게임 해상도로 사전 베이크 (public/assets/ 65종, 276KB)
  - 주인공: 96x64 캔버스, 붉은 튜닉 무게중심 자동 정렬, 방향별 walk/atk 프레임 확정(y32=우, y96=좌, atk y192=우)
- 코드 통합:
  - BootScene: preload 에셋 로드 + VFX만 절차 생성(slash_arc/beacon/glow/ring/orb/portal 등)
  - textures.ts: 캐릭터/타일/장식 생성 코드 전면 제거, VFX 전용으로 축소 + 신규 애니(hero-walk-up/side, hero-atk-up/down, flame-burn, sparkle)
  - Player.ts: 방향 우세축 기준 실제 걷기/공격 프레임 선택, body 20x44@offset(38,20)
  - Enemy/Boss/WorldScene: 새 캔버스 크기에 맞춘 body/offset, 알프헤임 횃불 6개+글로우, 파편 반짝임, 타격 스타 풀(4장)
  - HUD: 실제 하트 5칸 (full/half/empty)
  - Overlays: 타이틀 하단 CC/CC-BY 크레딧 표기, public/assets/CREDITS.md 추가
- 🐛 **소프트락 발견·수정**: 파편보다 늑대를 먼저 전멸시키면 토벌 킬카운트가 퀘스트 활성화에 종속돼 진행 불가
  → killTotals(스테이지 누적 킬) 기반 판정으로 변경 + collectFragment 후 tryCompleteHunt() 호출
- Agent Browser E2E 전체 통과: 타이틀→인트로→늑대4킬(선킬)→파편수집→퀘스트 자동완료→포탈→알프헤임(횃불/고스트)→하수인5킬→보스 소환(텔레그래프/HP바)→격파→클리어 세이브→엔드화면 / 사망→부활 / 콘솔 에러 0 / worldChildren 88(누수 없음)
- tsc 0 에러, ESLint 0 에러

Stage Summary:
- 산출물: public/assets/ 65종(+CREDITS.md), scripts/build_assets.py, src/game/** 수정 5파일, HUD/Overlays
- 제약 준수: APK 미빌드 (사용자 지시 시에만 — 이전 세션 빌드 도구는 세션 리셋으로 소실, 재설치 필요)
- 이슈: 사용자 업로드 zip 미도착 → 재업로드 요청 필요 시 안내

---
Task ID: fx-1
Agent: Super Z (main)
Task: 사용자 지시 — ①회전베기 이펙트 개선 ②캐릭터가 바라보는 방향의 반달모양 베기 이펙트

Work Log:
- textures.ts: 기존 스트로크 호(slash_arc)를 "채워진 룬(lune)" 반달 텍스처(slash_crescent 128x128)로 교체
  - 외호 O(44,64) R50 + 내호 I(10,64) r60.46 교차 → 끝이 뾰족하게 테이퍼되는 진짜 초승달
  - 청백 라디얼 그라디언트 본체 + 외곽 글로우 2겹 + 칼날 외연 하이라이트 + 내부 에코 궤적 2줄
- slash_ring 충격파 개선: 소프트 그라디언트 링(중심 투명→흰 코어→바깥 페이드)
- WorldScene.ts:
  - spawnSlash 재작성: 반달을 조준 방향에 배치(origin 0.344=반달 원심), 교차 스윕 ±35°, 스케일 팝 0.74→1.16, Sine.in 페이드 — 이전의 과도한 190° 회전 스윕 제거
  - spawnSpinSlash 신설(구 spawnSpinRing 정적 링 제거): 반달 2장이 플레이어 중심축으로 360° 궤도 회전(본체+트레일), 회전 후반 확장 충격파, 청백 스파크 10발, 미세 카메라 킥
- Player.ts useSkill1: setVelocity(0,0) 정지 추가, 몸통 스프라이트 360° rotation 트윈(Cubic.inOut 250ms, 완료 시 0 리셋), hero-atk 프레임으로 회전, 지속 260→310ms
- 검증(agent-browser + __SERTZ__ 훅):
  - 슬로우모션(timeScale 0.15)으로 우/하/상 반달 참격 직접 스폰 → 스크린샷 3종 모두 조준 방향 정확히 반달 렌더 확인
  - useSkill1 실호환: 몸통 회전 + 궤도 반달 + 충격파 링 캡처 확인, 완료 후 rot=0/idle 복귀
  - 실전 속도 통합: SPACE 키 → slash_active=1 state=attack 확인, K키 → mp 60→45 소모 확인
  - tsc 0 에러, ESLint 0 에러, 콘솔 에러 0, world children 66 불변(누수 없음)
- 테스트 노트: 합성 키 이벤트 테스트 시 dialoguing 게이트/스테일 키 플래그로 오판 가능 — 세션 재검증 시 dialogue 먼저 닫고 keys.reset() 후 진행

Stage Summary:
- 산출물: src/game/textures.ts, src/game/scenes/WorldScene.ts, src/game/entities/Player.ts
- 참격이 "회전하는 선"에서 "조준 방향의 반달 검기"로, 회전베기가 "정적 링"에서 "몸통 360° 회전+궤도 반달+충격파"로 개선됨
- 제약 준수: APK 미빌드 (사용자 지시 시에만)

---
Task ID: assets-2
Agent: Super Z (main)
Task: 사용자 지시 "너가 제작하지 말고 에셋 사용하라닌까" — 남은 절차 생성 VFX 11종 + WebAudio 합성 사운드 전부 외부 실제 에셋으로 전환

Work Log:
- 이전 세션(assets-1)에서 캐릭터/타일/장식은 외부화됐지만 textures.ts의 VFX 11종(slash_crescent/slash_ring/beacon/glow/edge_arrow/quest_mark/ring/orb/crack/shadow/portal)과 audio.ts 합성음이 남아있었음 → 전면 제거
- 다운로드 (scripts/asset-sources/assets-src/):
  - Weapon Slash - Effect by Cethiel (CC0): 청색 초승달 참격 24프레임 → 6프레임 선별
  - Animated Portal or Wormhole by varkalandar (CC-BY 4.0): 8번 변형 64프레임 → 8프레임, 루미넌스 알파 변환(검은배경→투명)
  - Kenney Particle Pack (CC0): 충격파링 circle_02 / 텔레그래프링 circle_03 / 글로우 light_01 / 구슬 circle_05 / 스코치 scorch_01
  - Kenney Light Masks (CC0): 빛기둥 cone_b_blur (아래가 밝게 정렬 + 루미넌스 알파)
  - Kenney Roguelike (CC0): 화살표 타일 (52,25) — 런타임 골드 틴트
  - Zelda-like objects.png (CC0): "?" 말풍선 (3,8)
  - Retro Game Music Pack by Juhani Junkala (CC0): BGM 3트랙 (WAV→OGG 변환, title/field=Level1/boss=Level3)
  - 80 CC0 RPG SFX + 80 CC0 creature SFX by Rubberduck (CC0): SFX 12종 (blade/metal/hurt/gem/spell/roar/die/monster)
- scripts/build_vfx_audio.py 신설 — VFX 프레임 베이크 + 오디오 변환/배치 (public/assets/ + audio/ 27파일)
- 코드:
  - textures.ts: 캔버스 절차 생성 전면 삭제 → buildAllAnims(외부 프레임 애니 등록)만 남김 (fx-slash 6프레임 30fps, portal-spin 8프레임 10fps)
  - BootScene: VFX 이미지 24종 + 오디오 15종 로드 추가, buildVfxTextures 호출 제거
  - audio.ts: WebAudio 신스 전면 삭제 → Phaser SoundManager 파일 재생 재작성 (API 서면 유지: initAudio/setMuted/playBGM/stopBGM/sfx.*), attachAudio(game) 신설
  - PhaserGame: createGame에서 attachAudio 호출
  - WorldScene: slashPool Image→Sprite("fx-slash" 애니 재생+animationcomplete 은퇴, 재사용 시 off 가드), spawnSlash 재작성(초승달 스윕 애니+교차 미세회전), 충격파 shock_ring, 지면 scorch(틴트 0x8a7a66), 빛기둥 beam(48x256, y-128), 차원문 8프레임 바디 재조정, 가장자리 화살표 골드 틴트, 퀘스트 마커 스케일 1.3
  - Boss: 투사체 구슬 보라 틴트+ADD 블렌드, 강타 텔레그래프 적색 틴트
  - Overlays: 타이틀 크레딧 갱신 / CREDITS.md 전면 재작성 (CC0 8종 + CC-BY 3종)
- 검증:
  - tsc 0 에러, ESLint 0 에러
  - agent-browser E2E 풀 플로우: 타이틀→인트로→파편(빛기둥/글로우/?마커 렌더 확인)→수집(atk+5)→늑대 토벌→사망/부활(HP100 복원)→차원문(소용돌이 애니+보라 빛기둥)→알프헤임(횃불/고스트)→하수인 5킬→보스(붉은 링 텔레그래프/보라 발광 구슬/분노)→격파→클리어→엔드화면 전부 통과
  - 콘솔 에러 0, world children 66 불변(누수 없음), BGM 필드 트랙 재생 확인
  - 참격 4방향 스폰 검증(초승달 볼록 방향 = 무게중심 계산 slash0 약 +11°, 회전 오프셋 정합)
  - 테스트로 오염된 localStorage 세이브 삭제 완료(유저 신규 시작 보장)

Stage Summary:
- 산출물: public/assets/ VFX 24종+audio 15종, scripts/build_vfx_audio.py, src/game/** 6파일, CREDITS.md
- 게임 내 자체 제작 요소 0% — 그래픽/사운드 전부 실제 외부 에셋 (CC0 8팩 + CC-BY 3팩, 크레딧 표기)
- 제약 준수: APK 미빌드 (사용자 지시 시에만 — 빌드 시 이전 세션 도구 소실로 JDK21/Android SDK 재설치 필요)

---
Task ID: verify-1
Agent: Super Z (main)
Task: 사용자 신규 지시 "너가 만든요소도 꼭 필요할때는 써" — 정책 갱신(외부 에셋 우선 + 필요시 자체 제작 허용) 수용 및 현재 디스크 상태 전수 재검증

Work Log:
- 디스크 상태 확인: src/game/** 전부 존재, public/assets/ 87종(이미지+audio 15종) 존재 — assets-2 완료 상태 그대로 보존
- textures.ts 확인: 애니 등록 전용(절차 텍스처 생성 코드 0) / BootScene: 외부 에셋 65종+오디오 15종 로드 구조
- bunx tsc --noEmit → 0 에러, dev 서버 정상 컴파일
- agent-browser 실측: 타이틀(크레딧 표기 확인)→새로운 모험→월드 렌더(주인공/늑대/타일/꽃 밀도/빛나는 파편 퀘스트 54m 트래커/HUD 하트 5칸 전부 외부 에셋)→대화 진행
- worldChildren 66 불변(누수 없음, assets-2 검증치와 일치), 페이지 에러 0, 콘솔 에러 0
- 정책 반영: 그래픽/사운드 자체 제작 요소는 현재 0% — 되돌릴 항목 없음, 향후 꼭 필요한 요소(예: 외부 팩에 없는 특수 이펙트)에 한해 자체 제작 허용

Stage Summary:
- 현행 빌드는 6항 피드백 전부 반영 + 외부 에셋 100% 상태로 검증됨
- APK 미빌드 (사용자 지시 시에만 — 빌드 시 JDK21/Android SDK 재설치 필요)

---
Task ID: fix-2
Agent: Super Z (main)
Task: 사용자 피드백 2건 — ①캐릭터가 맵 밖으로 (카메라) 나가는 오류 ②벨 때 돌진 금지 + 검 이펙트/히트박스 확대

Work Log:
- ① 원인: Player/Enemy/Boss 어디에도 setCollideWorldBounds 미설정 → 물리 월드 경계가 있어도 바디가 무시하고 이탈 (카메라는 bounds에 걸려 멈추고 캐릭터만 맵 밖으로)
  - Player: setCollideWorldBounds(true) + pushable=false (러지/넉백/대시 전부 경계 차단)
  - Enemy: 동일 적용 (추격/넉백 이탈 방지) / Boss: 동일 적용 (돌진/넉백 아레나 이탈 방지)
  - TS 유니온 타입 이슈로 (body as Arcade.Body) 캐스팅 필요 (StaticBody엔 setCollideWorldBounds 메서드 없음)
- ② Player.doAttack(): 전방 러지(setVelocity dir*360) 제거 → setVelocity(0,0) 제자리 베기
  - 참격 판정 확대: checkMeleeHit(dir, 130,84) → (dir, 160,116) — 전방 160px x 폭 116px
  - WorldScene.spawnSlash(): 스케일 0.92 → 1.35 (64x76 원본 → 화면 ~86x103), 전방 오프셋 22→30
- 검증 (agent-browser + touchMove/attackQueued 실입력 경로):
  - 경계: x=180에서 좌 이동 2.6초 → x=10에서 blocked.left=true 정지 (수정 전이면 -418) / 늑대 넉백 후에도 맵 내 유지
  - 돌진: 공격 타임라인 20ms 샘플링 → 공격 내내 vx=0, 위치 변화 0
  - 참격: slash sprite scaleX=1.35 확인, 슬로모션 캡처에서 대형 초승달 렌더
  - 히트박스: 늑대와 160px 거리에서 공격 → 명중(34→22) — 구판정 최대사거리 ~153px로는 불가능한 거리
- tsc 0 에러, ESLint 0 에러, 콘솔 에러 0, localStorage 오염 없음

Stage Summary:
- 산출물: src/game/entities/{Player,Enemy,Boss}.ts, src/game/scenes/WorldScene.ts
- 맵 이탈 버그 근본 수정 (3개 엔티티 경계 충돌) + 베기 모션 제자리화 + 참격 이펙트/판정 확대
- 제약 준수: APK 미빌드 (사용자 지시 시에만)
