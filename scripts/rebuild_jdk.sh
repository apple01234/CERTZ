#!/bin/bash
# rebuild_jdk.sh — JDK 21 (Temurin) 설치 → /home/z/jdk (capacitor-android 8.5.0은 Java 21 필수)
set -uo pipefail
cd /tmp
echo "[1] Temurin 21 다운로드"
curl -sL -o jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" || { echo "다운로드 실패"; exit 1; }
ls -la jdk21.tar.gz
echo "[2] 압축 해제"
rm -rf /tmp/jdk21x jdk21x
mkdir jdk21x && tar -xzf jdk21.tar.gz -C jdk21x --strip-components=1 || { echo "해제 실패"; exit 1; }
echo "[3] 설치"
rm -rf /home/z/jdk
mv jdk21x /home/z/jdk
/home/z/jdk/bin/java -version 2>&1 | head -1 && echo "✓ JDK 설치 완료"
