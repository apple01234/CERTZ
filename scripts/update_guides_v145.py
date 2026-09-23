# v1.4.5 — apk-guide.html + APK_다운로드_안내.txt 최상단에 v1.4.5 섹션 추가 (md5는 빌드 후 __MD5__/__SIZE__ 토큰 교체)
import io

GUIDE = "public/apk-guide.html"
TXT = "download/APK_다운로드_안내.txt"

g = io.open(GUIDE, encoding="utf-8").read()
g = g.replace("<title>SERTZ v1.4.4 APK 다운로드 안내</title>", "<title>SERTZ v1.4.5 APK 다운로드 안내</title>")
g = g.replace("<h1>SERTZ v1.4.4 APK 다운로드 안내</h1>", "<h1>SERTZ v1.4.5 APK 다운로드 안내</h1>")
g = g.replace('<div class="sub">versionCode 96 · 기존 세이브 그대로 유지 · 덮어설치 가능</div>',
              '<div class="sub">versionCode 97 · 기존 세이브 그대로 유지 · 덮어설치 가능</div>')
g = g.replace('<b>이번 버전(v1.4.4) — 첫 사냥터 레벨 교착 근본 수정</b><br>',
              '''<b>이번 버전(v1.4.5) — “이상한 비석·ARG 페이지 접속 후 무한 재부팅” 근본 차단 + 플레이스토어 대비</b><br>
    ♻️ 무한 재부팅 근본 차단 — ① 재부팅 예산: 2분 창에 자가 재부팅 최대 2회, 초과 시 자동 재부팅을 멈추고 수동 복구 화면 제공 ② 마을 이상한 비석은 APK에서 게임 화면을 떠나지 않게 변경(주소 클립보드 복사 안내) ③ 외부 페이지 복귀 직후 15초 관찰 유예 — 불필요한 즉시 재부팅 제거<br>
    📋 플레이스토어 대비 — 광고 ID(AD_ID) 미사용 선언 · 지원센터(/support)·개인정보처리방침(/privacy)·계정 삭제 API 신설 · 모든 통신 HTTPS 강제<br>
    🌐 멀티 진입 노출 — 더보기에 '멀티' 버튼 추가, 파티·친구 위젯을 좌측으로 이동(HUD 겹침 해소)<br>
    💾 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다 (⚠ applicationId가 com.sertz.myapp로 변경 — 구버전 삭제 후 신규 설치, 계정 로그인 유저는 클라우드 세이브 복원로 이어 가능)<br>
    <b>이전 버전(v1.4.4) — 첫 사냥터 레벨 교착 근본 수정</b><br>''')
g = g.replace("https://github.com/apple01234/CERTZ/releases/download/v1.4.4/SERTZ-v1.4.4.apk",
              "https://github.com/apple01234/CERTZ/releases/download/v1.4.5/SERTZ-v1.4.5.apk")
g = g.replace("⬇ SERTZ v1.4.4 APK 바로 다운로드 (107MB · 즉시 시작)",
              "⬇ SERTZ v1.4.5 APK 바로 다운로드 (__SIZE_MB__MB · 즉시 시작)")
import re
g = re.sub(r'<li>무결성 확인용 md5: <code>[^<]*</code> \(<b>[^<]*</b> · versionCode 96\)</li>',
           '<li>무결성 확인용 md5: <code>__MD5__</code> (<b>__SIZE__B</b> · versionCode 97)</li>', g)
io.open(GUIDE, "w", encoding="utf-8").write(g)

t = io.open(TXT, encoding="utf-8").read()
new_section = """══════════════════════════════════════════
v1.4.5 (최신) — 무한 재부팅 근본 차단 + 플레이스토어 대비
· 다운로드: https://github.com/apple01234/CERTZ/releases/download/v1.4.5/SERTZ-v1.4.5.apk
· md5: __MD5__ (__SIZE__B, versionCode 97)
· 무한 재부팅 근본 차단 ("이상한 돌·ARG 웹페이지 접속시 게임 무한 재부팅") —
  ① 재부팅 예산: 2분 창에 자가 재부팅 최대 2회 — 초과 시 자동 재부팅을 멈추고
     수동 복구 화면(다시 시작 버튼)을 표시해 루프를 원천 차단
  ② 마을 이상한 비석: APK에서는 게임을 떠나지 않고 주소를 클립보드에 복사해 안내
     (window.open으로 WebView가 /secret/으로 이동해 게임이 언로드되던 것이
      복귀 후 재부팅 루프의 트리거였음)
  ③ 외부 페이지 복귀 직후 15초 관찰 유예 — 즉시 재부팅 제거 + 렌더 프리즈 판정 강화
· 플레이스토어 대비 —
  · 광고 ID(AD_ID) 미사용 선언 (매니페스트 tools:node="remove")
  · applicationId com.sertz.myapp (Play Console 등록명과 일치)
  · 지원센터 /support (문의·기기 데이터 삭제·계정 삭제) + 개인정보처리방침 /privacy
  · 모든 통신 HTTPS 강제 (http 주소 자동 https 승격)
· 멀티 진입 노출 — HUD 더보기에 '멀티' 버튼, 파티/친구 위젯 좌측 이동 (겹침 해소)
· 세이브/진행상황 그대로 유지 — 덮어설치만 하면 됩니다
  ※ applicationId 변경: 구버전(com.sertz.yggdrasil) 위에는 덮어설치 불가 —
     구버전 삭제 후 신규 설치. 계정 로그인 유저는 로그인→클라우드 세이브 복원로 이어서 가능

"""
t = new_section + t
io.open(TXT, "w", encoding="utf-8").write(t)
print("OK — v1.4.5 sections added")
