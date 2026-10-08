#!/bin/bash
# vc138 릴리스 교체 백그라운드 재시도 루프 (vc136 장애 대응 패턴 준용)
#  GitHub API 쓰기(DELETE/PATCH) 일시 장애 → 3분 간격 프로브로 복구 감지 후 자동 교체
#  완료 조건: APK/AAB/매핑 3종이 vc138 사이즈로 교체 + 릴리스명 (vc138) 갱신
LOG=/tmp/release_vc138_loop.log
RLS="https://api.github.com/repos/apple01234/CERTZ/releases/403446266"
API="https://uploads.github.com/repos/apple01234/CERTZ/releases/403446266/assets"
TOKEN=$(cat /home/z/my-project/.secrets/github_token)

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

do_delete() {
  local ID="$1" NAME="$2"
  local CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
    "$RLS/assets/$ID")
  log "del $NAME($ID) -> $CODE"
  [ "$CODE" = "204" ]
}

do_upload() {
  local FILE="$1" NAME="$2" TYPE="$3"
  local CODE=$(curl -s -o /tmp/vc138_up.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: $TYPE" \
    --data-binary "@$FILE" "$API?name=$NAME")
  local SIZE=$(python3 -c "import json;d=json.load(open('/tmp/vc138_up.json'));print(d.get('size','ERR'))" 2>/dev/null)
  log "up $NAME -> $CODE ($SIZE)"
  [ "$CODE" = "201" ]
}

attempt() {
  # 현재 자산 목록
  local LIST=$(curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" "$RLS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('assets',[]):
    print(a['id'], a['name'], a['size'])")
  log "assets: $(echo "$LIST" | tr '\n' ' ')"

  # ① 동일 이름 구자산 삭제
  local OK=1
  for NAME in "SERTZ-v1.0.5-beta.apk" "SERTZ-v1.0.5-beta.aab" "SERTZ-vc137-mapping.txt"; do
    local ID=$(echo "$LIST" | grep " $NAME " | awk '{print $1}')
    if [ -n "$ID" ]; then do_delete "$ID" "$NAME" || OK=0; fi
  done
  [ "$OK" = "1" ] || return 1

  # ② vc138 업로드 (3종)
  OK=1
  do_upload /home/z/my-project/download/SERTZ-v1.0.5-beta.apk "SERTZ-v1.0.5-beta.apk" application/vnd.android.package-archive || OK=0
  do_upload /home/z/my-project/download/SERTZ-v1.0.5-beta.aab "SERTZ-v1.0.5-beta.aab" application/octet-stream || OK=0
  do_upload /home/z/my-project/download/SERTZ-vc138-mapping.txt "SERTZ-vc138-mapping.txt" text/plain || OK=0
  [ "$OK" = "1" ] || return 1

  # ③ 릴리스명·본문 갱신 (PATCH)
  local BODY_FILE=/tmp/vc138_release_body.json
  python3 - <<'EOF' > "$BODY_FILE"
import json
body = """SERTZ v1.0.5-beta (vc138) — v1.4.32 버그 수정 3건

**① 세이브 복원 수정** — 복원이 멀티캐릭터 슬롯 체계를 우회해 레거시 키에만 기록되어 무시되던 근본 버그 수정. 같은 이름 캐릭터 교체 · 활성 캐릭터 교체 · 새 기기 신규 슬롯 편입 3경로 지원.
**② 구글 로그인 수정** — 서버가 구글 인증서를 조회하지 못해 웹 로그인이 실패하던 문제 (인증서 URL 오타 404 → 정상 URL 수정 + JWKS 폴백 + 6초 타임아웃).
**③ 게임 멈춤 차단** — 모바일/APK 저사양 기기에서 보스전 블룸(프레임버퍼 이중 패스)이 유발하던 GPU 프리즈를 챕터 무관 차단 (기존 무스펠·니플헤임 한정 → 기기 클래스 일반화). PC는 기존 화질 유지.

APK 138,929,536B · AAB 140,807,152B · versionCode 138 (SHA-256 cc774f34 동일)
웹(sertz.vercel.app)은 즉시 반영, APK는 덮어설치 필요."""
print(json.dumps({
  "name": "SERTZ v1.0.5-beta (vc138)",
  "body": body,
}, ensure_ascii=False))
EOF
  local PCODE=$(curl -s -o /tmp/vc138_patch.json -w "%{http_code}" -X PATCH \
    -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
    --data-binary @"$BODY_FILE" "$RLS")
  log "patch release -> $PCODE"
  [ "$PCODE" = "200" ] || return 1
  return 0
}

for i in $(seq 1 25); do
  log "===== 시도 $i ====="
  if attempt >> "$LOG" 2>&1; then
    log "완료 — vc138 자산 교체 성공"
    exit 0
  fi
  sleep 180
done
log "한도 초과 — 수동 확인 필요"
exit 1
