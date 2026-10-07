/**
 * Capacitor 설정.
 * ⚠️ 빌드 시점에 필요: @capacitor/core @capacitor/cli @capacitor/android
 *    (사용자가 APK 빌드를 지시할 때 설치 후 아래 타입 주석 해제)
 */
const config = {
  /* v1.4.11 — appId com.sertz.myapp 일원화 (유저 지시): build.gradle applicationId와 동일.
   *  네이티브 MainActivity 패키지도 com.sertz.yggdrasil → com.sertz.myapp 이동 */
  appId: "com.sertz.myapp",
  appName: "SERTZ",
  webDir: ".next-apk",
  server: {
    androidScheme: "https",
  },
  /* v1.0.3-beta — 구글 로그인(@capacitor-firebase/authentication) 플러그인 설정:
   *  · skipNativeAuth: false (기본값 명시) — 네이티브 Firebase Auth를 플러그인이 관리
   *  · providers에 google.com 등록 — GoogleAuthProviderHandler 활성화
   *  ※ 네이티브 구글창은 android/app/google-services.json 투입 + Firebase Console에서
   *    Google 공급자 활성화 + SHA-1 등록(2E:AD:70:14:E0:0A:8E:46:DC:87:8B:93:1A:8A:5E:EC:4C:5F:15:27) 후 동작 */
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
    /* v1.0.5-beta (vc134) — 모바일 맵이 오른쪽으로 치우침 수정:
     *  Capacitor 8.5 내장 SystemBars 플러그인이 Android 15+ 엣지투엣지에서
     *  WebView 부모에 systemBars+displayCutout 인셋을 "패딩"으로 강제 주입한다
     *  (insetsHandling 기본값 "css"). 가로 모드에서 좌측 펀치홀 컷아웃 인셋(~40dp)만큼
     *  WebView가 오른쪽으로 밀려 화면 왼쪽에 검은 띠가 생기고 맵 전체가 우측으로 치우쳤다.
     *  → "disable"로 인셋 리스너 자체를 끈다 = WebView가 화면을 100% 채운다(진짜 풀스크린).
     *  게임은 어두운 배경 풀스크린이라 컷아웃 밑으로 그려도 시각 문제 없음 +
     *  HUD/터치조작은 이미 env(safe-area-inset-*) 마진으로 펀치홀을 피한다.
     *  · safe-area CSS 변수 주입(--safe-area-inset-*)은 사라지지만 앱은 env()만 사용 — 영향 없음
     *  · 키보드(IME) 하단 보정도 사라지지만 채팅 입력은 WebView 자체 팬으로 노출됨 — 영향 미미 */
    SystemBars: {
      insetsHandling: "disable",
    },
  },
};

export default config;
