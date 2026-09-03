#!/usr/bin/env python
"""모바일 에뮬레이션 — TouchControls 스킬 아이콘 렌더 확인 + 404 리소스 캡처"""
from playwright.sync_api import sync_playwright

fails = []
with sync_playwright() as p:
    iphone = p.devices["Pixel 5"]
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = b.new_context(**iphone)
    pg = ctx.new_page()
    pg.on("response", lambda r: fails.append(f"{r.status} {r.url}"))
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(4000)
    # 새로운 모험 클릭
    try:
        pg.locator("text=새로운 모험").first.click(timeout=3000)
    except Exception:
        pg.touchscreen.tap(360, 428)
    pg.wait_for_timeout(6000)
    pg.screenshot(path="/home/z/my-project/scripts/verify-mobile.png")
    # 스킬 아이콘 img 요소 확인
    icons = pg.eval_on_selector_all(
        "img[src*='skillicon']",
        "els => els.map(e => ({src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0}))",
    )
    print("SKILLICON_IMGS:", icons)
    print("FAILED_REQS(404/500):")
    for f in [x for x in fails if " 404" in x or " 500" in x][:12]:
        print(" ", f)
    b.close()
