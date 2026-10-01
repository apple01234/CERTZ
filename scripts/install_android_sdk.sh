#!/bin/bash
# SERTZ APK 빌드용 Android SDK 설치 (Capacitor 8 / compileSdk 36)
set -e
SDK=/home/z/android-sdk
mkdir -p "$SDK/cmdline-tools"
cd /tmp
echo "[1/4] cmdline-tools 다운로드..."
curl -sS -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q -o cmdtools.zip -d "$SDK/cmdline-tools"
mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest" 2>/dev/null || true
export ANDROID_HOME="$SDK"
SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"
echo "[2/4] 라이선스 수락..."
yes | "$SDKM" --licenses > /dev/null 2>&1 || true
echo "[3/4] platform + build-tools 설치..."
yes | "$SDKM" "platforms;android-36" "build-tools;36.0.0" "platform-tools" > /dev/null 2>&1
echo "[4/4] 완료"
ls "$SDK/platforms" "$SDK/build-tools"
