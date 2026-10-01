#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SERTZ — AdMob API v1 수익 리포트 조회 스크립트 (제로 의존성: stdlib + openssl only)

## 배경 (중요)
- AdMob API v1(admob.googleapis.com)은 **API key(AIza...)를 지원하지 않는다** (Google 공식 401:
  "API keys are not supported by this API. Expected OAuth2 access token").
- 유일한 방법: **OAuth2 서비스 계정** — getting-started 문서의 공식 절차.
  https://developers.google.com/admob/api/v1/getting-started

## 최초 1회 설정 (Google Cloud Console + AdMob)
 1) https://console.cloud.google.com 에서 프로젝트 선택 → "API 및 서비스 > 라이브러리" →
    "AdMob API" 검색 → 사용(Enable).
 2) "API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > 서비스 계정" 생성
    → 서비스 계정 상세 → "키" 탭 → "키 추가 > 새 키 만들기 > JSON" → 다운로드한 JSON을
    아래 경로로 저장:  .secrets/admob-service-account.json
 3) AdMob(https://apps.admob.com) 로그인 → 설정(⚙) → 계정 정보에서 **게시자 ID(pub-XXXX…)** 확인
    → 설정 > 사용자 관리에서 서비스 계정 이메일을 사용자로 추가(읽기 권한)하여 계정 연동.
 4) 실행:  python3 scripts/admob_report.py --days 7
    (게시자 ID를 여러 개 가진 경우 --publisher pub-XXXXXXXX 지정)

## 사용법
  python3 scripts/admob_report.py                 # 최근 7일 수익 요약
  python3 scripts/admob_report.py --days 30       # 최근 30일
  python3 scripts/admob_report.py --by-date       # 날짜별 상세 행
  python3 scripts/admob_report.py --adunits       # 광고 단위 목록 조회
  python3 scripts/admob_report.py --publisher pub-XXXXXXXX --days 14

## 보안
- .secrets/ 는 .gitignore 로 제외되어 커밋되지 않는다.
- 발급된 API key(AIzaSyDP4T…)는 AdMob API에 쓸 수 없으므로 .secrets/admob-api-key.txt 에
  보관만 해둔다. GCP 콘솔에서 키 제한(또는 삭제) 권장.
"""

import argparse
import base64
import datetime
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SA_PATH = os.path.join(ROOT, ".secrets", "admob-service-account.json")
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/admob.readonly"
API = "https://admob.googleapis.com/v1"

METRICS = [
    "ESTIMATED_EARNINGS",
    "AD_REQUESTS",
    "MATCHED_REQUESTS",
    "MATCH_RATE",
    "IMPRESSIONS",
    "CLICKS",
    "CLICK_CTR",
    "OBSERVED_ECPM",
]

SETUP_GUIDE = """
[!] .secrets/admob-service-account.json 파일이 없다.

