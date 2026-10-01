#!/bin/bash
# v4.4.0 툴체인 재구축 (세션 리셋 대응 — worklog Task 55 절차 재사용)
set -e
cd /home/z

echo "[1/4] Temurin JDK 21 다운로드+압축해제..."
if [ ! -x /home/z/jdk/bin/java ]; then
  curl -sSL -o /home/z/jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  rm -rf /home/z/jdk
  mkdir -p /home/z/jdk
  tar -xzf /home/z/jdk.tar.gz -C /home/z/jdk --strip-components=1
  rm /home/z/jdk.tar.gz
fi
/home/z/jdk/bin/java -version

echo "[2/4] Android cmdline-tools..."
mkdir -p /home/z/.android-sdk/cmdline-tools
if [ ! -d /home/z/.android-sdk/cmdline-tools/latest ]; then
  curl -sSL -o /home/z/clt.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  rm -rf /home/z/clt-x
  mkdir -p /home/z/clt-x
  cd /home/z && unzip -q clt.zip -d clt-x
  mv /home/z/clt-x/cmdline-tools /home/z/.android-sdk/cmdline-tools/latest
  rm -f /home/z/clt.zip && rm -rf /home/z/clt-x
fi
export ANDROID_HOME=/home/z/.android-sdk
export JAVA_HOME=/home/z/jdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager --install "platforms;android-36" "build-tools;35.0.0" "platform-tools" > /dev/null

echo "[3/4] local.properties..."
cd /home/z/my-project
grep -q sdk.dir android/local.properties 2>/dev/null || echo "sdk.dir=/home/z/.android-sdk" > android/local.properties
chmod +x android/gradlew 2>/dev/null || true

echo "[4/4] 완료 — JDK/SDK 준비됨"
/home/z/jdk/bin/java -version 2>&1 | head -1
ls /home/z/.android-sdk/platforms /home/z/.android-sdk/build-tools
