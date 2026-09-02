#!/bin/bash
# SERTZ APK 원커맨드 재빌드 — 웹 소스 수정 후 이 스크립트만 실행
# 사용: bash /home/z/my-project/scripts/build_apk.sh
set -e
cd /home/z/my-project

echo "[1/5] 정적 export 빌드 (APK_EXPORT=1 next build)"
APK_EXPORT=1 npx next build

echo "[2/5] Capacitor sync (web assets → android)"
npx cap sync android

echo "[3/5] Gradle assembleRelease"
cd android
JAVA_HOME=/home/z/jdk ANDROID_HOME=/home/z/android-sdk ./gradlew assembleRelease --no-daemon

echo "[4/5] APK 복사"
cp -f app/build/outputs/apk/release/app-release.apk /home/z/my-project/download/SERTZ-v3.0.12.apk

echo "[5/5] 완료 → /home/z/my-project/download/SERTZ-v3.0.12.apk"
ls -la /home/z/my-project/download/SERTZ-v3.0.12.apk
