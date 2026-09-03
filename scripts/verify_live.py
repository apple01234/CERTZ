#!/usr/bin/env python
"""SERTZ 게임 라이브 검증 — 타이틀 렌더링 + Phaser 부팅 + 콘솔 에러 체크"""
from playwright.sync_api import sync_playwright
import sys

URL = "http://localhost:3000/"
errors, console_msgs = [], []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: console_msgs.append(f"{m.type}: {m.text[:120]}"))
    pg.on("pageerror", lambda e: errors.append(str(e)[:200]))
    pg.goto(URL, wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(6000)  # Phaser 부팅 대기

    title = pg.title()
    canvas = pg.locator("canvas").count()
    body_text = pg.inner_text("body")[:200]

    # 타이틀 화면 버튼/텍스트 찾기 (게임 UI)
    pg.screenshot(path="/home/z/my-project/scripts/verify-title.png")

    print(f"TITLE: {title}")
    print(f"CANVAS_COUNT: {canvas}")
    print(f"PAGE_ERRORS: {len(errors)}")
    for e in errors[:5]:
        print(f"  ERR: {e}")
    print(f"CONSOLE_SAMPLES:")
    warn_err = [m for m in console_msgs if m.startswith(("error", "warning"))][:8]
    for m in warn_err:
        print(f"  {m}")
    if not warn_err:
        print("  (에러/경고 없음)")
    b.close()

ok = title.startswith("SERTZ") and canvas >= 1 and len(errors) == 0
print("VERIFY_RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
