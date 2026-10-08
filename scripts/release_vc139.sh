#!/bin/bash
# release_vc139.sh — vc139 자산 업로드 (별도 이름 경로 — DELETE 장애 회피)
set -u
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
API="https://uploads.github.com/repos/apple01234/CERTZ/releases/403446266/assets"

upload() {
  local f="$1" name="$2" type="$3"
  echo "[upload] $name ($(stat -c%s "$f") B)"
  local code=$(curl -s -o /tmp/gh_up.json -w "%{http_code}" -X POST "$API?name=$name" \
    -H "Authorization: token $TOKEN" -H "Content-Type: $type" --data-binary @"$f")
  echo "  -> HTTP $code"
  [ "$code" = "201" ]
}

upload /tmp/SERTZ-vc139.apk SERTZ-vc139.apk application/vnd.android.package-archive
APK_OK=$?
upload /home/z/my-project/download/SERTZ-vc139-mapping.txt SERTZ-vc139-mapping.txt text/plain
MAP_OK=$?
echo "APK=$APK_OK MAP=$MAP_OK"
