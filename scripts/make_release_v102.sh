#!/bin/bash
# v1.0.2 GitHub Release 업로드 (APK + AAB) + 재다운로드 md5 검증
# 계승: make_release_v480.sh / make_release_v101.sh
set -e
TOKEN="${GH_TOKEN:?GH_TOKEN 환경변수 필요}"
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.2.apk"
AAB="/home/z/my-project/download/SERTZ-v1.0.2.aab"
APK_MD5=$(md5sum "$APK" | cut -d' ' -f1)
AAB_MD5=$(md5sum "$AAB" | cut -d' ' -f1)
echo "APK_MD5=$APK_MD5 AAB_MD5=$AAB_MD5"

echo "[1] 릴리스 생성 v1.0.2"
BODY=$(python3 -c "
import json, sys
apk_md5, aab_md5 = sys.argv[1], sys.argv[2]
body = '''## v1.0.2 (versionCode 67) — 통합 안정화 릴리스

### 버그 수정
- 보스 등장 컷씬 카메라: 대사 종료 이벤트 기준 복귀 (기존 0.8초 고정 타이머 제거)
- 무릉도장 허수아비 무한 납작/부풀음 근본 수정 (기준 스케일 고정)
- EERT 큐브 연타 다중 소모 차단 · 등급업 큐브 사용 UI 신설
- 0 르쯔 아이템 제거 (BM 47종 + 시작 장비 기준가 부여)
- 아이템 이미지 중복 32그룹 해소 — 고유 아이콘 90종 신규 생성
- NPC 초상화 불일치 수정 (가름·시조 4계열) · 세이브 복원 NaN 수정

### 시스템 개선
- 일반 물약 6~10티어 일반 상점 판매 + 상점 카테고리 세분화
- 마을 BGM 9챕터 전부 상이 + 실내 전용 트랙
- 니플헤임 밝기 완화 + 챕터별 횃불 프로필
- 툰 림라이트(캐릭터/보스) · 치장 외형 오버레이 · 목표 자동 강화
- 시즌 패스 한번에 받기 · 업적 진행도/수령가능 필터 · 집/여관 밸런스 분리

### 보안
- GM 서버 롤 검증(관리자 전용) + 관리자 API + Rate Limit + Audit Log
- 멀티플레이 CORS/랭킹 상한/채팅 제한 · allowBackup=false
- 현금 패키지 프레임워크(스토어 상품 ID 기준)

- APK md5: $apk_md5
- AAB md5: $aab_md5
- 세이브 그대로 유지 · 덮어설치 가능'''
print(json.dumps({'tag_name':'v1.0.2','target_commitish':'main','name':'v1.0.2 — 통합 안정화 (버그 수정·밸런스·보안·출시 빌드)','body':body,'draft':False,'prerelease':False}))
" "$APK_MD5" "$AAB_MD5")
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases -d "$BODY")
REL_ID=$(echo "$REL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.2.apk")
echo "$UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[3] AAB 업로드"
UP2=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$AAB" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.2.aab")
echo "$UP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('UPLOADED:', d.get('name'), d.get('size'))"

echo "[4] 재다운로드 md5 검증"
curl -sL -o /tmp/dl_check102.apk "https://github.com/$REPO/releases/download/v1.0.2/SERTZ-v1.0.2.apk"
echo "remote: $(md5sum /tmp/dl_check102.apk)"
echo "local : $(md5sum $APK)"
echo "DONE"
