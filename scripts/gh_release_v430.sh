#!/bin/bash
# GitHub Release v4.3.0 생성 + APK 업로드 (토큰은 GH_TOKEN 환경변수)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.3.0.apk"

echo "[1] 릴리스 생성 (v4.3.0)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v4.3.0",
    "target_commitish": "main",
    "name": "SERTZ v4.3.0 — BM 대확장 & 도파민 (가챠·패키지·일일특가·아이템 53종)",
    "body": "## SERTZ v4.3.0 (versionCode 58)\n\nBM 대확장 & dopamine driven development:\n- 가챠 상자 4종 (무쇠/은/금/전설 — 구매 즉시 개봉, 가중치 랜덤)\n- 패키지 6종 (묶음 가치 40~60%)\n- 일일 특가 3종 30%↓ (매일 자정 교체)\n- 신규 아이템 53종: 물약 16 · 장신구 12 · 펫 6 · 치장 6 · 버프 3\n- BM 상점 카테고리 탭 7종 · 카탈로그 90종 (전체 130종+)\n- 자동전투 포탈 탑승 (적 전멸 시 자동 진입 — 검은 화면 가드 유지)\n- 다크 챕터만 어둠+불빛 (니플헤임/스바르트알프헤임/니다벨리르/헬/심연)\n- 전사 회전베기 ↔ 기본공격 사운드 스왑\n\nAPK md5: `ed6adc5c92d6a81263bbd37ee0a41dc0`",
    "draft": false,
    "prerelease": false
  }')
echo "$CREATE_RESP" > /tmp/gh_release_v430.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패 (이미 존재? id 조회 시도)"
  RELEASE_ID=$(curl -s --max-time 60 --retry 3 --retry-all-errors \
    -H "Authorization: token $TOKEN" "$API/releases/tags/v4.3.0" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
fi
echo "RELEASE_ID=$RELEASE_ID"

echo "[2] APK 업로드 (100MB — 몇 분 소요)..."
UP=$(curl -s --max-time 560 --retry 2 --retry-delay 3 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v4.3.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('uploaded:', d.get('name'), d.get('size'), d.get('browser_download_url','ERR'))"
