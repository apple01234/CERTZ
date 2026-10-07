#!/bin/bash
# vc136 Release 자산 교체 (태그 v1.0.5-beta 유지 — 다운로드 URL 불변)
set -e
TOKEN=$(cat /home/z/my-project/.secrets/github_token)
API="https://api.github.com/repos/apple01234/CERTZ"
RELEASE_ID=403446266
APK=/tmp/SERTZ-v1.0.5-beta.apk
AAB=/home/z/my-project/download/SERTZ-v1.0.5-beta.aab
MAP=/home/z/my-project/download/SERTZ-vc136-mapping.txt
AUTH="Authorization: Bearer $TOKEN"
ACCEPT="Accept: application/vnd.github+json"

echo "[1] 현재 자산 목록"
curl -s --max-time 60 -H "$AUTH" -H "$ACCEPT" "$API/releases/$RELEASE_ID" > /tmp/rel136.json
python3 - <<'EOF'
import json
d = json.load(open("/tmp/rel136.json"))
for a in d.get("assets", []):
    print(a["id"], a["name"], a["size"])
EOF

echo "[2] 기존 자산 삭제 (vc135 3종)"
for AID in $(python3 -c "
import json
d = json.load(open('/tmp/rel136.json'))
print(' '.join(str(a['id']) for a in d.get('assets', []) if a['name'].endswith(('.apk', '.aab', '.txt'))))
"); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 -X DELETE -H "$AUTH" -H "$ACCEPT" "$API/releases/assets/$AID")
  echo "  delete $AID → $CODE"
done

echo "[3] 신규 자산 업로드"
for F in "$APK:SERTZ-v1.0.5-beta.apk" "$AAB:SERTZ-v1.0.5-beta.aab" "$MAP:SERTZ-vc136-mapping.txt"; do
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

echo "[4] 릴리스 본문 vc136 갱신"
BODY=$(cat <<'JSON'
{
  "tag_name": "v1.0.5-beta",
  "name": "SERTZ v1.0.5-beta (vc136)",
  "body": "## SERTZ v1.0.5-beta — versionCode 136 (v1.4.30)\n\n유저 지시 15건 반영:\n1. 게임 멈춤 버그 완화 (무스펠헤임 보스전 블룸 제거·EXP 대량 지급 가드·보스 타이머 정리)\n2. n차 스킬 사다리 대폭 강화 (전직마다 ×1.12~1.48 누적 + 버프 지속시간 증가) + 직업 특화(사냥형/보스형 피해 +최대 50%)\n3. 공동 토벌전 하루 1회 입장 + 보스 HP ×6로 대폭 상향 (공격은 하향)\n4. 장신구도 자동 강화 가능 (반지·펜던트 전부)\n5. 강화 주문서 에메랄드 전용 판매 (30💎 — 골드 상점 철수)\n6. 5차 공통 이펙트 축소 — 4차기(B)만 풀 패키지, 일반 스킬은 경량화\n7. 이터널 실성능 강화 (스킬 배율 1.4·중력 붕괴/영원의 고리/영겁극 재조정·보스 시간 잠금)\n8. 모든 캐릭터는 '모험가'로 시작 → 마을 퀘스트(전직 퀘스트) 완료 후 전직관에서 1차 직업 선택\n9. 클래스룸(교실 모드) 신설 — 10/20/50/100명 협동 미니게임 3종: 학급 토벌전·공유 보스 레이드·사냥 경쟁전 (더보기 → 교실, L키)\n10. 구글 로그인 검증 실패 근본 수정 (서버 응답 지연 원인 제거 + 실패 시 구체적 원인 표시)\n11. 니플헤임 어둡게 조정 (눈부심 완화)\n12. 보스 전투 중 포탈/이동 차단\n13. 랭킹 30초 자동 갱신\n15. 반격(노란 링) 보스 머리 위에 '반격! 공격' 라벨 상시 표시 — 링이 보이면 1번 때려라! (성공 시 기절+피해 ×1.6)\n\n※ APK 139,352,049 bytes · vc135 → vc136 덮어설치 권장"
}
JSON
)
curl -s --max-time 60 -X PATCH -H "$AUTH" -H "$ACCEPT" -H "Content-Type: application/json" \
  -d "$BODY" "$API/releases/$RELEASE_ID" > /tmp/rel136_patch.json
python3 -c "import json; d=json.load(open('/tmp/rel136_patch.json')); print('  릴리스명:', d.get('name','FAIL'))"

echo "[5] 최종 자산 확인"
curl -s --max-time 60 -H "$AUTH" -H "$ACCEPT" "$API/releases/$RELEASE_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for a in d.get('assets', []):
    print(' ', a['name'], a['size'])
"
echo "DONE"
