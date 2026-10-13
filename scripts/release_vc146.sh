#!/usr/bin/env bash
# vc146 — 첫 정식 릴리스 v1.0.6 생성 + 자산 업로드 + 무결성 검증
set -uo pipefail
ROOT=/home/z/my-project
GT=$(git -C "$ROOT" remote get-url origin | sed -n 's#https://apple01234:\([^@]*\)@github.com/.*#\1#p')
[ -n "$GT" ] || { echo "git token 없음"; exit 1; }
API="https://api.github.com/repos/apple01234/CERTZ/releases"
TAG="v1.0.6"

echo "=== 1) 릴리스 생성 (정식 — prerelease 미표기) ==="
NOTES=$(cat <<'EOF'
## SERTZ v1.0.6 (vc146) — 첫 정식 릴리스 🎉
베타 접미사를 제거한 첫 공식 빌드입니다. 덮어설치 호환(서명 동일).

### 피드백 10종 반영
1. **[GM] 완전 엘릭서 무한 사용** — 마실 때 사라지던 버그 근본 수리 (퀵슬롯/자동물약/인벤 전 경로 차감 금지)
2. **5차 제2궁극기 신설** — 12종 전용 연출 · 쿨타임 120초 · MP 150 · 기본 Q키 · 보라색 버튼 (계열 4종 + 4차 세부직업 8종)
3. **툰 셰이더 밝기 대폭 하향** — 셀룰룩 감성 유지, 화면 감광 22% (기본 강도 기준)
4. **정식 빌드 전환** — versionName 1.0.6
5. **2.5D 카메라** — 시점 상승 + 아래 오브젝트가 위를 가리는 y-depth 정렬 + 심도 안개 (설정에서 끔/켬)
6. **무릉도장 실시간 피해량** — 누적 · DPS(최근 3초) · 최고 일격 화면 표시
7. **우측 구석 유령 이펙트 근본 수리** — 3D 오버레이 카메라 원점 보정 누락 수정 (PC에서 이펙트가 우하단으로 어긋나던 원인)
8. **챕터 레벨 제한 상향** — 쿠소디아 12 → 세계수의 뿌리 126 (첫 챕터 교착 방지분 유지)
9. **거래소 전품목 확대** — 엘릭서·장비·물약 등 GM 전용 제외 전체 등록 가능 (장착 중 장비 제외)
10. **크래시 안정화** — 3D 오버레이가 매 프레임 그리기 버퍼를 재할당하던 GPU 메모리 churn 제거

### 다운로드
- `SERTZ-vc146.apk` — 직접 설치용 (덮어설치 호환)
- `SERTZ-vc146.aab` — Play Store 제출용
- `SERTZ-vc146-mapping.txt` — 디옵퓨스케이트 맵
EOF
)
python3 - "$GT" "$NOTES" <<'PYEOF'
import json, sys, urllib.request
gt, notes = sys.argv[1], sys.argv[2]
body = json.dumps({"tag_name": "v1.0.6", "target_commitish": "main", "name": "SERTZ v1.0.6 (vc146) — 첫 정식 릴리스", "body": notes, "draft": False, "prerelease": False}).encode()
req = urllib.request.Request("https://api.github.com/repos/apple01234/CERTZ/releases", data=body,
  headers={"Authorization": f"Bearer {gt}", "Content-Type": "application/json", "User-Agent": "vc146-release"})
try:
    with urllib.request.urlopen(req) as r:
        d = json.load(r)
        print("CREATED", d["id"], d["html_url"])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:300])
    sys.exit(1)
PYEOF

echo "=== 2) 자산 업로드 ==="
RID=$(curl -s -H "Authorization: Bearer $GT" -H "User-Agent: vc146" "$API/tags/$TAG" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "release id: $RID"
upload() { # <file> <name> <ctype>
  local f="$1" n="$2" ct="$3"
  local SZ=$(stat -c%s "$f")
  local HTTP=$(curl -s -o /tmp/up.json -w "%{http_code}" -m 1800 \
    -X POST "https://uploads.github.com/repos/apple01234/CERTZ/releases/$RID/assets?name=$n" \
    -H "Authorization: Bearer $GT" -H "Content-Type: $ct" -H "Content-Length: $SZ" \
    --data-binary "@$f")
  echo "  $n → HTTP $HTTP ($SZ B)"
  [ "$HTTP" = "201" ]
}
upload "$ROOT/download/SERTZ-vc146.apk" "SERTZ-vc146.apk" "application/vnd.android.package-archive" || exit 1
upload "$ROOT/download/SERTZ-vc146-mapping.txt" "SERTZ-vc146-mapping.txt" "text/plain" || exit 1
upload "$ROOT/download/SERTZ-vc146.aab" "SERTZ-vc146.aab" "application/octet-stream" || exit 1

echo "=== 3) 무결성 검증 (다운로드 200 + md5 일치) ==="
for n in SERTZ-vc146.apk SERTZ-vc146.aab SERTZ-vc146-mapping.txt; do
  U="https://github.com/apple01234/CERTZ/releases/download/$TAG/$n"
  CODE=$(curl -s -o /tmp/dl.chk -L -w "%{http_code}" -m 1200 "$U")
  LMD5=$(md5sum "$ROOT/download/$n" | cut -d' ' -f1)
  DMD5=$(md5sum /tmp/dl.chk | cut -d' ' -f1)
  if [ "$CODE" = "200" ] && [ "$LMD5" = "$DMD5" ]; then echo "  ✓ $n HTTP $CODE md5 ${LMD5:0:8}.."; else echo "  ✗ $n HTTP $CODE md5 $LMD5 vs $DMD5"; exit 1; fi
done
echo "=== 4) 해시 기록 ==="
md5sum "$ROOT/download/SERTZ-vc146.apk" "$ROOT/download/SERTZ-vc146.aab"
sha1sum "$ROOT/download/SERTZ-vc146.apk"
stat -c%s "$ROOT/download/SERTZ-vc146.apk"
echo "DONE"
