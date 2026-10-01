#!/bin/bash
# v1.0.8 릴리스 업로드 — v1.0.6 스크립트 패턴 재사용
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.8.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.8 — 무한 콘텐츠 10종 대개편 + 확률 투명화 + 셰이더 모드

## 🆕 무한 콘텐츠 10종
- 심연의 탑(무한 층수) · 심층 균열(무한 티어) · 일일 시련(수정자 던전) · 환생(무한 성장 루프) · 연금 제작대 · 펫 육성(진화) · 황금 몬스터 러시 · 심연 상점 · 주간 보스 레이드 · 탑 랭킹

## 🎲 확률 투명화 (주작 감사 결과: 롤 로직 정직 — 공시+천장으로 신뢰 확보)
- eert 큐브 잠재 등급 확률 법정 공시 (레어 60/에픽 28/유니크 10/레전드 2%) + 유니크+ 확정 천장(10회)
- 강화 실패 가산 천장 — ★10 이상 실패 시 다음 시도 +5%p (최대 +15%p, 성공 시 초기화) · UI 성공률에 실시간 반영
- 인벤 강화/eert 버튼에 확률·확정 카운트 칩 표시

## ✨ 셰이더 (버그 수정)
- 툰 셰이더가 Phaser 4 opt-in(enableFilters) 미호출로 한 번도 부착되지 않던 근본 버그 수정 — 플레이어/보스 림라이트 정상 적용
- 설정 → 그래픽 효과 3모드: 항상 높음(셰이더 강제) / 자동(적응형) / 절전 · 자동 축소 시 배너 공지 · 복원 대기 단축

## 🛠 그 외
- 로그인 DB 자가복구(오토시드) · 로그인 창 컴팩트+스크롤
- 2-6 능대 퀘스트: 대상 교정(능대) + 필드 능대 15마리 밀도 부스트 (25토벌 속도 개선)
- 일일 퀘스트 5종 · 성장 패키지 UI 프리미엄 카드

## 📦 설치
- versionCode 73 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.8','target_commitish':'main','name':'SERTZ v1.0.8 — 무한 콘텐츠 10종 + 확률 투명화 + 셰이더 모드','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.8.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v106_check.apk "https://github.com/$REPO/releases/download/v1.0.6/SERTZ-v1.0.8.apk"
md5sum /tmp/v106_check.apk "$APK"
