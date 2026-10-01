#!/bin/bash
# GitHub Release v4.0.0 생성 + APK 업로드 (토큰은 GH_TOKEN 환경변수)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.0.0.apk"

echo "[1] 릴리스 생성 (v4.0.0)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v4.0.0",
    "target_commitish": "main",
    "name": "SERTZ v4.0.0 — 이세카이 업데이트 (ISEKAI GATE 오마주)",
    "body": "## SERTZ v4.0.0 (versionCode 46)\n\n이세카이 업데이트 — ISEKAI GATE 오마주 20종 신규 시스템:\n- 이세카이 게이트 웨이브 디펜스 (일 3회)\n- 로그라이크 1~3성 카드 선택 + 인런 실버 상점\n- 피규어 가챠 12종 / 배지 / 룬 합성 / 성좌 / 업적\n- 옷장 던전 (60초 파밍, 일 2회)\n- 출석부 14일 / 일일 퀘스트 / 쿠폰 3종\n- 오프라인 보상 (최대 12시간)\n- 스킨 능력치 / 등급업 큐브 / 팀워크 버프\n- 서버 랭킹 (무릉도장/게이트/던전)\n\nAPK md5: `8ccb5b9390c5246976ad6a8dc8971fd7`",
    "draft": false,
    "prerelease": false
  }')
echo "$CREATE_RESP" > /tmp/gh_release_v400.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패 (이미 존재? id 조회 시도)"
  RELEASE_ID=$(curl -s --max-time 60 --retry 3 --retry-all-errors \
    -H "Authorization: token $TOKEN" "$API/releases/tags/v4.0.0" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2] APK 업로드 (140MB — 몇 분 소요)..."
UP=$(curl -s --max-time 560 --retry 2 --retry-delay 3 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v4.0.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('uploaded:', d.get('name'), d.get('size'), d.get('browser_download_url','ERR'))"
