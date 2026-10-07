#!/bin/bash
# vc135 Release 자산 교체 — DELETE(3) → UPLOAD(3), 태그 v1.0.5-beta 유지(다운로드 URL 불변)
set -uo pipefail
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
API="https://uploads.github.com/repos/apple01234/CERTZ/releases/403446266/assets"
RLS="https://api.github.com/repos/apple01234/CERTZ/releases/403446266"

echo "== 기존 자산 목록 =="
curl -s -H "Authorization: token $TOKEN" "$RLS" | python3 -c "
import json,sys
for a in json.load(sys.stdin)['assets']:
    print(a['id'], a['name'], a['size'])"

echo "== DELETE =="
for AID in $(curl -s -H "Authorization: token $TOKEN" "$RLS" | python3 -c "
import json,sys
print(' '.join(str(a['id']) for a in json.load(sys.stdin)['assets']))"); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: token $TOKEN" "$RLS/assets/$AID")
  echo "del $AID -> $CODE"
done

echo "== UPLOAD =="
upload() {
  local FILE="$1" NAME="$2" TYPE="$3"
  CODE=$(curl -s -o /tmp/up.json -w "%{http_code}" -X POST \
    -H "Authorization: token $TOKEN" -H "Content-Type: $TYPE" \
    --data-binary "@$FILE" "$API?name=$NAME")
  echo "up $NAME -> $CODE ($(python3 -c "import json;d=json.load(open('/tmp/up.json'));print(d.get('size','ERR'))" 2>/dev/null))"
}
upload /home/z/my-project/download/SERTZ-v1.0.5-beta.apk SERTZ-v1.0.5-beta.apk application/vnd.android.package-archive
upload /home/z/my-project/download/SERTZ-v1.0.5-beta.aab SERTZ-v1.0.5-beta.aab application/octet-stream
upload /home/z/my-project/download/SERTZ-vc135-mapping.txt SERTZ-vc135-mapping.txt text/plain
