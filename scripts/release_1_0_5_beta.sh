#!/bin/bash
# release_1_0_5_beta.sh — v1.0.5-beta GitHub Release 생성 + 자산 업로드
set -e
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
REPO="apple01234/CERTZ"
TAG="v1.0.5-beta"

echo "[1/3] Release 생성"
RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d "{
    \"tag_name\":\"$TAG\",
    \"target_commitish\":\"main\",
    \"name\":\"SERTZ v1.0.5-beta (vc126)\",
    \"body\":\"구글 로그인 완성 릴리스\\n\\n- Firebase 콘솔 연동값(google-services.json·SHA-1 등록 완료) 투입 — 네이티브 구글 계정 선택창·ID토큰 발급 정상화\\n- vc125까지의 '구글 로그인 서버 설정이 아직 완료되지 않았어요' 안내 해소\\n- 기타: 버전 게이트 4종 승격 (versionCode 126)\\n\\n※ Play Console 업로드용: SERTZ-v1.0.5-beta.aab (versionCode 126)\\n※ 기기 직접 설치용: SERTZ-v1.0.5-beta.apk (같은 서명 키 — 덮어설치 호환)\",
    \"draft\":false,
    \"prerelease\":true
  }")
ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
if [ -z "$ID" ]; then echo "Release 생성 실패: $RESP" | head -3; exit 1; fi
echo "  Release ID: $ID"

echo "[2/3] APK 업로드"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @/home/z/my-project/download/SERTZ-v1.0.5-beta.apk \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=SERTZ-v1.0.5-beta.apk"

echo "[3/3] AAB 업로드"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @/home/z/my-project/download/SERTZ-v1.0.5-beta.aab \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=SERTZ-v1.0.5-beta.aab"

echo "완료: https://github.com/apple01234/CERTZ/releases/tag/$TAG"
