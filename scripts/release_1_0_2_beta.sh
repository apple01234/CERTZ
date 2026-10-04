#!/bin/bash
# v1.0.2-beta 릴리스 — GitHub Release 태그 생성 + APK·AAB 업로드(100MB+ → --data-binary)
set -e
cd /home/z/my-project
TOKEN="$(git remote get-url origin | grep -o 'ghp_[A-Za-z0-9]*')"
AUTH="Authorization: Bearer $TOKEN"
API="https://api.github.com/repos/apple01234/CERTZ"

echo "[1/3] 릴리스 생성"
REL_ID=$(curl -s -X POST "$API/releases" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "tag_name":"v1.0.2-beta","target_commitish":"main",
  "name":"SERTZ v1.0.2-beta (vc123)",
  "body":"구글 통합 로그인(Firebase Auth) + 초반 1~3챕터 BGM 3곡 교체 + 조작 UI 배치 복귀 + ads.txt/app-ads.txt 배포\n\n- 구글 로그인: 앱 네이티브 구글창 / 웹 팝업 — 서버 ID토큰 검증 후 기존 계정 체계와 동일 세션 (클라우드 세이브·거래소·랭킹 호환)\n- BGM: bgm_village1·field1·title2 오리지널 합성 음원 교체\n- 조작 UI: 우하단 [자동+물약][스킬][공격] 행 예전 배치 복귀 (버튼 색·모양 유지)\n- ads.txt: google.com, pub-5675573589406258, DIRECT, f08c47fec0942fa0\n\n※ Play Console 업로드용: SERTZ-v1.0.2-beta.aab (versionCode 123)",
  "prerelease":true}' | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
echo "REL_ID=$REL_ID"

echo "[2/3] APK 업로드"
curl -s -o /dev/null -w "APK %{http_code} %{size_download}B\n" -X POST \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL_ID/assets?name=SERTZ-v1.0.2-beta.apk" \
  -H "$AUTH" -H "Content-Type: application/octet-stream" \
  --data-binary @download/SERTZ-v1.0.2-beta.apk

echo "[3/3] AAB 업로드"
curl -s -o /dev/null -w "AAB %{http_code} %{size_download}B\n" -X POST \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL_ID/assets?name=SERTZ-v1.0.2-beta.aab" \
  -H "$AUTH" -H "Content-Type: application/octet-stream" \
  --data-binary @download/SERTZ-v1.0.2-beta.aab
echo "릴리스 완료: https://github.com/apple01234/CERTZ/releases/tag/v1.0.2-beta"
