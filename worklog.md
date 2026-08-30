# SERTZ Worklog

---
Task ID: v2-sync
Agent: Super Z (main)
Task: git pull 요청 처리 + 원격 동기화

Work Log:
- git pull → Already up to date (원격 신규 없음)
- 로컬 미푸시 커밋 1개(02bc61e, v1.9 E2E 스크린샷 체크포인트) 확인 후 push (8ea1f20..02bc61e)
- .gh_token 저장 파일로 push 경로 유지

Stage Summary:
- 로컬 = origin/main 완전 동기화 (02bc61e)

---
Task ID: v2-recover
Agent: Super Z (main)
Task: 사용자 Google Drive 이전 프로젝트 복구 + 20개 지시사항 반영 준비

Work Log:
- Google Drive 파일(1_YWNXI1u7rWLgYfcwt7CpsxCbrBcPJiB, 463MB) 다운로드 완료
- prev-project/extracted/SERTZ-workspace-20260829 해제: 45커밋 git 히스토리 + 전체 소스 + 에셋팩 18종(221MB) + public/assets 236 PNG
- 이전 버전 = v1.5 (스토리 10장 55퀘스트, 보스 9종, 몬스터 12종, 복귀 차원문, 8 BGM, 외부 에셋 26종, 에필로그)
- 현재 버전(v1.9) 대비 손실 확인: 스토리 4장, 복귀 포탈, 스토리 대사, 8BGM, 외부 에셋, 강화 12단계
- 채팅 안됨 원인 발견: netJoin이 소켓 연결 전 호출 시 조용히 실패 + 서버가 미 join 플레이어 채팅 폐기
- 타입 정의 동일 조상 확인 → 안전 포워드 포팅 전략 확정

Stage Summary:
- 병합 전략: 현재 repo(v1.9)를 베이스로 이전 스토리 데이터 복구

---
Task ID: v2-impl
Agent: Super Z (main)
Task: v2.0 대규모 업데이트 — 사용자 20개 지시사항 구현

