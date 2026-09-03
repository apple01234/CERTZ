@echo off
chcp 65001 >nul
echo ============================================
echo  SERTZ v3.0.24 APK 합치기 (Windows)
echo ============================================
echo.
copy /b "SERTZ-v3.0.25.apk.part1"+"SERTZ-v3.0.25.apk.part2"+"SERTZ-v3.0.25.apk.part3" "SERTZ-v3.0.25.apk"
if errorlevel 1 (
  echo [실패] 파트 3개가 이 폴더에 모두 있는지 확인하세요.
) else (
  echo [완료] SERTZ-v3.0.25.apk 생성됨 (140.9MB)
  echo 이 파일을 폰으로 옮겨서 설치하세요.
)
echo.
pause
