#!/bin/bash
# v1.0.3 릴리스 업로드 — v1.0.1 스크립트 패턴 재사용 (토큰은 env 또는 git remote에서 파싱)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.3.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

NOTE='SERTZ v1.0.3 — 유저 버그 픽스 8종

## 🛠 수정
- **유저 거래소 크래시 근본 수정** — APK에서 계정·거래소·클라우드 세이브 API가 웹뷰 내장 서버(localhost)로 날아가 실패/크래시하던 것 → 실제 게임 서버로 연결 + 서버 응답 검증
- **캐시상점** — "BM 상점" → "캐시상점" 명칭 변경 · 기본상점(골드) 아이템 전부 제외로 0 르쯔 진열 원천 제거 (캐시 전용 49종만 진열) · 일일 특가 풀 정리
- **고대왕의 반지 중첩 버그** — 같은 장신구를 여러 슬롯에 껴 스탯이 2배가 되던 것 금지 (같은 장신구는 1개만 장착)
- **GM 로그인 안내** — 계정 패널에 안내 추가: **admin 또는 apple01234** 아이디로 회원가입/로그인하면 관리자 인정 → 마을에 GM NPC 등장
- **마을 관리자 UI 잔존 버그** — 비관리자에게 GM 접속 칩이 남아 있던 것 완전 숨김
- **펫 이름=디자인 일치** — 잿불 새 엠버→불꽃 요정 엠버 · 빛의 유니콘→빛의 요정 유니 · 골렘 조각상→철석 슬라임 등 6종
- **일반 버프 분류** — 일반상점 버프는 캐시템이 아니므로 인벤 캐시 탭 → 기타 탭으로 이동
- **랜덤박스 보상 UI** — 가방에서 상자 열면 보상 팝업이 인벤토리 위에 표시
- **UI/글자 짤림** — 타이틀 버전 배지·크레딧 화면 밖 잘림 수정
- 등급업 큐브 사용 버튼(인벤 장비 탭) v1.0.2 경로 유지 확인

## 📦 설치
- versionCode 68 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `1bdce61a3eef95b9d32c4f2ff20bcefd`'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.3','target_commitish':'main','name':'SERTZ v1.0.3 — 유저 버그 픽스 8종','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.3.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v103_check.apk "https://github.com/$REPO/releases/download/v1.0.3/SERTZ-v1.0.3.apk"
md5sum /tmp/v103_check.apk "$APK"
