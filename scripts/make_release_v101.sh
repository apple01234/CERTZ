#!/bin/bash
# v1.0.1 GitHub Release 업로드 (APK) + 재다운로드 md5 검증
# 계승: make_release_v480.sh — v1.0.n 체계 첫 배포 (AAB는 플레이스토어 시점에 별도)
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.1.apk"
APK_MD5=$(md5sum "$APK" | cut -d' ' -f1)
echo "APK_MD5=$APK_MD5"

echo "[1] 릴리스 생성 v1.0.1"
BODY=$(python3 -c "
import json
body = '''## v1.0.1 (versionCode 66) — 전투 외 강화 3종 (요일 균열 테마·유저 거래판·시즌 미션)

- 📅 일일 던전 확장 — 요일별 균열 테마 7종(골드러시 1.6배·지혜 책 2배·강화주문서 12%·약초 물약·전설의 문 에메랄드 8%·무한 소환 1.4배 등), 종료 팝업에 내일 테마 예고
- 🏪 거래소 BM — 유저 거래판(계정 로그인 연계): 전설 등록·구매·취소·정산 수령, 수수료 10% (판매자 90% 정산)
- 🎫 균열 티켓 재충전 — 에메랄드 3💎로 +1, 일 3회 한정
- 🎯 시즌 미션 — 일일 4종/주간 5종, 완료 시 패스 XP 지급(미션→패스→보상 3단 루프)
- ✨ v1.0.0 포함 — 스킬 전용 셰이더(회전베기 참격·돌진 잔상), 보스 룬 마법진 등장, 자체 회원가입/SNS 연동(구글·카카오·네이버), 클라우드 세이브, 입력 버그 수정(이름 소문자·자동이동·검은화면 방어)
- APK md5: $APK_MD5
- 세이브 그대로 유지 · 덮어설치 가능'''
print(json.dumps({'tag_name':'v1.0.1','target_commitish':'main','name':'v1.0.1 — 요일 균열 테마·유저 거래판·시즌 미션','body':body,'draft':False,'prerelease':False}))
")
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases -d "$BODY")
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.1.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check101.apk "https://github.com/$REPO/releases/download/v1.0.1/SERTZ-v1.0.1.apk"
echo "remote: $(md5sum /tmp/dl_check101.apk)"
echo "local : $(md5sum $APK)"
echo "DONE"
