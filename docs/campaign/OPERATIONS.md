# 새 캠페인 실행·운영

## 개발과 검증

```sh
npm ci
npx prisma generate
npm run dev:next
npm run test:campaign
npm test
npx tsc --noEmit
npm run lint:strict
npm run build:next
```

실시간 서버는 **Node 24 이상**에서 실행한다. 웹/네이티브 클라이언트의 기본 프로젝트 런타임은 변경하지 않는다.

```sh
CAMPAIGN_SERVER_SECRET='<32자 이상 비밀값>' CAMPAIGN_ORIGINS='http://localhost:3000' npm run campaign:server
```

웹 API와 실시간 서버에 같은 `CAMPAIGN_SERVER_SECRET`을 설정하고, 프론트 빌드에는 `NEXT_PUBLIC_CAMPAIGN_SERVER=https://<실시간 서버>`를 설정한다. 실시간 서버는 Socket.IO/WebSocket을 지원하는 상시 Node 서비스다. Dockerfile의 빌드 컨텍스트는 저장소 루트다. 서버 포트는 `CAMPAIGN_PORT`(기본 3010), `/`는 상태 확인용이다. 프록시는 WebSocket Upgrade와 TLS를 지원해야 한다.

기존 인증·영속 저장은 기존 `GITHUB_TOKEN` / `SERTZ_GH_REPO` / 백업 암호화 설정을 사용한다. 미설정 시 로컬 본편은 가능하지만 클라우드·온라인 경제는 503으로 거부한다. 실제 계정 DB를 테스트용으로 초기화하지 않는다.

## 데이터 경계

- 로컬: `sertz:memory-oath-v1:characters`. 기존 `sertz_save_*`, `sertz_char_*`, `sertz_slots_*` 키는 읽기 전용 내보내기만 한다.
- 서버: `db.campaigns['memory-oath-v1']`. 기존 `db.saves`, `db.market`, `db.rank`, IAP 대장은 변경하지 않는다.
- `GET/POST /api/campaign`: campaignId 필수. POST의 save/economy 요청은 revision 필수. 충돌 시 409, 현재 내용을 불러온 뒤 재시도한다.
- 경제 필드는 클라이언트 저장에서 가져오지 않는다. 최초/추가 본편 완료 보상은 정본의 유한한 합계에서 산출한다. 오프라인 본편 진행은 가져올 수 있지만 사용자 수정 저장은 공식 도전 기록으로 인정하지 않는다.
- 온라인 도전은 서버에서 30Hz로 판정한다. 입력/보스/전투 시간/피격을 서버가 관리하고 완료 영수증에 서명한다. 클라이언트 승리 이벤트와 점수 제출은 없다.
- 파티는 3인, 세 봉인 분담과 E키 2초 구조를 지원한다. 재접속은 60초. 서버 재시작으로 미완료 전투는 사라지며, 입장료가 없어 자산 손실은 없다. 완료 보상은 영수증을 API에 제출해 1회 받는다.
- 거래소는 기억의 결정만, 에스크로 방식, 등록 3건, 수수료 10%. 과거 게임 품목을 등록할 수 없다.

## 유료 상품

Google Play에 새 비소모성 SKU `oath_cloak_starlight`(외형), `oath_slots_4`(슬롯 8→12)를 등록한다. `GOOGLE_PLAY_SA_JSON`과 `GOOGLE_PLAY_PACKAGE_NAME`이 필요하다. 가격은 Play 결제창에서 표시하며 임의 가격을 표시하지 않는다. 웹과 iOS에서는 이 Android 구매 경로를 사용하지 않는다.

구매 토큰은 Google API로 검증하고, obfuscated account ID가 현재 계정과 일치해야 지급한다. 설정이 없으면 결제창을 열기 전에 안내한다. 구매 복원을 지원하며 영수증은 새 캠페인 대장으로 분리한다. 결제·상품 등록·실기기 구매/복원은 자격증명이 준비된 운영 스테이징에서 별도로 검증해야 한다.

## MCP와 스킬

- `.mcp.json`의 Playwright MCP 0.0.84. `npx playwright install chromium` 후 사용한다. 래퍼는 프로젝트 Playwright의 브라우저 경로를 사용한다.
- Ponytail: `skills/ponytail/SKILL.md`. 원본 https://github.com/DietrichGebert/ponytail 에서 복구, MIT.
- pixelfx: `vendor/pixelfx/skills/pixelfx/SKILL.md`. 효과를 실제 렌더링하고 contact sheet 확인 및 check 수행.
- 저장소에서 기존 MCP 설정은 발견되지 않아 브라우저 검증용 설정을 추가했다. 다른 서비스의 자격증명을 임의로 설치하지 않는다.

## 배포 전

새 아트 허용 목록만 배포하도록 빌드 출력 정리 스크립트를 사용한다. 운영 DB·상점·상시 서버 설정 없이 온라인 기능이 준비됐다고 표시하지 않는다. 이 변경은 운영 배포나 스토어 상품 등록을 자동 수행하지 않는다.

추가 설정: API 서버의 `CAMPAIGN_REALTIME_URL`을 설정하면 클라이언트가 `/api/campaign` 응답에서 실시간 서버 주소를 읽는다. 빌드 타임 `NEXT_PUBLIC_CAMPAIGN_SERVER`가 있으면 그 값이 우선한다. 완료 영수증은 기기에 임시 보관되므로 재접속 후 ‘보상 복원’으로 수령할 수 있다(서명 만료 1시간 이내).

Ponytail 복구 원본 커밋: `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`. 핵심 스킬과 review/audit/debt/gain/help 문서를 함께 보관한다. MCP는 실제 initialize/tools/list/navigate/snapshot/screenshot 호출로 연결을 확인했다.

Next 16.1의 앱 정적 export 최종 결과는 `.next-apk`지만 작업 캐시는 `.next`를 공유한다. 웹 프로덕션 서버가 사용하는 체크아웃에서 동시에 export하지 않는다. 로컬 검증은 export 종료·라우트 복구 후 웹 빌드를 다시 생성하는 순서로 실행한다.
