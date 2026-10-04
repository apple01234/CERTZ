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
  },
};

export default config;