Work Log:
- 에셋 이관: 이전 public/assets 236 PNG + 8 BGM ogg 전부 복사 (CREDITS.md 포함)
- src/game/stages.ts 신규 생성: 9챕터 × 10구역 = 90필드 생성기 + 12몬스터 + 9보스 + PREV_STAGE/STAGE_SHORT/stageScale/stageIntro/STAGE_THEME (지시 #6, #19)
- data.ts 재구성: 스테이지 데이터 stages.ts 재수출 + v1.5 스토리 대사 전면 복원(아뜰란티스 7보석 라인 ~45건) + 구역 탐험/정예경고/보스접근 대사 자동 생성 + 강화 12단계(UPGRADE_MAX 12, rates, +9 실패 하락, 단계별 비용 곡선) + 골드 밸런스(GOLD_DROP_SCALE 0.62)
- 전직 스토리(지시 #13): JOBSTORY 3계열 × 2/3차 = 6체인 (토벌→수집→시험상대 소환전), 계열별 시조 캐릭터 대사 30건, 완료 보상 AP+5/10
- 스탯 자동 배분(지시 #18): AUTO_ALLOC 4:1 비율 + autoAllocPlan + 스탯 패널 "✨ 자동 배분" 버튼
- WorldScene: 복귀 차원문(청록 포탈+비컨+←라벨), 구역5 정예 몬스터(배너+포효), 프롤로그 보호(agroHoldUntil 2.6초), 마을 건물 기능(여관 20G 회복+저장 / 내 집 무료 휴식 / 전직관 간판), E 말풍선(이름 위 y-58, 지시 #14), 방향키 마지막 키 우선(dirOrder 스택, 지시 #16), 토벌 퀘스트 huntBaseline(시작 후 킬만 카운트 + 대상 몬스터만, 지시 #17), 보스 BGM 전환 수정(정지→테마BGM, 지시 #7), 보스 소환 시 챕터 배율 강화+파티 방송, BGM stageBgm 8트랙 매핑, 골드 드롭 스케일, 전직 스토리 훅(킬/수집/시험), 챕터 테마 placeDecor(마그마/무덤/유적/육한식물/모닥불 — 무료 에셋, 지시 #1 #10)
- Enemy.ts: 생성자 opts(hp/atk/exp/gold/scale/tint/displayName) + 프롤로그 보호 게이트 + BODY_CFG 5종 추가
- Boss.ts: 프롤로그 보호 게이트
- Player.ts: 공격 중 이동 허용(55% 속도 무빙샷, 지시 #4) + 공격 종료 후 이어 걷기 + 강화 upMax 12/비용곡선/하락
- audio.ts: BGMKind 8종 + stageBgm() + 자동재생 가드 유지
- BootScene/textures: 확장 타일/몬스터 5종/보스 6종/외부 장식 26종/BGM 5트랙 로드 + 애니 등록
- net.ts: join 대기열(connect 플러시 — 채팅 오류 수정, 지시 #14) + stage 필드 + 파티 API + 보스 방송
- server.js: 스테이지 AOI(같은 구역만 동기화, 지시 #9 #15) + 파티(창설/참여/탈퇴/파티채팅/보스공지, 지시 #5)
- UI: PartyWidget 신규(Y키), ChatBox 파티 메시지 배지, DialogueBox 홀드 고속 스킵(지시 #3), Overlays v2.0 배지/이어하기 라벨 구체인 대응, 구 캐릭터명(요정 아리→아부디토스) 교체
- config.ts: SaveData jobStory/jobStoryDone 필드 + 로드 폴백
- tsconfig/.gitignore: prev-project/upload 제외

Stage Summary:
- 20개 지시 중 17개 구현 완료 (#15 WebRTC 하이브리드는 파티 릴레이로 1차 대응, 후속 과제)
- tsc 0 에러, eslint 0 에러(서버 require 3건은 기존 유지)
- E2E 실측 통과: 타이틀 v2.0 배지 → 마을 인트로(아부디토스 안내) → forest3(퀘스트 0/4·복귀차원문 2-2·대사 치환) → 대화 스킵 → hel5(정예 구역·절벽 열기 0/12·무덤 데코) → niflheim10(펜리르 보스바 소환·퀘스트 체인 hunt→collect→boss→reach) → 전투(데미지 텍스트·피격) → 사망/부활 → 파티 창설(코드 P1 시스템 채팅) → 마을(E말풍선 위치·상점·강화 비용 65G/85%) → 채팅 전송 성공 → muspelheim2(화산 테마·불꽃늑대 0/6)

---
Task ID: v2-ship
Agent: Super Z (main)
Task: 최종 검증 + GitHub push

Work Log:
- tsc/eslint 재확인 통과
- 커밋 작성자 apple01234 <callas0729@gmail.com> 고정, .gh_token으로 push

Stage Summary:
- v2.0 push 완료 (원격 동기화)

---
Task ID: v2-apk
Agent: Super Z (main)
Task: 사용자 요청 "Apk로 줘" — SERTZ v2.0 Android APK 패키징

Work Log:
- 기존 Capacitor 8 안드로이드 프로젝트(android/) 활용, 최초 실빌드 완료
- Android SDK 설치 (cmdline-tools + platform 36 + build-tools 36.0.0 → /home/z/android-sdk)
- 루트/sudo 불가 환경 → 포터블 Temurin JDK 21 (/home/z/jdk) 다운로드 후 JAVA_HOME 지정 (javac 확보)
- net.ts v2.0 APK 대응: Capacitor 네이티브 판별 + localStorage 'sertz.server.url' 오버라이드
  (지정 시 해당 서버 멀티플레이, 미지정 시 연결 시도 생략 — 오프라인 재접속 루프 제거)
- src/app/api/route.ts: output:export 대응 force-static 추가
- capacitor.config.ts webDir: out → .next-apk (커스텀 distDir export 실제 출력 위치)
- APK export 빌드 성공 (APK_EXPORT=1 next build → .next-apk, 에셋 294종 포함)
- 런처 아이콘 교체: public/logo.svg → mipmap 전밀도 PNG (scripts/build_launcher_icons.js, sharp) + 적응형 배경 #05070D
- 릴리즈 서명: android/sertz-release.keystore 생성 (alias sertz / storepass sertz2020) + signingConfig 적용
- 버전 bump: versionCode 5 / versionName "2.0"
- 스모크 테스트(Playwright, 정적 서빙): 타이틀 렌더·canvas 부팅·404 0건·콘솔에러 0건 확인
- 원커맨드 재빌드 스크립트 추가 (scripts/build_apk.sh)

Stage Summary:
- 산출물: download/SERTZ-v2.0.apk (16MB, minSdk 24(Android 7.0)+, targetSdk 36, release 서명)
- APK는 완전 오프라인 실행(세이브 localStorage) + localStorage 'sertz.server.url' 설정 시 웹 서버와 멀티플레이 연동