AdMob API는 API key(AIza...)를 지원하지 않으므로 OAuth2 서비스 계정이 필요하다.
아래 4단계를 따라 설정할 것 (getting-started 문서와 동일한 절차):

  1. Google Cloud Console(https://console.cloud.google.com) → 라이브러리 → "AdMob API" 사용 설정
  2. 사용자 인증 정보 → 서비스 계정 생성 → 키(JSON) 발급 →
     저장 위치:  .secrets/admob-service-account.json
  3. AdMob(https://apps.admob.com) → 설정 → 계정 정보에서 게시자 ID(pub-…) 확인
     → 설정 > 사용자 관리에 서비스 계정 이메일 추가(읽기 권한)로 계정 연동
  4. 다시 실행:  python3 scripts/admob_report.py --days 7
"""


def _http(method: str, url: str, token: str = None, payload: dict = None):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            msg = json.loads(body).get("error", {}).get("message", body)
        except Exception:
            msg = body
        raise SystemExit(f"[AdMob API {e.code}] {url}\n{msg[:800]}") from None


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def make_access_token(sa: dict) -> str:
    """서비스 계정 JSON → JWT(RS256, openssl 서명) → OAuth2 access_token"""
    import tempfile

    header = {"alg": "RS256", "typ": "JWT"}
    now = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    claim = {
        "iss": sa["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(claim, separators=(",", ":")).encode())
    )
    pem = sa["private_key"].replace("\\n", "\n")
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as f:
        f.write(pem)
        pem_path = f.name
    try:
        sig = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", pem_path],
            input=signing_input.encode("ascii"),
            capture_output=True,
            check=True,
        ).stdout
    finally:
        os.unlink(pem_path)
    jwt = signing_input + "." + _b64url(sig)

    body = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt}
    ).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"[OAuth {e.code}] {e.read().decode()[:500]}") from None


def fmt_metric(key: str, val) -> str:
    if key == "ESTIMATED_EARNINGS":
        try:
            return f"${float(val):,.2f}"
        except (TypeError, ValueError):
            return str(val)
    if key in ("MATCH_RATE", "CLICK_CTR", "OBSERVED_ECPM"):
        try:
            return f"{float(val):,.4f}"
        except (TypeError, ValueError):
            return str(val)
    return f"{val}"


def main() -> None:
    ap = argparse.ArgumentParser(description="AdMob API v1 수익 리포트 (서비스 계정 OAuth2)")
    ap.add_argument("--days", type=int, default=7, help="최근 N일 (기본 7)")
    ap.add_argument("--by-date", action="store_true", help="날짜별 상세 행 표시")
    ap.add_argument("--adunits", action="store_true", help="광고 단위 목록 조회")
    ap.add_argument("--publisher", default=None, help="게시자 ID (예: pub-1234567890123456)")
    args = ap.parse_args()

    if not os.path.isfile(SA_PATH):
        sys.exit(SETUP_GUIDE)
    with open(SA_PATH, "r", encoding="utf-8") as f:
        sa = json.load(f)

    token = make_access_token(sa)
    print(f"✓ OAuth2 토큰 발급 완료 (서비스 계정: {sa.get('client_email', '?')})")

    accounts = _http("GET", f"{API}/accounts", token).get("account", [])
    if not accounts:
        raise SystemExit(
            "[!] AdMob 계정이 연동되지 않았다. AdMob 콘솔 > 설정 > 사용자 관리에서\n"
            "    서비스 계정 이메일을 사용자로 추가했는지 확인하라."
        )
    for a in accounts:
        print(f"  계정: {a.get('displayName','?')} — {a.get('publisherId','?')}")

    pub = args.publisher
    if not pub:
        if len(accounts) == 1:
            pub = accounts[0]["publisherId"]
        else:
            raise SystemExit("[!] 계정이 여러 개 — --publisher pub-XXXX 로 지정하라.")

    if args.adunits:
        units = _http("GET", f"{API}/accounts/{pub}/adunits?pageSize=200", token).get("adUnit", [])
        print(f"\n== 광고 단위 {len(units)}개 ==")
        for u in units:
            print(f"  [{u.get('adFormat','?'):>8}] {u.get('name','?')} — {u.get('adUnitId','?')}")
        return

    today = datetime.date.today()
    start = today - datetime.timedelta(days=max(args.days, 1))
    payload = {
        "date_range": {
            "fixed_range": {
                "start_date": {"year": start.year, "month": start.month, "day": start.day},
                "end_date": {"year": today.year, "month": today.month, "day": today.day},
            }
        },
        "metrics": METRICS,
    }
    if args.by_date:
        payload["dimensions"] = ["DATE"]

    report = _http("POST", f"{API}/accounts/{pub}/reports:generate", token, payload)
    rows = report.get("row", [])
    if not rows:
        print("\n[리포트 비어 있음] 기간 내 데이터가 없거나 계정 연동 직후라 데이터가 아직 없다.")
        return

    headers = [m for m in (report.get("header", {}).get("columnType") or [{}])]
    names = [h.get("metric") or h.get("dimension") or "?" for h in headers]
    print(f"\n== {pub} 수익 리포트 ({start} ~ {today}, {len(rows)}행) ==")
    if args.by_date:
        for row in rows:
            cells = [c.get("value", "") for c in row.get("cell", [])]
            print("  " + " | ".join(f"{v}" for v in cells))
    else:
        agg = {}
        for row in rows:
            for name, cell in zip(names, row.get("cell", [])):
                if name == "ESTIMATED_EARNINGS":
                    agg[name] = agg.get(name, 0.0) + float(cell.get("value", 0) or 0)
                elif name in ("AD_REQUESTS", "MATCHED_REQUESTS", "IMPRESSIONS", "CLICKS"):
                    agg[name] = agg.get(name, 0) + int(float(cell.get("value", 0) or 0))
        print(f"  기간 합계 수익 : ${agg.get('ESTIMATED_EARNINGS', 0):,.2f}")
        print(f"  광고 요청     : {agg.get('AD_REQUESTS', 0):,}")
        print(f"  매칭 요청     : {agg.get('MATCHED_REQUESTS', 0):,}")
        print(f"  노출(IMPR)    : {agg.get('IMPRESSIONS', 0):,}")
        print(f"  클릭          : {agg.get('CLICKS', 0):,}")
        if agg.get("AD_REQUESTS"):
            print(f"  매칭률        : {agg['MATCHED_REQUESTS'] / agg['AD_REQUESTS'] * 100:.1f}%")


if __name__ == "__main__":
    main()
