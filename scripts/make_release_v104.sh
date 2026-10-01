#!/bin/bash
# v1.0.4 릴리스 업로드 — v1.0.3 스크립트 패턴 재사용 (토큰은 env 또는 git remote에서 파싱)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.4.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

NOTE='SERTZ v1.0.4 — 조작 개편

## 🎮 변경
- **이동 방향키 전용** — WASD 이동 제거 (유저 요청)
- **전투 키 Z X C V + A S D F 클러스터** — Z=스킬1 · X=공격 · C=스킬2 · V=스킬3 (기존 유지) / A=스킬4 · S=스킬5 · D=HP물약 · F=MP물약 · G=상점 (신규) — 설정(O)에서 자유 재배치 가능
- **로그인 입력창 단축키 눌림 차단** — 비밀번호 입력 중 캐릭터가 움직이거나 창이 열리던 버그 수정 (모든 텍스트 입력창 공통 가드)
- **친구 창 단축키 F→B** (F는 MP물약과 충돌)

## 📦 설치
- versionCode 69 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `c5bf6a24aecdffd378636e4ed9d79b39`'

echo "[1/3] 릴리스 생성"
RELEASE_JSON=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d "$(jq -n --arg t "v1.0.4" --arg n "$NOTE" '{tag_name:$t,name:"SERTZ v1.0.4 — 조작 개편",body:$n,draft:false,prerelease:false}')")
RELEASE_ID=$(echo "$RELEASE_JSON" | jq -r '.id // empty')
if [ -z "$RELEASE_ID" ]; then echo "$RELEASE_JSON" | head -5; exit 1; fi
echo "release_id=$RELEASE_ID"

echo "[2/3] APK 업로드"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$APK" \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=SERTZ-v1.0.4.apk" | jq -r '.name // .message'

echo "[3/3] 업로드 검증 (재다운로드 md5)"
curl -sL -o /tmp/v104_check.apk "https://github.com/$REPO/releases/download/v1.0.4/SERTZ-v1.0.4.apk"
md5sum /tmp/v104_check.apk "$APK" 2>/dev/null || md5sum /tmp/v104_check.apk
