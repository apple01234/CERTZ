# 기억의 서약 검증 기록

2026-11-02. Node 24.19.0 / Next 16.1.3 / Phaser 4.2.1.

## 통과

- `npm test`: 56개 테스트 파일/케이스 통과. 새 캠페인 테스트 15개와 기존 회귀 검사 포함.
- `npx tsc --noEmit`, `npm run lint:strict`: 오류·경고 없음.
- 34장(15+10+9)의 상태 진행을 시작부터 최종 완료까지 검증. 중복 보상, 퍼즐 순서, 잠긴 장 이동, 손상/미래/레거시 저장 거부, 백업 복구 포함.
- 거래 에스크로, 동시 구매 재시도, 판매 정산, 서버 재화 정본, 유료 외형 무단 생성 거부 검증.
- 결제 검증은 Google API 응답을 모의해 미설정/취소/대기/정상 상태와 계정 바인딩 값을 검사.
- 실제 Socket.IO 클라이언트 3개로 동일 전투 상태와 서명 결과 수신 확인. 클라이언트의 승리 선언은 처리되지 않음.
- 실제 Chromium 플레이: 첫 장의 모든 목표와 보상, 새로고침 후 복원, 기존 저장 바이트 보존, 보스 공격·원소술·이동 공략으로 승리.
- 별도 브라우저 컨텍스트 3개로 파티 생성/입장/공유 보스전/서명 결과/보상 UI/본편 복귀 확인. 이 브라우저 검사는 계정·클라우드 HTTP 응답을 모의하며, 실시간 전투 서버와 서명 검증은 실제 구현을 사용.
- 390×844 터치 뷰포트와 데스크톱에서 화면·조작·메뉴 확인. 세로 플레이필드가 화면을 채움.
- Playwright MCP 0.0.84의 initialize/list/navigate/snapshot/screenshot 실제 호출 성공.
- pixelfx `holy/sunburst` 렌더링·contact sheet 시각 확인·`check` 통과.
- `npm run build:next`, `npm run build` 성공. standalone 배포물에서 새 허용 목록만 남는 것을 확인.
- API 라우트를 격리한 `APK_EXPORT=1 next build` 정적 export 성공, `.next-apk/index.html` 및 필터된 에셋 확인. API 소스와 TypeScript 설정은 검증 후 복구.

스크린샷: [타이틀](screenshots/title.png), [보스](screenshots/boss.png), [모바일](screenshots/mobile.png), [협동](screenshots/coop.png).

## 실환경에서 남은 검증

운영 계정 DB 연결, Firebase/Google 실제 로그인, Google Play 실제 결제/구매 복원, 서명 APK·iOS·EXE 설치, 실기기 성능, 상시 서버 배포는 이 환경의 자격증명/서명 키로 실행하지 않았습니다. 서명 APK나 스토어 상품이 게시됐다고 표시하지 않습니다.

전편 상태 경로는 자동 검사했지만 34장을 모두 사람이 수동 플레이한 것은 아닙니다. 2부는 기획서 요약의 게임 각색, 3부는 설정을 바탕으로 한 새 완결편입니다.

Next 16 정적 export는 `.next` 작업 캐시를 공유합니다. 웹 프로덕션 검증은 export 이후 웹 산출물을 다시 만든 다음 순차 실행합니다.

최종 웹 프로덕션 standalone 서버에서도 브라우저 플레이테스트 전체를 다시 실행해 통과했습니다. 최종 스크린샷은 프로덕션 산출물에서 촬영했습니다. 허용 목록 정리 후 standalone 에셋은 약 1.6MB이며, 미사용 3D 에셋과 과거 이펙트 검사 페이지도 배포물에서 제외됩니다.
