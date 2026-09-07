#!/bin/bash
# GitHub Release v4.1.0 생성 + APK 업로드
# 보안: 토큰은 환경변수 GH_TOKEN 으로 전달 (파일에 하드코딩 금지 — 시크릿 푸시 보호)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.1.0.apk"

echo "[1] 릴리스 생성 (v4.1.0)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d '{
    "tag_name": "v4.1.0",
    "target_commitish": "main",
    "name": "SERTZ v4.1.0 — 바르가 업데이트 + 피드백 15종",
    "body": "## SERTZ v4.1.0 (versionCode 47)\n\n유저 피드백 15종 반영:\n- 이벤트 구역(무릉도장/수비전/던전) 나가기 검은 화면 근본 수정\n- 무릉도장 타이머 폰 표시 수정\n- 설정창 긴급 귀환 장치 (가장 가까운 마을, 8초 쿨)\n- 파티원 스킬·공격 동기화 (같은 구역)\n- 쿠폰 입력 중 단축키 차단\n- 채팅창 접기/펼치기\n- 수비전 도중 철수 보상 축소 (악용 차단)\n- 포탈 위치 라벨 + 화면 밖 가이드\n- 스토리 토벌 목표 상향 (13~30마리)\n- 적응형 품질 (저사양 폰 자동 최적화)\n- 광고 보상 + 구글 플레이 충전 연동 준비 (AdMob/Play Billing 내장)\n- 명칭 변경: 바르가 수비전 / 균열 던전 / 바르가 원정대\n\nmd5: `392827438d5716ecd72cdae187717db2`",
    "draft": false,
    "prerelease": false
  }')
echo "$CREATE_RESP" > /tmp/gh_release_create.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패: $(head -c 300 /tmp/gh_release_create.json)"
  exit 1
fi
echo "    릴리스 ID: $RELEASE_ID"

echo "[2] APK 업로드 (140MB)..."
UPLOAD_RESP=$(curl -s --max-time 550 --retry 2 --retry-delay 5 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  -X POST \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v4.1.0.apk")
echo "$UPLOAD_RESP" > /tmp/gh_asset_upload.json
ASSET_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browser_download_url','') or d.get('message','FAIL'))" 2>/dev/null)
echo "    결과: $ASSET_URL"
