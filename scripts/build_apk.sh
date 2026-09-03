#!/bin/bash
# SERTZ APK 원커맨드 재빌드 — 웹 소스 수정 후 이 스크립트만 실행
# 사용: bash /home/z/my-project/scripts/build_apk.sh
set -e
cd /home/z/my-project

echo "[0.5/5] public/ 내 APK 임시 격리 — export 빌드가 .next-apk로 복사하기 '전'에 (v3.0.25·27 비대화 사고 예방)"
mkdir -p /tmp/apk-hold
find public -maxdepth 1 -name "*.apk" -exec mv {} /tmp/apk-hold/ \;

echo "[1/5] 정적 export 빌드 (APK_EXPORT=1 next build)"
APK_EXPORT=1 npx next build

echo "[1.3/5] .next-apk 잔여 APK 이중 제거 (안전벨트)"
rm -f .next-apk/*.apk

echo "[2/5] Capacitor sync (web assets → android)"
npx cap sync android

echo "[2.5/5] public/ APK 복원"
mv /tmp/apk-hold/*.apk public/ 2>/dev/null || true

echo "[3/5] Gradle assembleRelease"
cd android
JAVA_HOME=${JAVA_HOME:-/home/z/jdk} ANDROID_HOME=${ANDROID_HOME:-/home/z/android-sdk} ./gradlew assembleRelease --no-daemon

echo "[4/5] APK 복사"
cp -f app/build/outputs/apk/release/app-release.apk /home/z/my-project/download/SERTZ-v3.0.27.apk

echo "[5/5] 완료 → /home/z/my-project/download/SERTZ-v3.0.27.apk"
ls -la /home/z/my-project/download/SERTZ-v3.0.27.apk
