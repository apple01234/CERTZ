# 개발자 온보딩 — SERTZ(하울르스톤)

> 이 문서는 **처음 코드를 받아 실행·빌드하려는 사람**을 위한 것이다.
> 자율 개발 루프(`loop/`)에 대한 내용은 `README.md` 를 본다.

## 한눈에

| 항목 | 내용 |
|---|---|
| 스택 | Next.js 16 (Turbopack) · React 19 · Phaser 4.2.1 · TypeScript |
| 규모 | `src/` 127파일 / 약 70,000줄 |
| 데이터 저장 | GitHub 저장소 파일 1개에 암호화(`src/lib/ghdb.ts`) — DB 서버 없음 |
| 모바일 | Capacitor 8 (`android/`) |
| 데스크톱 | Electron 44 + electron-builder (`electron/`) |

## 1. 필요한 환경변수

로컬에서 `node server.js` 를 띄울 때 **아래 값이 없으면 일부 기능이 조용히 실패**한다.

| 변수 | 필수 | 없으면 |
|---|---|---|
| `GITHUB_TOKEN` | **필수** | `/api/chat`·`/api/party` 가 500. 계정·세이브·거래소 전체가 죽는다 |
| `SERTZ_ORIGIN` | 선택 | CORS 허용 origin 추가 (쉼표 구분) |
| `SERTZ_ADMIN_USERS` | 선택 | 기본 `admin,apple01234` |
| `GOOGLE_PLAY_SA_JSON` | APK 결제 시 필수 | `/api/iap/verify` 가 503 (fail-closed) |
| `GOOGLE_PLAY_PACKAGE_NAME` | 선택 | 기본 `com.sertz.myapp` |
| `SERTZ_IAP_ENFORCE` | 선택 | `0` 이면 결제 검증 생략(개발용). **기본은 강제** |
| `SERTZ_KEYSTORE_BASE64`<br>`SERTZ_KEYSTORE_PASSWORD`<br>`SERTZ_KEY_PASSWORD`<br>`SERTZ_KEY_ALIAS` | APK 릴리스 서명 | GitHub Secrets 에 등록돼 있음 |

## 2. 실행

```bash
npm ci
npx prisma generate
npm run dev          # node server.js (커스텀 서버)
npm run dev:next     # next dev (라우트 단독 확인용)
```

## 3. 빌드 3종

```bash
# ① 웹
npm run build        # → .next/standalone (약 401MB)
npm start            # 프로덕션 서버

# ② APK — GitHub Actions 권장
gh workflow run android-build.yml --ref main

# ③ EXE — GitHub Actions (windows-latest 네이티브 NSIS)
gh workflow run exe-build.yml --ref main
```

**로컬 빌드가 실패하는 것은 정상이다:**

| 대상 | 로컬 실패 이유 | 대안 |
|---|---|---|
| APK | `SigningConfig "release" is missing required property "storePassword"` — 서명 키 비밀번호 없음 | Actions (Secrets 4종 사용) |
| EXE | Linux aarch64 에 wine 없음 · NSIS 는 Windows 네이티브 필요 | Actions (`windows-latest`) |

로컬에서 APK 를 만들려면 `android/keystore.properties` 를 만들고 위 4개 env 를 export 한다.

산출물은 릴리스 태그에 자동 첨부된다 (`SERTZ-vc{code}.apk`, `SERTZ-vc{code}-setup.exe`).

## 4. 빌드 모드 판별 (헷갈리기 쉬움)

`next build` 는 `output: "standalone"` 에서도 `.next/export-marker.json` 을 만든다.
**모드 판별은 `export-marker.json` 이 아니라 `.next/standalone/` 디렉터리 존재 여부로 한다.**

| 확인 | 서버 빌드 | 정적 export (APK/EXE용) |
|---|---|---|
| `.next/standalone/` | 있음 | 없음 |
| `.next-apk/index.html` | 없음 | 있음 |

APK·EXE 빌드는 `.next-apk` 를 쓰고, `distDir` 가 분리돼 있어 `.next` 를 덮지 않는다.

## 5. 테스트

```bash
node --experimental-strip-types --test src/lib/__tests__/escrow.test.ts
```

현재 커버: 거래소 에스크로(`deductEscrow`, `escrowedCounts`) 7개.
**재화 복제가 걸린 경로만 우선**했다. 프레임워크는 추가하지 않았다(`node:test`).

## 6. 검증 게이트

```bash
npx tsc --noEmit                  # 0 오류
npx eslint src --max-warnings 0   # CI 게이트와 동일
```

## 7. 서버 권위 원칙 (중요)

재화·결제·거래소는 **서버가 정본**이다. 클라이언트 값을 신뢰하지 않는다.

| 필드 | 정본 | 클라 업로드 처리 |
|---|---|---|
| `gold`, `emerald` | `db.saves[uid].data` | cloud-save 가 **서버 값으로 덮어쓴다** (최초 1회만 시드) |
| `owned` | 서버 (에스크로 차감 후) | 에스크로분을 다시 차감 |
| 구매 대금 | `market/buy` 가 구매자 gold 차감 | 클라 값 무시 |
| 판매 정산 | `db.payouts` | `market/collect` 로만 수령 |
| 인앱결제 | `db.iapUsed` + Google Play 검증 | 토큰만 받고 수량은 서버가 결정 |

이 원칙을 깨면 재화 복제가 성립한다. 새 지급 경로를 만들 때는 반드시 서버에서 처리한다.

## 8. 알려진 제약

- **서버 저장이 단일 파일**(`ghdb.ts`)이라 동시 쓰기가 직렬화된다. 사용자가 늘면 503(`서버가 바빠요`)이 난다.
- **APK·EXE 로컬 빌드 불가** — 위 3번 표 참조.
- **IAP 는 `GOOGLE_PLAY_SA_JSON` 없이 503** (fail-closed). 클라 자체 지급으로 되돌리지 말 것.
- **오염된 `tile_*.webp` 26개가 저장소에 남아 있다.** `tileThemes.ts` 매핑이 우회시키지만, 새 코드가 직접 참조하면 "꽃게 타일"이 재발한다.
