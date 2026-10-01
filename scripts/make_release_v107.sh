#!/bin/bash
# v1.0.7 릴리스 업로드 — v1.0.6 스크립트 패턴 재사용 (토큰은 env 또는 git remote에서 파싱)
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.7.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.7 — 로그인 오류 근본 수정 + 코스튬 시스템

## 🛠 수정
- **APK 로그인 실패 근본 수정** — 웹뷰(https://localhost)에서 쿠키 세션이 유지되지 않아 로그인/클라우드 세이브가 실패하던 문제: 서버 CORS+OPTIONS 프리플라이트 응답, 로그인/가입 응답에 토큰 본문 동봉, 클라 Authorization: Bearer 전송 (웹은 기존 쿠키 병행 — 완전 하위 호환)
- **크리티컬 이펙트 가림 축소** — 데미지 텍스트 1.75→1.42 · 충격파/파티클 스케일·알파·지속시간 축소 (타격감은 히트스톱 유지)

## ✨ 신규
- **SPUM식 코스튬 시스템** — 캐릭터 스프라이트에 직접 착장: 왕실 황금 갑옷 32💎 / 암살자의 그림자의상 28💎 / 봄맞이 새싹 의상 24💎 / 해군 사관 제복 24💎 (오라와 독립 슬롯, 세이브 저장)
- **포니테일 헤어 18💎** — 등 뒤에서 살랑이는 갈색 포니테일 (방향별 오프셋+스웨이)
- **프리렌더 3D VFX** — 보스 격파(UNI 폭발+Hovl 플래시) · 5차 각성 의식 플래시 · 마법사 시전 참격 (Hovl Studio/UNI VFX 프리렌더 텍스처)
- **성장 패키지 UI 개편** — 프리미엄 카드 그리드 (구성 아이콘 미리보기 · BEST 배지 · 스토어 CTA)
- **일일 퀘스트 5종 확장** — "오늘의 파밍"(아이템 드롭 40개) + "보스 사냥" 신규 추가

## 📦 설치
- versionCode 72 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`

## ✅ 실측
- 코스튬 구매→자동 착용→렌더링→리로드 세이브 복원 (가로 1280×720/1600×720)
- 로그인 API: 프리플라이트 204 → 로그인 토큰 → /me Bearer 인증 성공
- 캐시상점 치장 탭 신규 4종 진열 · 일일 퀘스트 5종 표시 확인'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.7','target_commitish':'main','name':'SERTZ v1.0.7 — 로그인 오류 근본 수정 + 코스튬 시스템','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.7.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v107_check.apk "https://github.com/$REPO/releases/download/v1.0.7/SERTZ-v1.0.7.apk"
md5sum /tmp/v107_check.apk "$APK"
