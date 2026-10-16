#!/bin/bash
# SERTZ SETUP EXE 빌드 — Next standalone + socket.io + Electron 래퍼 → Windows NSIS 인스톨러 (v1.0.6 — portable 폐지, setup(NSIS)만 생산)
# 사용: bash /home/z/my-project/scripts/build_exe.sh   (사전에 APK_EXPORT=1 npx next build 선행)
set -e
cd /home/z/my-project

echo "[1/6] standalone 산출물 확인"
test -f .next/standalone/server.js || { echo "오류: .next/standalone 없음 — 먼저 next build"; exit 1; }

echo "[2/6] game/ 스테이징 (standalone 복사)"
rm -rf electron/game
cp -r .next/standalone electron/game
mkdir -p electron/game/.next
cp -r .next/static electron/game/.next/static
cp -r public electron/game/public

echo "[3/6] 멀티플레이 서버(server.js + socket.io) 번들링"
cp -f server.js electron/game/server.js
cd electron/game
# standalone node_modules에 socket.io(서버)만 추가 설치 — --no-save로 package.json 오염 방지
npm install socket.io@4.8.1 --omit=dev --no-save --no-audit --no-fund --ignore-scripts --loglevel=error
node -e "require('socket.io'); console.log('socket.io server OK')"
cd /home/z/my-project

echo "[4/6] electron-builder 실행 (Windows NSIS setup x64)"
cd electron
test -d node_modules || (cd /home/z/my-project && npm i -D electron electron-builder --no-audit --no-fund --loglevel=error)
npx electron-builder --win nsis --x64

echo "[5/6] 산출물 복사"
cd /home/z/my-project
ls -la electron/dist/
EXE=$(ls electron/dist/SERTZ-*-setup.exe | head -1)
test -n "$EXE" || { echo "오류: electron/dist에 *-setup.exe 없음"; exit 1; }
# v1.0.16 — 종전엔 v1.0.9로 하드코딩돼 있어 electron-builder가 만든 최신 산출물이
#  구버전 이름으로 복사됐다(exe-build.yml과 같은 종류의 버그). 버전을 파싱해 그대로 쓴다.
VER="$(sed -n 's/.*versionName "\([^"]*\)".*/\1/p' android/app/build.gradle | head -1)"
OUT="download/$(basename "$EXE")"
cp -f "$EXE" "$OUT"

echo "[6/6] 완료 → $OUT (versionName ${VER:-?})"
ls -la "$OUT"
