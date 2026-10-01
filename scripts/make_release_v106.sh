#!/bin/bash
# v1.0.6 릴리스 업로드 — v1.0.5 스크립트 패턴 재사용 (토큰은 env 또는 git remote에서 파싱)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.6.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.6 — 자체 버그 헌팅 2종 + 원본 에셋 복구

## 🛠 수정
- **유저 거래소 등록 서버 소유 검증** — 보유하지 않은 아이템 등록 차단: 가짜 전설 등록 → 다른 계정 구매로 아이템 복제하던 악용 경로를 서버에서 원천 차단 (보스 전용 드롭 화이트리스트 + 클라우드 세이브 실보유 확인, 장착 중 장비 등록 금지, 등록 직전 세이브 선동기화)
- **GM NPC 실시간 갱신** — 마을 로드 뒤 관리자 계정으로 로그인하면 GM NPC가 즉시 등장 (기존엔 마을 재입장/새로고침 전까지 안 보임) · 로그아웃 시 즉시 숨김 — 관리자 배지(계정 ON)도 동일 즉시 반영
- **원본 에셋 패키지 복구** — 연구용 원본(Cainos·VFX 팩 7종) 재확보 (게임 빌드 영향 없음)

## 📦 설치
- versionCode 71 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`

## ✅ 실측
- 세션 중 로그인 → GM NPC 4종 즉시 등장(adminRole 갱신, 리로드 0) · 로그아웃 → 즉시 숨김 재확인
- 미보유 아이템 등록 시도 → 서버 403 차단 (화이트리스트+실보유 검증)'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.6','target_commitish':'main','name':'SERTZ v1.0.6 — 자체 버그 헌팅 2종 + 원본 에셋 복구','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.6.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v106_check.apk "https://github.com/$REPO/releases/download/v1.0.6/SERTZ-v1.0.6.apk"
md5sum /tmp/v106_check.apk "$APK"
