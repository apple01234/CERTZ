#!/bin/bash
# SERTZ EXE 빌드 — Next standalone + socket.io + Electron 래퍼 → Windows portable exe
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

echo "[4/6] electron-builder 실행 (Windows portable x64)"
cd electron
test -d node_modules || (cd /home/z/my-project && npm i -D electron electron-builder --no-audit --no-fund --loglevel=error)
npx electron-builder --win portable --x64

echo "[5/6] 산출물 복사"
cd /home/z/my-project
ls -la electron/dist/
EXE=$(ls electron/dist/SERTZ-*-win.exe | head -1)
cp -f "$EXE" download/SERTZ-v3.0.8-win.exe

echo "[6/6] 완료 → download/SERTZ-v3.0.8-win.exe"
ls -la download/SERTZ-v3.0.8-win.exe
