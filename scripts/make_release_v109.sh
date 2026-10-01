#!/bin/bash
# v1.0.9 릴리스 업로드 — v1.0.8 스크립트 패턴 재사용 (#GM로그인 서버 주소 복구)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.9.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.9 — "GM 로그인 안됨/서버 연결 실패" 근본 복구

## 🛠 근본 원인
- APK에 박힌 기본 게임 서버 주소가 만료된 sertz4.space-z.ai에 고정 — 로그인·거래소·멀티 소켓이 전부 실패
- 구주소 자동 이행(DEAD_SERVERS) 목록에 sertz4가 누락돼 기존 설치가 새 주소를 못 따라가던 구조

## ✅ 수정 내용
- 기본 서버 주소를 현재 서비스 주소 sertz.z.ai 로 교체 (account.ts apiBase · net.ts 소켓 공통)
- sertz4.space-z.ai(http/https)를 자동 이행 목록에 등록 — 덮어설치 후 첫 실행에 기존 설정 자동 갱신 (재설정 불필요)
- 연결 실패 시 "기본 서버 복구" 원탭 버튼이 새 기본값으로 이동 (기존 로직 활용)
- 서버 측 로그인은 정상 — 감사 로그로 확인된 유저 시도 0건 = 트래픽이 죽은 주소로 감을 재확인

## 💡 구버전(v1.0.8 이하)에서 즉시 해결하는 법
- 게임 내 우하단 🌐 버튼 → 주소에 https://sertz.z.ai 입력 → 저장&새로고침

## 📦 설치
- versionCode 74 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.9','target_commitish':'main','name':'SERTZ v1.0.9 — GM 로그인 복구 (APK 서버 주소 갱신)','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.9.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v109_check.apk "https://github.com/$REPO/releases/download/v1.0.9/SERTZ-v1.0.9.apk"
md5sum /tmp/v109_check.apk "$APK"
