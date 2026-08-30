# SERTZ v2.0 APK 설치 안내

## 다운로드
- **GitHub 직접 링크 (클릭 시 다운로드)**
  https://github.com/apple01234/CERTZ/raw/main/download/SERTZ-v2.0.apk
- 파일: `download/SERTZ-v2.0.apk` (16.7MB · Android 7.0 이상 · release 서명 · v2.0 · 10장 90구역)

## 설치 방법 (갤럭시 기준)
1. 위 링크를 폰 브라우저에서 열어 APK 다운로드
2. 다운로드한 APK 탭 → "출처를 알 수 없는 앱/알 수 없는 앱 설치" 허용
   (Chrome: 설정 → 앱 → Chrome → 알 수 없는 앱 설치 허용)
3. 설치 후 실행 — 타이틀 화면이 뜨면 정상

## 앱 특징
- 완전 오프라인 실행: 인터넷 없이 싱글 플레이 가능, 세이브는 폰에 저장
- 세로 화면에서 실행 시 가로 모드 유도 안내 표시
- 멀티플레이: 타이틀 화면 우하단 🌐 버튼 → 서버 주소(https://…) 입력 → 저장 & 새로고침
  → "서버 연결됨"(초록)이 되면 웹 플레이어와 같은 서버(채팅·파티·보스 방송) 플레이

## 재빌드 (개발자용)
- 웹 소스 수정 후: `bash /home/z/my-project/scripts/build_apk.sh`
- 서명 키: `android/sertz-release.keystore` (alias `sertz` / password `sertz2020`)
  — 업데이트 설치(기존 앱 덮어쓰기)는 반드시 같은 키로 서명해야 함
