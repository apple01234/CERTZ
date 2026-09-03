#!/bin/bash
# Android SDK 자동 설치 — SERTZ APK 재빌드용
set -e
SDK=/home/z/android-sdk
mkdir -p "$SDK/cmdline-tools"
cd /tmp

echo "[1/4] cmdline-tools 다운로드"
curl -sSLo cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

echo "[2/4] 압축 해제"
unzip -qo cmdtools.zip -d "$SDK/cmdline-tools"
rm -rf "$SDK/cmdline-tools/latest"
mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"

export ANDROID_HOME="$SDK"
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}
SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"

echo "[3/4] 라이선스 수락"
yes | "$SDKM" --licenses >/dev/null 2>&1 || true

echo "[4/4] platform-tools / platforms;android-36 / build-tools 설치"
yes | "$SDKM" --install "platform-tools" "platforms;android-36" "build-tools;35.0.0" >/dev/null

echo "[완료] Android SDK 설치됨:"
ls "$SDK"
