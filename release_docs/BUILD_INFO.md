# SERTZ v1.0.2 BUILD_INFO

| 항목 | 값 |
|---|---|
| versionName | 1.0.2 (1.0.n 증분 체계) |
| versionCode | 67 (단조 증가 — Play 정책) |
| applicationId | com.sertz.yggdrasil |
| 엔진 | Phaser 4.2.1 / Next.js 16.1.3 (React) |
| minSdk / targetSdk | 24 / 36 |
| 서명 | android/sertz-release.keystore (release config) |
| 권한 | INTERNET, com.android.vending.BILLING |
| allowBackup | false (v1.0.2 변경) |
| APK | download/SERTZ-v1.0.2.apk (940ea24448f26ea555bb0f8840197b44) |
| AAB | download/SERTZ-v1.0.2.aab (48fda370ad90a188b33e8ff7ab19d665) |
| 빌드 경로 | scripts/build_apk.sh → assembleRelease / scripts/build_aab.sh → bundleRelease |
| 배포 URL | https://github.com/apple01234/CERTZ/releases/download/v1.0.2/SERTZ-v1.0.2.apk |

## 버전 싱크 체크리스트 (릴리스 시)
- [x] android/app/build.gradle — 67 / 1.0.2
- [x] package.json — 1.0.2
- [x] src/components/game/Overlays.tsx 타이틀 배지 — v1.0.2
- [x] server.js APK_MIRROR — v1.0.2
- [x] next.config.ts APK_DL — v1.0.2
- [x] public/apk-guide.html — v1.0.2
- [x] download/APK_다운로드_안내.txt — v1.0.2

## 데이터 검증 스크립트
- `bun scripts/validate_data.ts` — 중복 아이콘/0가격/참조/초상화/BGM/보스 배치 전수 검사
- `python3 scripts/gen_unique_icons.py` — 중복 해소용 고유 아이콘 생성기 (90종 + GM 4종)
