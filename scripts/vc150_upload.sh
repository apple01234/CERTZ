#!/bin/bash
# vc150_upload.sh — v1.0.9 릴리스에 vc150 자산 multipart 업로드 (v1.0.5-beta 릴리스 손상 회피)
set -uo pipefail
GT=$(git remote get-url origin | sed -n 's#https://apple01234:\([^@]*\)@github.com/.*#\1#p')
REL=385985773
upload() { # <file> <name> <ctype>
  local f="$1" n="$2" ct="$3"
  [ -f "$f" ] || { echo "skip(없음): $n"; return 0; }
  for i in 1 2 3; do
    HTTP=$(curl -s -o /tmp/up150.json -w "%{http_code}" -m 1800 \
      -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$REL/assets?name=$n" \
      -H "Authorization: Bearer $GT" -F "file=@$f;type=$ct")
    echo "[$i] $n → HTTP $HTTP"
    [ "$HTTP" = "201" ] && { echo "  ✓ 완료"; return 0; }
    head -c 150 /tmp/up150.json; echo; sleep 30
  done
  return 1
}
upload /home/z/my-project/download/SERTZ-vc150.apk "SERTZ-vc150.apk" "application/vnd.android.package-archive"
upload /home/z/my-project/download/SERTZ-vc150-mapping.txt "SERTZ-vc150-mapping.txt" "text/plain"
upload /home/z/my-project/download/SERTZ-vc150.aab "SERTZ-vc150.aab" "application/octet-stream"
