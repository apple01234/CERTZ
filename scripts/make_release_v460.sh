#!/bin/bash
# v4.6.0 GitHub Release 업로드 (APK + AAB) + 재다운로드 md5 검증
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.6.0.apk"
AAB="/home/z/my-project/download/SERTZ-v4.6.0.aab"

echo "[1] 릴리스 생성 v4.6.0"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d '{"tag_name":"v4.6.0","target_commitish":"main","name":"v4.6.0 — 출시 준비 & 유저 피드백 5종","body":"## v4.6.0 (versionCode 61) — 출시 준비 & 유저 피드백 5종 수정\n\n- 🛠 BM 구매 음수 버그 차단 — 에메랄드(르쯔) 부족 시 구매 불가 + 음수 잔액 자동 복구 (펫/치장/장비 분기 잔액 검사 누락 수정)\n- 🎁 가방에서 상자/패키지 개봉 — 기타 탭 [열기] 버튼 (구매 개봉과 동일 가중치 롤)\n- ⭐ 가방 스타포스 강화 — 장비 탭 강화 버튼 (상점 이동 불필요, 주문서 가산률 동일 적용)\n- ⚙ 자동 물약·버프 UI 복구 — 기타 탭 최상단 이동 (찾기 쉬움)\n- 👑 GM 전 보스 체험 — 9챕터 보스 전부 즉시 도전 (GM 패널, 스토리 진행 영향 0)\n- 📱 정식 앱 아이콘(골드 스타) + 플레이 스토어 업로드용 AAB 첨부\n- APK md5: 9edf785758021939c4b9a80671f06e00\n- AAB md5: d7780bbfa9ea78a20bc0c7ac4a19d7e3\n- 세이브 그대로 유지 · 덮어설치 가능","draft":false,"prerelease":false}')
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -5; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.6.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] AAB 업로드"
UP2=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.6.0.aab")
echo "$UP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[4] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check.apk "https://github.com/$REPO/releases/download/v4.6.0/SERTZ-v4.6.0.apk"
echo "remote: $(md5sum /tmp/dl_check.apk)"
echo "local : $(md5sum $APK)"
curl -sL -o /tmp/dl_check.aab "https://github.com/$REPO/releases/download/v4.6.0/SERTZ-v4.6.0.aab"
echo "remote: $(md5sum /tmp/dl_check.aab)"
echo "local : $(md5sum $AAB)"
echo "[5] 구버전 v4.5.0 APK 제거"
REL_JSON=$(curl -s -H "Authorization: token $TOKEN" https://api.github.com/repos/$REPO/releases/tags/v4.5.0)
OLD_ID=$(echo "$REL_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
if [ -n "$OLD_ID" ]; then
  for AID in $(echo "$REL_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(str(a['id']) for a in d.get('assets',[])))"); do
    curl -s -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/$OLD_ID/assets/$AID" && echo "deleted asset $AID"
  done
fi
echo "DONE"
