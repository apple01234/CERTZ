#!/bin/bash
# release_1_0_4_beta.sh — v1.0.4-beta GitHub Release 생성 + 자산 업로드
set -e
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
REPO="apple01234/CERTZ"
TAG="v1.0.4-beta"

echo "[1/3] Release 생성"
RESP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d "{
    \"tag_name\":\"$TAG\",
    \"target_commitish\":\"main\",
    \"name\":\"SERTZ v1.0.4-beta (vc125)\",
    \"body\":\"유저 버그 리포트 3건 픽스\\n\\n- 랭킹 부적절 닉네임 항목 운영 제거 (서버 DB 조치 — 즉시 반영)\\n- 구글 로그인: 실패 원인별 안내 강화 + FirebaseAuthentication 플러그인 설정 보완 (Firebase 콘솔 연동값 등록 후 정상 동작)\\n- 초반 1~3챕터 BGM 원곡(Kevin MacLeod) 복구\\n\\n※ Play Console 업로드용: SERTZ-v1.0.4-beta.aab (versionCode 125)\\n※ 기기 직접 설치용: SERTZ-v1.0.4-beta.apk (같은 서명 키 — 덮어설치 호환)\",
    \"draft\":false,
    \"prerelease\":true
  }")
ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
if [ -z "$ID" ]; then echo "Release 생성 실패: $RESP" | head -3; exit 1; fi
echo "  Release ID: $ID"

echo "[2/3] APK 업로드"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @/home/z/my-project/download/SERTZ-v1.0.4-beta.apk \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=SERTZ-v1.0.4-beta.apk"

echo "[3/3] AAB 업로드"
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @/home/z/my-project/download/SERTZ-v1.0.4-beta.aab \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=SERTZ-v1.0.4-beta.aab"

echo "완료: https://github.com/apple01234/CERTZ/releases/tag/$TAG"
