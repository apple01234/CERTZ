#!/usr/bin/env bash
# release_1_0_1_beta.sh — GitHub Release v1.0.1-beta 생성 + APK·AAB 업로드
set -uo pipefail
GH=$(cat /home/z/my-project/.secrets/github_token)
API="https://api.github.com/repos/apple01234/CERTZ"
APK=/home/z/my-project/download/SERTZ-v1.0.1-beta.apk
AAB=/home/z/my-project/download/SERTZ-v1.0.1-beta.aab

BODY=$(cat <<'EOF'
## SERTZ v1.0.1-beta (vc122) — 결제·광고 실연동

### 결제 (Google Play Billing)
- **에메랄드 충전 실연동** — 충전소 4종 SKU (Play Console 상품 등록 후 구매 가능)
- **현금 패키지 실연동** — 성장/성장+치장/시즌 패키지 3종
- **재구매 차단 버그 픽스** — 소모성 상품 소비(consume) 흐름 확정 (구매→지급→소비)
- **미지급 결제 부팅 복구** — 결제 성공 직후 앱 종료 시에도 다음 부팅 때 자동 지급 (이중 지급 차단)
- **충전소 실가격 표시** — Play에 등록된 통화·가격 그대로 표시

### 광고 (AdMob)
- **보상형 광고 실연동** — 광고 시청 → 에메랄드+1·골드+500 (구독자 2배·8회)
- **AD_ID 권한 복원** — v1.4.3의 "광고 미사용" 잔재 제거 (Android 13+ 광고 수익 정상화)

### 설치
- 기존 버전 덮어설치 가능 (동일 서명 키 — 세이브 그대로 유지)
- Play Console 등록 가이드: download/결제_광고_연동_가이드.txt
EOF
)

echo "[1] 릴리스 생성 (tag: v1.0.1-beta)"
RID=$(curl -s -X POST "$API/releases" -H "Authorization: Bearer $GH" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name':'v1.0.1-beta','target_commitish':'main','name':'SERTZ v1.0.1-beta — 결제·광고 실연동','body':sys.stdin.read(),'draft':False,'prerelease':True}))" <<< "$BODY")" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id') or '')
import sys as s
if not d.get('id'): print(d.get('message','?'), file=s.stderr)")
echo "릴리스 ID: $RID"
[ -z "$RID" ] && { echo "릴리스 생성 실패"; exit 1; }

echo "[2] APK 업로드"
curl -s -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=SERTZ-v1.0.1-beta.apk" \
  -H "Authorization: Bearer $GH" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" | python3 -c "import json,sys;d=json.load(sys.stdin);print('APK:', d.get('state'), d.get('size'), d.get('name') or d.get('message'))"

echo "[3] AAB 업로드"
curl -s -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=SERTZ-v1.0.1-beta.aab" \
  -H "Authorization: Bearer $GH" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" | python3 -c "import json,sys;d=json.load(sys.stdin);print('AAB:', d.get('state'), d.get('size'), d.get('name') or d.get('message'))"

echo "[4] 검증"
curl -sIL "https://github.com/apple01234/CERTZ/releases/download/v1.0.1-beta/SERTZ-v1.0.1-beta.apk" 2>/dev/null | grep -iE "^HTTP/|^content-length" | tail -2
curl -sIL "https://github.com/apple01234/CERTZ/releases/download/v1.0.1-beta/SERTZ-v1.0.1-beta.aab" 2>/dev/null | grep -iE "^HTTP/|^content-length" | tail -2
