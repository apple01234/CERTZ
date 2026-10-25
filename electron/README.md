# SERTZ PC 클라이언트 (Windows 데스크톱)

Electron 패키지. 게임 본체(Next.js 정적 export)를 내장하고, 서버가 필요한 API만
Vercel로 투명 프록시한다. **게임 코드는 웹/APK와 완전히 동일**하다(수정 0).

## 구조

```
electron/
  main.js            메인 프로세스 — 내장 HTTP 서버 + API 프록시 + 창 관리
  package.json       electron-builder 설정 (appId com.sertz.myapp)
  icon.png           앱 아이콘
  game/              ← 빌드 시 생성 (.gitignore, 293MB)
dist/                ← 빌드 산출물 (.gitignore)
```

### 실행 흐름
1. 앱 시작 → 내장 HTTP 서버가 `game/`을 서빙 (포트 37815 → 42117 → 46223 순 시도)
2. BrowserWindow가 `http://127.0.0.1:<port>/` 로드
3. `/api/*` 요청은 `https://sertz.vercel.app` 로 프록시 (계정·거래소·랭킹·채팅·버전게이트)
4. 멀티플레이는 클라이언트가 HiveMQ MQTT(wss)에 직결 — 로컬 서버 무관

## 빌드

### Windows EXE (권장 — CI)
`electron/**` 변경을 push하거나 워크플로를 수동 실행하면 Windows 러너가 빌드한다.

```bash
gh workflow run exe-build.yml
```

산출물: `SERTZ-vc<code>-setup.exe` (NSIS 설치기) → GitHub Release 자동 첨부

워크플로가 하는 일:
1. `build.gradle`에서 versionName/versionCode 파싱
2. `APK_EXPORT=1 next build` → `.next-apk/` (정적 export, distDir 분리로 dev `.next` 보호)
3. `.next-apk/` → `electron/game/` 스테이징
4. `electron/package.json`의 version·artifactName 동기화
5. `electron-builder --win nsis --x64`
6. Release 업로드

### 로컬 빌드 (Linux에서 파이프라인 검증용)

Linux에서는 Windows NSIS를 만들 수 없다(`wine` 필요). 대신 **Linux dir 빌드로
파이프라인 전체를 검증**할 수 있다 — 이 경로로 실제 구동까지 확인했다.

```bash
# 1) 정적 export (API 라우트는 export 불가라 잠시 옮긴다)
ROUTE_DIRS="admin auth market rank support chat party"
mkdir -p .apk-hold/api-routes
for d in $ROUTE_DIRS; do [ -d "src/app/api/$d" ] && mv "src/app/api/$d" .apk-hold/api-routes/; done
APK_EXPORT=1 npx next build          # → .next-apk/
for d in $ROUTE_DIRS; do mv ".apk-hold/api-routes/$d" "src/app/api/$d"; done; rm -rf .apk-hold

# 2) 스테이징
rm -rf electron/game && mkdir -p electron/game
cp -r .next-apk/. electron/game/

# 3) 패키징
cd electron && npx electron-builder --linux dir
# → dist/linux-arm64-unpacked/sertz-desktop
```

### 리눅스에서 실행할 때 필요한 시스템 라이브러리
Electron GUI 런타임 의존성. 없으면 `libgtk-3.so.0: cannot open shared object file`로 즉사한다.

```bash
apt-get install -y libgtk-3-0 libnss3 libatk-bridge2.0-0 libdrm2 libgbm1 \
  libasound2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libpango-1.0-0 libcairo2 xvfb
```

헤드리스 실행:
```bash
xvfb-run -a ./dist/linux-arm64-unpacked/sertz-desktop --no-sandbox --disable-gpu
```

## 검증 결과 (v1.3.1 / vc179 기준, 실측)

정적 export 성공(7 페이지, 293MB) → electron-builder 패키징 성공(463MB, 실행 파일 220MB)
→ 실제 구동 후 내장 서버 응답 확인:

| 항목 | 결과 |
|---|---|
| 게임 페이지 `/` | 200 (10,997B, 한글 폰트 preload 포함) |
| 정적 라우트 `/privacy` | 200 |
| API 프록시 `/api/version` | 200 — `{"latest":"1.3.1","code":179,...}` 실값 |
| 3D 에셋 `/assets3d/uni__uni_skull.glb` | 200 (14,940B) |
| 게임 에셋 `/assets/x3_gun.webp` | 200 |
| VFX `/assets/vfx/fx_shockwave.webp` | 200 |
| 오디오 `/assets/sfx2/mob_beast_growl.ogg` | 200 |
| 없는 경로 | 404 |

## 알려진 제약

- **Linux에서는 Windows EXE를 만들 수 없다.** `electron-builder --win nsis`는 wine이 필요하고,
  이 저장소의 CI는 `windows-latest` 러너를 쓴다. 로컬 검증은 Linux dir 빌드로 대체한다.
- 정적 export는 API 라우트를 포함하지 못한다. 워크플로가 `src/app/api/{admin,auth,market,rank,support,chat,party}`
  를 잠시 옮겼다 되돌리는 이유다. `/api/version`은 route handler지만 정적 생성이 가능해 남는다.
- `asar: false` — 게임 본체(293MB)를 asar로 묶으면 시작 시 압축 해제 비용이 크고
  `game/**/*` 직접 서빙이 막힌다. 경고가 뜨지만 의도된 설정이다.
- 오프라인이면 `/api/*`가 502를 반환한다(게임 본체는 로컬이라 실행됨). 계정·거래소·랭킹만 불가.
