#!/bin/bash
# v4.4.0 GitHub Release 업로드 + 재다운로드 md5 검증
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v4.4.0.apk"

echo "[1] 릴리스 생성 v4.4.0"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d '{"tag_name":"v4.4.0","target_commitish":"main","name":"v4.4.0 — 메이플 스타일 인벤토리","body":"## v4.4.0 (versionCode 59) — 메이플 스타일 인벤토리 대개편\n\n- 인벤토리 UI 전면 개편: 장비/캐시/기타/AD 4탭 + 5칸 그리드 슬롯 + 수량 배지 (컨셉 이미지 반영)\n- 선택 아이템 상세 정보 + 액션 버튼 하단 고정 (모바일 조작 편의)\n- [정리] 버튼 신설 — 가방 종류→이름순 정렬\n- AD 탭: 광고 보상(일 5회) + 구글 플레이 에메랄드 충전 집약, 오늘 n/5 표시\n- 물약 3~10티어 사용 경로 수정 — v4.3.0 신규 물약 16종이 가방에서 못 마시던 버그\n- H/M 퀵슬롯·자동 사용·장신구 스타포스·eert·거래소·세트 효과 전부 유지\n- md5: 883deb06be80bb0dea96e84e96203c32\n- 세이브 그대로 유지 · 덮어설치 가능","draft":false,"prerelease":false}')
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -5; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v4.4.0.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check.apk "https://github.com/$REPO/releases/download/v4.4.0/SERTZ-v4.4.0.apk"
echo "remote: $(md5sum /tmp/dl_check.apk)"
echo "local : $(md5sum $APK)"
