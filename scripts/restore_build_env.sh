#!/bin/bash
# v1.4.9 — 세션 리셋 대응 빌드환경 재구축 (V144 절차 재사용)
# ① openjdk-21-jdk-headless deb → /home/z/jdk-full (시스템 JRE 병합, javac 확보)
# ② Android cmdline-tools → platforms;android-36 · build-tools;36.0.0 · platform-tools
set -e
JDK_FULL=/home/z/jdk-full
SDK=/home/z/android-sdk

echo "[1] 시스템 JRE 확인"
SYS_JVM=/usr/lib/jvm/java-21-openjdk-amd64
[ -d "$SYS_JVM" ] || { echo "시스템 JRE 없음 — 중단"; exit 1; }

if [ -x "$JDK_FULL/bin/javac" ]; then
  echo "[1] $JDK_FULL 이미 구축됨 — 스킵"
else
  echo "[1.1] Debian pool에서 openjdk-21-jdk-headless deb 탐색"
  mkdir -p /home/z/.jdk-deb && cd /home/z/.jdk-deb
  if [ ! -f jdk.deb ]; then
    IDX=$(curl -fsSL http://deb.debian.org/debian/pool/main/o/openjdk-21/ | grep -o 'openjdk-21-jdk-headless_[^"]*_amd64\.deb' | sort -u | tail -1)
    echo "deb: $IDX"
    curl -fL -o jdk.deb "http://deb.debian.org/debian/pool/main/o/openjdk-21/$IDX"
  fi
  echo "[1.2] deb 전개 + JRE 병합"
  rm -rf extract && mkdir extract
  dpkg-deb -x jdk.deb extract
  rm -rf "$JDK_FULL"
  cp -a "$SYS_JVM" "$JDK_FULL"
  cp -a extract/usr/lib/jvm/java-21-openjdk-amd64/. "$JDK_FULL/"
  rm -rf extract
  "$JDK_FULL/bin/javac" -version
fi

echo "[2] Android cmdline-tools"
mkdir -p "$SDK" && cd "$SDK"
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fL -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  rm -rf cmdline-tools tmp && mkdir tmp
  cd tmp && unzip -q ../cmdtools.zip && mkdir -p ../cmdline-tools && mv cmdline-tools ../cmdline-tools/latest && cd ..
  rm -rf tmp cmdtools.zip
fi
export JAVA_HOME="$JDK_FULL"
export ANDROID_HOME="$SDK"

echo "[2.1] 라이선스 수락 + 패키지 설치"
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1 || true
"$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-36" "build-tools;36.0.0" "platform-tools" > /dev/null

echo "[3] local.properties"
echo "sdk.dir=$SDK" > /home/z/my-project/android/local.properties

echo "[완료] JAVA_HOME=$JDK_FULL · ANDROID_HOME=$SDK"
"$JDK_FULL/bin/java" -version 2>&1 | head -1
ls "$SDK"
