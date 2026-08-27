/**
 * Capacitor 설정.
 * ⚠️ 빌드 시점에 필요: @capacitor/core @capacitor/cli @capacitor/android
 *    (사용자가 APK 빌드를 지시할 때 설치 후 아래 타입 주석 해제)
 */
const config = {
  appId: "com.sertz.yggdrasil",
  appName: "SERTZ",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
