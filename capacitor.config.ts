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
};

export default config;
