#!/bin/bash
# vc154_upload.sh — v1.0.9 릴리스에 vc154 자산 multipart 업로드 + 구버전 자산 정리
set -uo pipefail
GT=$(git remote get-url origin | sed -n 's#https://apple01234:\([^@]*\)@github.com/.*#\1#p')
REL=385985773
upload() { # <file> <name> <ctype>
  local f="$1" n="$2" ct="$3"
  [ -f "$f" ] || { echo "skip(없음): $n"; return 0; }
  for i in 1 2 3; do
    HTTP=$(curl -s -o /tmp/up154.json -w "%{http_code}" -m 1800 \
      -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL/assets?name=$n" \
      -H "Authorization: Bearer $GT" -F "file=@$f;type=$ct")
    echo "[$i] $n → HTTP $HTTP"
    [ "$HTTP" = "201" ] && { echo "  ✓ 완료"; return 0; }
    head -c 150 /tmp/up154.json; echo; sleep 30
  done
  return 1
}
upload /home/z/my-project/download/SERTZ-vc154.apk "SERTZ-vc154.apk" "application/vnd.android.package-archive"
upload /home/z/my-project/download/SERTZ-vc154-mapping.txt "SERTZ-vc154-mapping.txt" "text/plain"
