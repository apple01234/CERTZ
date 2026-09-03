#!/usr/bin/env python
"""가로 모바일 에뮬레이션 — TouchControls 스킬 아이콘 렌더 확인"""
from playwright.sync_api import sync_playwright

fails = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 740, "height": 360},
        has_touch=True,
        is_mobile=True,
        user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
    )
    pg = ctx.new_page()
    pg.on("response", lambda r: fails.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(4000)
    try:
        pg.locator("text=새로운 모험").first.click(timeout=3000)
    except Exception:
        pg.touchscreen.tap(370, 214)
    pg.wait_for_timeout(6000)
    pg.screenshot(path="/home/z/my-project/scripts/verify-mobile2.png")
    icons = pg.eval_on_selector_all(
        "img[src*='skillicon']",
        "els => els.map(e => ({src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0}))",
    )
    print("SKILLICON_IMGS:", icons)
    print("FAILED:", fails[:10])
    b.close()
