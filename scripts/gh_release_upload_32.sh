#!/bin/bash
# GitHub Release v3.2.0 생성 + APK 업로드 (토큰은 GH_TOKEN 환경변수로)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
API="https://api.github.com/repos/apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v3.2.0.apk"

BODY=$(cat <<'EOF'
## SERTZ v3.2.0 (versionCode 45)

신규: 5차 궁극기 (Lv.200 해금 · 쿨타임 60초 · 계열별 전용 화려 연출)
수정: 맵 이동 흑화 근본 수정 (카메라 알파 자가치유 + WebGL 컨텍스트 손실 복구)
수정: APK 멀티 연동 — 서버 주소 자동 이행 + 연결 실패 원탭 복구
최적화: 원거리 적 AI 스로틀 · GPU powerPreference

이전 v3.1.0 변경점:
- BGM/효과음 분리 볼륨 슬라이더
- 전직 스토리(시련) 선행 후 전직 진행
- 판매 수량 입력 + MAX 전량 판매
- 늪 몬스터 명칭 교정 (능대)
- 스토리 보스 전용 난이도 / 전직 시련 리스폰 차단

APK md5: `13ea3c2e2d759b82b41757eab3d78ceb`
EOF
)

echo "[1] 릴리스 생성 (v3.2.0)..."
CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  -d "$(python3 -c "
import json, os
body = os.environ['GH_BODY']
print(json.dumps({
    'tag_name': 'v3.2.0',
    'target_commitish': 'main',
    'name': 'SERTZ v3.2.0 — 5차 궁극기 · 흑화 수정 · APK 연동 복구',
    'body': body,
    'draft': False,
    'prerelease': False,
}))
" 2>/dev/null)" --env GH_BODY 2>/dev/null || true)
# 위 파이프가 복잡하므로 python으로 JSON 파일 생성 방식 사용
python3 -c "
import json
body = '''$(echo "$BODY" | sed "s/'/\\\\'/g")'''
" 2>/dev/null || true

# JSON 파일 생성 (안전 방식)
python3 << PYEOF
import json
body = """SERTZ v3.2.0 (versionCode 45)

신규: 5차 궁극기 (Lv.200 해금 · 쿨타임 60초 · 계열별 전용 화려 연출)
수정: 맵 이동 흑화 근본 수정 (카메라 알파 자가치유 + WebGL 컨텍스트 손실 복구)
수정: APK 멀티 연동 — 서버 주소 자동 이행 + 연결 실패 원탭 복구
최적화: 원거리 적 AI 스로틀 · GPU powerPreference

이전 v3.1.0 변경점:
- BGM/효과음 분리 볼륨 슬라이더
- 전직 스토리(시련) 선행 후 전직 진행
- 판매 수량 입력 + MAX 전량 판매
- 늪 몬스터 명칭 교정 (능대)
- 스토리 보스 전용 난이도 / 전직 시련 리스폰 차단

APK md5: 13ea3c2e2d759b82b41757eab3d78ceb"""
payload = {
    "tag_name": "v3.2.0",
    "target_commitish": "main",
    "name": "SERTZ v3.2.0 — 5차 궁극기 · 흑화 수정 · APK 연동 복구",
    "body": body,
    "draft": False,
    "prerelease": False,
}
open("/tmp/rel32.json", "w").write(json.dumps(payload, ensure_ascii=False))
PYEOF

CREATE_RESP=$(curl -s --max-time 90 --retry 3 --retry-delay 3 --retry-all-errors \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$API/releases" \
  --data-binary @/tmp/rel32.json)
echo "$CREATE_RESP" > /tmp/gh_release32_create.json
RELEASE_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$RELEASE_ID" ]; then
  echo "릴리스 생성 실패: $(head -c 300 /tmp/gh_release32_create.json)"
  exit 1
fi
echo "    릴리스 ID: $RELEASE_ID"

echo "[2] APK 업로드 (140MB)..."
UPLOAD_RESP=$(curl -s --max-time 550 --retry 2 --retry-delay 5 \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  -X POST \
  --data-binary "@$APK" \
  "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=SERTZ-v3.2.0.apk")
echo "$UPLOAD_RESP" > /tmp/gh_asset32_upload.json
ASSET_URL=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('browser_download_url','') or d.get('message','FAIL'))" 2>/dev/null)
echo "    결과: $ASSET_URL"

echo "[3] 다운로드 URL:"
echo "    https://github.com/apple01234/CERTZ/releases/download/v3.2.0/SERTZ-v3.2.0.apk"
