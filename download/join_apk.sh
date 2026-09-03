#!/bin/sh
# SERTZ v3.0.24 APK 합치기 (Mac / Linux)
# 사용법: 이 파일이 있는 폴더에서  sh join_apk.sh
cd "$(dirname "$0")"
cat SERTZ-v3.0.25.apk.part1 SERTZ-v3.0.25.apk.part2 SERTZ-v3.0.25.apk.part3 > SERTZ-v3.0.25.apk
echo "[완료] SERTZ-v3.0.25.apk 생성됨 (140.9MB)"
echo "이 파일을 폰으로 옮겨서 설치하세요."
