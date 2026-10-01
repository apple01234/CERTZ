#!/bin/bash
# v1.0.10 릴리스 업로드 — GameStudio FX + 보스 카메라 수정 + 4차/5차 스킬 강화
set -e
REPO="apple01234/CERTZ"
APK="/home/z/my-project/download/SERTZ-v1.0.10.apk"
TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(cd /home/z/my-project && git remote get-url origin | sed -n 's|https://\([^@]*\)@github.com.*|\1|p' | sed 's/^x-access-token://')"
fi
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi

MD5="$(md5sum "$APK" | awk '{print $1}')"

NOTE='SERTZ v1.0.10 — GameStudio FX · 평시 쉐이더 · 3D VFX 25종 · 스킬 대강화

## ✨ GameStudio FX (유저 지시: "Game Studio 플러그인 적용" + "평소에도 쉐이더 적용")
- 보스전 전용이던 카메라 블룸을 전투 상시(앰비언트 블룸 신설) — 스킬·파티클·참격이 평소에도 발광
- 보스전 진입 시 강한 블룸으로 자동 교체, 종료 시 앰비언트로 복귀 (이중 패스 방지)
- 그래픽 효과 3모드(항상 높음/자동/절전)와 연동 — 절전 모드에선 자동 해제

## 🧊 3D 에셋 25종 통합 (유저 지시: "3D 에셋 왜 적용 안함??")
- Vefects(Unity 3D VFX 팩) 프리렌더 텍스처 25종: 원소별 펜타클 마법진 5종 · 플레어 8종 · 링/엠블럼 6종 · 화이트 제네릭 6종

## 🐛 보스 카메라 버그 근본 수정 (유저 지시: "보스 등장 시 카메라가 보스를 잠깐 가리키는 버그")
- 이미 본 인트로 대사의 보스(재림·GM·재도전)는 카메라 우회 없이 즉시 전투 개시
- 첫 조우 시네마틱은 유지 + 팬-팔로우 충돌로 카메라가 뚝 끊기던 스냅 제거

## ⚔️ 4차·5차 스킬 이펙트 전면 강화 (유저 지시: "4차 & 5차가 너무 밋밋함")
- 5차 궁극기 공용 인트로: 3D 마법진(클래스 컬러 스핀)+이중 확장 링+임팩트 코어+4방향 스파크
- 4차 스킬 8종(doomsday·judgment·godarrow·skystorm·manaburst·eternalloop·shadowclon·bladedance) 시그니처 3D VFX 레이어
- 5차 궁극기 8종 종결일격 전부 강화 + 5차 각성 의식 대형 골드 마법진 연출

## 📦 설치
- versionCode 75 · 기존 세이브 그대로 유지 · 덮어설치 가능
- md5: `'"$MD5"'`'

echo "[1/3] 릴리스 생성"
REL=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'tag_name':'v1.0.10','target_commitish':'main','name':'SERTZ v1.0.10 — GameStudio FX · 평시 쉐이더 · 스킬 대강화','body':sys.stdin.read(),'draft':False,'prerelease':False}))" <<< "$NOTE")" \
  "https://api.github.com/repos/$REPO/releases")
REL_ID=$(echo "$REL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$REL_ID" ]; then echo "RELEASE_CREATE_FAILED"; echo "$REL" | head -8; exit 1; fi
echo "RELEASE_ID=$REL_ID"

echo "[2/3] APK 업로드"
UP=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK" "https://uploads.github.com/repos/$REPO/releases/$REL_ID/assets?name=SERTZ-v1.0.10.apk")
STATE=$(echo "$UP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',''))")
echo "UPLOAD_STATE=$STATE"

echo "[3/3] 재다운로드 md5 검증"
sleep 5
curl -sL -o /tmp/v1010_check.apk "https://github.com/$REPO/releases/download/v1.0.10/SERTZ-v1.0.10.apk"
md5sum /tmp/v1010_check.apk "$APK"
