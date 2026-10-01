# SERTZ — 이그드라실: 아홉 왕국 (v1.0.2 통합 안정화 릴리스)

2D 탑다운 MMORPG · Phaser 4.2.1 + Next.js 16 · versionCode 67 / versionName 1.0.2

## 패키지 구성

```
Game_Final_Release/
├─ Android/
│  ├─ release.aab              # 플레이 스토어 업로드용 (서명 완료)
│  └─ SERTZ-v1.0.2.apk         # 직접 설치용 APK (덮어설치 · 세이브 유지)
├─ Source/
│  └─ sertz-source-v1.0.2.zip  # 전체 소스 (node_modules·빌드 캐시 제외)
├─ Documentation/
│  ├─ CHANGELOG.md             # v1.0.2 전체 변경점
│  ├─ TEST_REPORT.md           # 자동 검증 + 런타임/서버 실측 결과
│  ├─ BUILD_INFO.md            # 빌드 메타데이터 + md5 + 버전 싱크 체크리스트
│  └─ KNOWN_ISSUES.md          # 알려진 이슈 (투명 기재)
└─ README.md
```

## 다운로드 (GitHub 릴리스 — 즉시 시작)

- APK: https://github.com/apple01234/CERTZ/releases/download/v1.0.2/SERTZ-v1.0.2.apk
- AAB: https://github.com/apple01234/CERTZ/releases/download/v1.0.2/SERTZ-v1.0.2.aab
- 무결성(md5): APK `940ea24448f26ea555bb0f8840197b44` · AAB `48fda370ad90a188b33e8ff7ab19d665`

## 소스 실행 방법

```bash
unzip Source/sertz-source-v1.0.2.zip -d sertz && cd sertz
bun install          # 또는 npm install
node server.js       # http://localhost:3000
```

- 게임 데이터: `src/game/data.ts` (아이템 132종·스테이지·대사)
- 서버: `server.js` + `accounts/index.js` (계정/거래판/관리자 API)
- 데이터 검증: `bun scripts/validate_data.ts`
- APK 빌드: `bash scripts/build_apk.sh` / AAB: `bash scripts/build_aab.sh`

## 관리자(GM) 설정

```bash
SERTZ_ADMIN_USERS=<아이디> node server.js
# 해당 아이디로 가입/로그인하면 마을에 GM NPC가 표시되고 GM 패널이 열린다
```

## 버전 정책

- versionName: 1.0.n 증분 체계 (v1.0.2 → v1.0.3 …)
- versionCode: 단조 증가 (67 → 68 …) — Play 정책 대응
