# 7ac2782 이후 P0 재현 및 저장 호환성 검사

기준: `7ac27824868c8c3c64414a8ea1b9b38ea94b7abd`, v2.2.27/vc285. 버전 변경·프로덕션/APK/EXE 빌드 없음.

## 확인한 저장 결함과 수정

`afb7439`와 `88dd71c`의 실제 퀘스트 데이터를 비교했다. 그랜드 플레닛 22개 구역과 `lilacworld10x2`의 2~3단계 배열이 한 단계로 바뀌었다. 예를 들어 `dlcstargate2`의 옛 인덱스 1은 두 번째 사냥 의뢰 진행 중인데, 새 배열에서는 체인 완료로 해석됐다.

- 개편 전 저장은 미완료 체인을 새 목표 0번으로, 완료 체인을 새 완료 인덱스로 이관한다. 원본 숫자를 그대로 Clamp하지 않는다.
- 이미 지급된 골드/경험치를 기록해 대체 목표의 보상에서 한 번만 공제한다. 현재 레벨·장비·재화·독립 처치 기록·완료한 다른 보스는 보존한다.
- 변경 전 원본은 `sertz:migration-backup:v3:quest-layout:<원래 키>`에 별도로 보관한다. 기존 v2→v3 백업을 덮어쓰지 않는다. 백업 실패 시 원본을 유지한다.
- 이관 버전과 미정산 보상은 config / WorldScene 복원 / buildSave에 함께 연결한다. 환생으로 이야기를 다시 시작하면 정산 기록도 초기화한다.
- 7ac2782 자체도 새 퀘스트 버전을 저장하지 않았으므로 모든 v3 저장을 완벽히 구분할 수는 없다. 개편 이후 시각이거나 시각 정보가 없는 v3 저장은 진행도를 추정해 초기화하지 않는다. 새 목표의 대사 기록이 있는 완료 저장도 보존한다. 이 모호한 구간의 자동 복구는 미해결이다.

## 실행 결과

- 전체 `npm test`: 843/843 통과. 마지막 보완 후 저장 관련 대상 검사 19/19, `tsc --noEmit`, 변경 게임 코드 ESLint 통과.
- 실제 Chromium: 옛 `dlcstargate2` 저장을 로비에서 불러와 목표 0번과 보상 정산 기록 복원, 별도 원본 백업, NPC까지 키보드로 이동해 대화 완료를 확인했다. 골드 보상은 5,180에서 이전 지급액 1,536을 뺀 3,644가 지급됐고 정산 기록이 소비됐다. 이 검사는 저장 호환성용 픽스처이며 일반 신규 플레이 증거와 구분한다.
- 신규 생성 및 생성 직후 새로고침, 첫 컷씬 도중 새로고침에서 캐릭터 ID·이름·슬롯 기록을 확인했다. 영구 저장 유실은 재현되지 않았다.
- 운영 Chromium에서 Space, Tab 후 진행, ESC, Space 홀드, 모바일 탭, 컷씬 중 새로고침: 페이지 예외 0건. 보고된 `Application error`의 원인은 특정하지 못했다. TinyFish 링크는 로그인 필요로 원래 스택을 읽지 못했다.
- 수정본 로컬의 반복 검사: Space/Tab/ESC/모바일 탭/생성 직후 새로고침/컷씬 중 새로고침 통과. Space 홀드 1회는 선택지에서 완료 시간 초과, 페이지 예외는 없었다. 별도 홀드 재검사 5회는 통과했지만 간헐 정지는 해결됐다고 판정하지 않는다.
- 정상 조작 튜토리얼: 캐릭터 생성, 첫 컷씬, 이동·대화·공격·회피·스킬·획득·가방·의뢰·보상과 수련 중 재접속 복원 통과. GM/레벨 변경/이동 순간이동/타이머 가속/튜토리얼 스킵을 사용하지 않았다.
- 같은 캐릭터로 검 획득과 디오전 진입까지 정상 조작으로 도달했다. 기존 자동 플레이와 회피를 보완한 별도 시도 모두 전투 중 사망했다. **디오 처치 및 일반 조작 완주 검증은 미통과**이며, 보스 밸런스를 임의로 낮추지 않았다.
- 소스 수정 중 개발 서버 HMR로 중단된 별도 실행은 게임 크래시 재현이나 통과 결과로 세지 않았다. 계정/온라인 API는 로컬 서버 연결 설정 부재로 검증하지 않았다.

## 재실행

시스템 Chromium을 쓰면 `CHROMIUM_PATH=/usr/bin/chromium`을 지정한다. Playwright 관리 브라우저가 설치돼 있으면 생략한다.

```sh
npx next dev -p 3100
CHROMIUM_PATH=/usr/bin/chromium OPENING_QA_URL=http://127.0.0.1:3100 node scripts/playtest-opening-regression.mjs
CHROMIUM_PATH=/usr/bin/chromium TUTORIAL_QA_NORMAL_ONLY=1 TUTORIAL_QA_URL=http://127.0.0.1:3100 TUTORIAL_QA_OUT=/dev/shm/certz-natural node scripts/playtest-tutorial.mjs
CHROMIUM_PATH=/usr/bin/chromium PROGRESSION_QA_URL=http://127.0.0.1:3100 PROGRESSION_QA_OUT=/dev/shm/certz-natural node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/playtest-live-progression.mjs
```

각 실행의 JSON과 스크린샷은 지정한 출력 디렉터리에 남긴다. 브라우저 결과를 페이지 예외가 없다는 이유만으로 완주 통과로 해석하지 않는다.
