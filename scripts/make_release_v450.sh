#!/bin/bash
# v4.5.0 GitHub Release 업로드 + 재다운로드 md5 검증 (토큰은 반드시 env로)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.5.0.apk"
DL="/home/z/my-project/_dl_check.apk"

echo "[1] 릴리스 생성 v4.5.0"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d '{"tag_name":"v4.5.0","target_commitish":"main","name":"v4.5.0 — BM 표준화 & 도파민 시즌제","body":"## v4.5.0 (versionCode 60) — BM 표준화 & 도파민 시즌제\n\n- 시즌 패스 신설: 월 단위 시즌 · 30레벨 무료/프리미엄 듀얼 트랙 · 프리미엄 30💎 (도달분 소급 수령)\n- SERTZ 패스 구독: 50💎/30일 — 매일 에메랄드 +3 · 광고 보상 2배 · 광고 한도 8회\n- 확률 공시(게임산업법 준수): 가챠 상자 4종 + 피규어 가챠 확률 전면 공개\n- 광고 확장: 무료 상자(일 3회) · 버프 물약 세트(일 2회) · 스타터팩 첫결제 하이라이트\n- 웹샵(+10% 보너스) 로드맵 선포 · BM 기획서 docs/BM_PLAN.md\n- md5: 1d229f25509dbf3fa158bef25dc0eebb\n- 세이브 그대로 유지 · 덮어설치 가능","draft":false,"prerelease":false}')
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -5; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.5.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] 재다운로드 md5 검증"
curl -sL -o "$DL" "https://github.com/$REPO/releases/download/v4.5.0/SERTZ-v4.5.0.apk"
echo "remote: $(md5sum $DL)"
echo "local : $(md5sum $APK)"
rm -f "$DL"
