# 라일락 온라인 새 시작 — 2026-11-04

사용자가 APK·웹의 온라인 기능 장애를 알렸고, 기존 암호화키를 복구하는 대신 새 키로 새롭게 시작하도록 승인했다.

- 운영 주소: `https://sertz.vercel.app`. APK의 기존 기본 API 주소를 그대로 살린다.
- Vercel: `apple01234s-projects` 팀의 `sertz` 프로젝트. 게임 코드 연결은 **apple01234/CERTZ/main**으로 수정했다. 이전 SERTZ 코드 저장소에 커밋하지 않는다.
- 데이터 저장소: 기존 비공개 `apple01234/CERTZ-DB`. 일반 서비스 데이터 저장은 이 저장소의 전용 경로에 기록된다.
- 새 경로: `db-backup/lilac-v1/accounts.enc`, `relay-chat.json`, `relay-parties.json`. 세대 이름은 `accounts/storage.json` 한 곳에서 공유한다.
- 이전 `db-backup/accounts.enc` 및 이전 릴레이 파일은 보관한다. 새 키로 이전 파일을 덮어쓰거나 자동 이관하지 않는다. 초기화 전후 기존 계정 파일 SHA가 같은지 확인했다.
- 새384비트 무작위 키는 Vercel Production의 암호화된 `SERTZ_BACKUP_KEY`에 저장했다. 키/토큰/계정 암호문은 게임 코드·문서·로그에 기록하지 않는다.
- 필요한 운영 변수: `GITHUB_TOKEN`, `SERTZ_BACKUP_KEY`, `SERTZ_GH_REPO=apple01234/CERTZ-DB`. Preview에 운영 DB 자격증명을 복사하지 않는다.

새 DB는 계정·세션·클라우드 세이브·거래소·랭킹·닉네임 레지스트리가 비어 있는 상태에서 시작한다. 새로 회원가입해야 한다. 기기 안의 오프라인 게임 저장은 이 서버 작업에서 삭제하지 않는다. 옛 세션으로 `/api/auth/me`를 호출하면401을 반환해 기존 APK가 캐시된 로그인 상태를 지우도록 한다. 일반 게스트 조회는200을 유지한다.

새 DB의 첫 공개 가입자가 관리자 예약 ID를 선점할 수 없도록 예약 ID 가입은 항상 거부한다. 관리자 계정은 별도의 신뢰된 운영 절차로만 생성해야 한다.

운영에서 키가 없으면 기본 공개 키로 쓰지 않고 실패한다. DB 누락/권한 오류/복호화 오류를 빈 DB로 바꾸지 않는다. 릴레이 접근 실패도 빈 목록 성공으로 숨기지 않는다. 실제 API 응답의 `X-CERTZ-Online-Generation: lilac-v1`로 적용된 세대를 확인한다.

검사:

```sh
npm test
npx tsc --noEmit
npx eslint src --max-warnings 0
python scripts/verify_online.py https://sertz.vercel.app
```

마지막 스크립트는 임시 계정2개를 만들고 가입·로그인·APK Origin/쿼리 세션·세이브·닉네임·랭킹·두 테스트 계정 사이 거래/정산·비공개 파티를 확인한 뒤 본인 테스트 계정/이름/파티를 정리한다. 공개 채팅 메시지나 다른 사용자의 거래에는 손대지 않는다. 운영 유저가 있는 환경에서 쓸 때도 임시 계정만 대상으로 한다. 실제 휴대폰 설치/인앱결제/SNS OAuth 검증을 뜻하지 않는다.
