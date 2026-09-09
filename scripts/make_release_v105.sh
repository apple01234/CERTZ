#!/bin/bash
# v1.0.5 릴리스 업로드 — v1.0.3 스크립트 패턴 재사용 (토큰은 env 또는 git remote에서 파싱)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.5.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.5 — 자체 버그 헌팅 8종

## 🛠 수정
- **혜택 패널 "GM 콘텐츠 입장" 관리자 전용** — 일반 유저에게도 GM 진입 버튼이 노출되던 잔존 버그 → 서버 롤 기반 게이트 (마을 GM NPC와 동일 기준)
- **캐시상점 명칭 잔존 제거** — 인벤 AD탭 안내 문구("BM 상점에서…") · eert 큐브 부족 배너까지 전부 "캐시상점"으로 통일
- **HUD 키 배지 키맵 연동** — 키 매핑에서 가방/스탯/퀘스트/전직/설정 키를 바꾸면 HUD 버튼 표기도 실시간 갱신 (기존엔 I/T/J/K/O 하드코딩)
- **인벤 물약 퀵슬롯 표기** — H/M → HP/MP 버튼 정착 + 실제 사용 키(D/F, 키맵 따라감) 힌트 표시
- **보스 재도전 보상 문구 정리** — "골드·경험치 ×3 ×1" → "×3 기준 · 난이도 배율 ×1"
- **옛 키 표기 정리** — 5차 각성/전직 안내의 궁극기(N) → (S) 반영
- **자동 물약 섹션 문구 정리** — 임시 안내 문구 제거

## 📦 설치
- versionCode 70 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.5','target_commitish':'main','name':'SERTZ v1.0.5 — 자체 버그 헌팅 8종','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.5.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v105_check.apk "https://github.com/$REPO/releases/download/v1.0.5/SERTZ-v1.0.5.apk"
md5sum /tmp/v105_check.apk "$APK"
