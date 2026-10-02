#!/bin/bash
# rebuild_sdk.sh — Android SDK 재구축 → /home/z/.android-sdk
# 구성: cmdline-tools → licenses 승인 → platform-tools, platforms;android-36, build-tools 36/35
set -uo pipefail
SDK=/home/z/.android-sdk
cd /tmp
echo "[1] cmdline-tools 다운로드"
curl -sL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" || { echo "다운로드 실패"; exit 1; }
ls -la cmdtools.zip
echo "[2] 해제"
rm -rf cmdtoolsx "$SDK"
mkdir -p cmdtoolsx "$SDK/cmdline-tools"
unzip -q cmdtools.zip -d cmdtoolsx || { echo "해제 실패"; exit 1; }
mv cmdtoolsx/cmdline-tools "$SDK/cmdline-tools/latest"
echo "[3] licenses 승인"
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1
echo "[4] 컴포넌트 설치 (몇 분 소요)"
"$SDK/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0" "build-tools;35.0.0" > /tmp/sdk_install.log 2>&1
echo "[5] 검증"
ls "$SDK/build-tools/" && ls "$SDK/platforms/" && echo "✓ SDK 구축 완료"
