#!/bin/bash
# v1.0.3-beta 릴리스 — GitHub Release 태그 생성 + APK·AAB 업로드(100MB+ → --data-binary)
set -e
cd /home/z/my-project
TOKEN="$(git remote get-url origin | grep -o 'ghp_[A-Za-z0-9]*')"
AUTH="Authorization: Bearer $TOKEN"
API="https://api.github.com/repos/apple01234/CERTZ"

echo "[1/3] 릴리스 생성"
REL_ID=$(curl -s -X POST "$API/releases" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "tag_name":"v1.0.3-beta","target_commitish":"main",
  "name":"SERTZ v1.0.3-beta (vc124)",
  "body":"구글 통합 로그인(Firebase Auth) + 초반 1~3챕터 BGM 3곡 교체 + 조작 UI 배치 복귀 + ads.txt/app-ads.txt 배포\n\n- 긴급 픽스: 기기에서 결제·부팅 복구·충전소 실가격 사용 시 NativePurchases.then() not implemented 크래시(재부팅 오버레이) 수정 — 결제 플러그인 접근 재설계\n\n- v1.0.2-beta 미포함 기능: 구글 로그인(Firebase Auth)·초반 BGM 교체·조작 UI 배치 복귀\n\n※ Play Console 업로드용: SERTZ-v1.0.3-beta.aab (versionCode 123)",
  "prerelease":true}' | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
echo "REL_ID=$REL_ID"

echo "[2/3] APK 업로드"
curl -s -o /dev/null -w "APK %{http_code} %{size_download}B\n" -X POST \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL_ID/assets?name=SERTZ-v1.0.3-beta.apk" \
  -H "$AUTH" -H "Content-Type: application/octet-stream" \
  --data-binary @download/SERTZ-v1.0.3-beta.apk

echo "[3/3] AAB 업로드"
curl -s -o /dev/null -w "AAB %{http_code} %{size_download}B\n" -X POST \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL_ID/assets?name=SERTZ-v1.0.3-beta.aab" \
  -H "$AUTH" -H "Content-Type: application/octet-stream" \
  --data-binary @download/SERTZ-v1.0.3-beta.aab
echo "릴리스 완료: https://github.com/apple01234/CERTZ/releases/tag/v1.0.3-beta"
