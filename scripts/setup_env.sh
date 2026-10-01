#!/bin/bash
# 빌드 환경 재설치 — 워크스페이스 리셋으로 JDK/Android SDK 소실 시 실행
set -e

echo "== [1/4] Temurin JDK 21 설치 =="
if [ ! -x /home/z/jdk/bin/java ]; then
  mkdir -p /home/z/jdk_dl
  curl -sL --retry 3 --max-time 560 -o /home/z/jdk_dl/jdk21.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  rm -rf /home/z/jdk_x
  mkdir -p /home/z/jdk_x
  tar -xzf /home/z/jdk_dl/jdk21.tar.gz -C /home/z/jdk_x
  SRC=$(echo /home/z/jdk_x/jdk-21*)
  rm -rf /home/z/jdk
  mv "$SRC" /home/z/jdk
fi
/home/z/jdk/bin/java -version

echo "== [2/4] Android cmdline-tools 설치 =="
if [ ! -x /home/z/android-sdk/cmdline-tools/latest/bin/sdkmanager ]; then
  mkdir -p /home/z/android-sdk/cmdline-tools
  curl -sL --retry 3 --max-time 560 -o /tmp/clt.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  rm -rf /tmp/clt
  unzip -q -o /tmp/clt.zip -d /tmp/clt
  rm -rf /home/z/android-sdk/cmdline-tools/latest
  mv /tmp/clt/cmdline-tools /home/z/android-sdk/cmdline-tools/latest
fi

echo "== [3/4] SDK 패키지 (platform-tools·android-36·build-tools 36.0.0) =="
export JAVA_HOME=/home/z/jdk
export ANDROID_HOME=/home/z/android-sdk
yes | /home/z/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null 2>&1 || true
/home/z/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /dev/null

echo "== [4/4] local.properties =="
echo "sdk.dir=/home/z/android-sdk" > /home/z/my-project/android/local.properties
echo "완료 — $(/home/z/jdk/bin/java -version 2>&1 | head -1) / $(ls /home/z/android-sdk/build-tools/)"
