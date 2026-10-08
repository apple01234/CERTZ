#!/bin/bash
# vc137 Release 자산 교체 (태그 v1.0.5-beta 유지 — 다운로드 URL 불변)
set -e
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
API="https://api.github.com/repos/apple01234/CERTZ"
RELEASE_ID=403446266
APK=/tmp/SERTZ-v1.0.5-beta.apk
AAB=/home/z/my-project/download/SERTZ-v1.0.5-beta.aab
MAP=/home/z/my-project/download/SERTZ-vc137-mapping.txt
AUTH="Authorization: Bearer $TOKEN"
ACCEPT="Accept: application/vnd.github+json"

echo "[1] 현재 자산 목록"
curl -s --max-time 60 -H "$AUTH" -H "$ACCEPT" "$API/releases/$RELEASE_ID" > /tmp/rel137.json
python3 - <<'EOF'
import json
d = json.load(open("/tmp/rel137.json"))
for a in d.get("assets", []):
    print(a["id"], a["name"], a["size"])
EOF

echo "[2] 기존 자산 삭제 (vc136 3종)"
for AID in $(python3 -c "
import json
d = json.load(open('/tmp/rel137.json'))
print(' '.join(str(a['id']) for a in d.get('assets', []) if a['name'].endswith(('.apk', '.aab', '.txt'))))
"); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -X DELETE -H "$AUTH" -H "$ACCEPT" "$API/releases/assets/$AID")
  echo "  delete $AID → $CODE"
done

echo "[3] 신규 자산 업로드"
for F in "$APK:SERTZ-v1.0.5-beta.apk" "$AAB:SERTZ-v1.0.5-beta.aab" "$MAP:SERTZ-vc137-mapping.txt"; do
  FILE="${F%%:*}"
  NAME="${F##*:}"
  SIZE=$(stat -c%s "$FILE")
  echo "  upload $NAME ($SIZE bytes)..."
  RESP=$(curl -s --max-time 550 -H "$AUTH" -H "Content-Type: application/octet-stream" \
    -X POST --data-binary "@$FILE" \
    "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RELEASE_ID/assets?name=$NAME")
  OK=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('size',0))" 2>/dev/null || echo "FAIL")
  echo "    → 서버 확인 size: $OK"
done

echo "[4] 릴리스 본문 vc137 갱신"
BODY=$(cat <<'JSON'
{
  "tag_name": "v1.0.5-beta",
  "name": "SERTZ v1.0.5-beta (vc137)",
  "body": "## SERTZ v1.0.5-beta — versionCode 137 (v1.4.31)\n\n유저 지시 7건 반영:\n1. 다운로드 폴더 정리 — 사진·구버전 문서 아카이브 정리\n2. 공동 토벌전 보스 HP ×6 → **×30 대폭 상향** (솔로 ~32만 / 4인 ~65만)\n3. 교실 파티 게임 3종 신설 (기존 3종 유지 + 목표 대폭 상향):\n   · 팀 킬전 — 레드 vs 블루 자동 팀편성 대결 (팀당 참가자×40킬)\n   · 보물 사냥 — 정예 몬스터만 카운트하는 희귀 사냥 (참가자×8)\n   · 퀴즈쇼 — 선생님이 게임 지식 퀴즈 출제 → 학생 전원 패널 투표·실시간 집계·30초\n   · 학급 토벌전 목표 ×20→×50 · 공유 보스 3천+900 → 8천+2,500\n4. 보스 개편 — 유저 제공 9보스 아틀라스 적용:\n   · 보스 크기 대폭 확대 (프레임 240×180 → 최대 436px급)\n   · 배경 완전 제거(투명) + 보스당 1장 아틀라스 (로딩 요청 1/42)\n   · 12프레임 풀애니 7종 (대기/이동/공격/특수기술 3종/사망)\n   · 니드호그=수목룡 · 펜리르=설원 백랑 · 수르트=용암골렘 · 스콜=얼음 봉황+하티(화염 늑대 트윈 전용 아트) · 심연의 수호자=흑마수 · 눈보라의 거수=해적선 · 심연의 군주=헬 악마 · 나그라파르=발할라 천사기사 전용 아트\n5. 니플헤임 게임 멈춤 완화 (보스전·평시 블룸 생략 + 눈보라 파티클 경량화)\n6. 니플헤임 더 어둡게 (암전 0.38→0.52 + 지면/벽 틴트 암화)\n7. 전체 최적화 — 구 AI 보스 에셋 341종 폐기 (522→181)·보스 애니 부팅 즉시 등록\n\n※ APK 138,928,932 bytes · vc136 → vc137 덮어설치 권장"
}
JSON
)
curl -s --max-time 60 -X PATCH -H "$AUTH" -H "$ACCEPT" -H "Content-Type: application/json" \
  -d "$BODY" "$API/releases/$RELEASE_ID" > /tmp/rel137_patch.json
python3 -c "import json; d=json.load(open('/tmp/rel137_patch.json')); print('  릴리스명:', d.get('name','FAIL'))"

echo "[5] 최종 자산 확인"
curl -s --max-time 60 -H "$AUTH" -H "$ACCEPT" "$API/releases/$RELEASE_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for a in d.get('assets', []):
    print(' ', a['name'], a['size'])
"
echo "DONE"
