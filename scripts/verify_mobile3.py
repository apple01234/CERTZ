#!/usr/bin/env python
"""퀘스트창 닫고 TouchControls 스킬 아이콘 확인"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 740, "height": 360},
        has_touch=True,
        is_mobile=True,
        user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    )
    pg = ctx.new_page()
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(4000)
    try:
        pg.locator("text=새로운 모험").first.click(timeout=3000)
    except Exception:
        pg.touchscreen.tap(370, 214)
    pg.wait_for_timeout(5000)
    # 퀘스트창 X 클릭 (aria-label 또는 좌표)
    try:
        pg.locator("button[aria-label='퀘스트 로그 닫기'], button:has-text('✕')").first.click(timeout=2000)
    except Exception:
        pg.touchscreen.tap(531, 60)
    pg.wait_for_timeout(2000)
    pg.screenshot(path="/home/z/my-project/scripts/verify-mobile3.png")
    icons = pg.eval_on_selector_all(
        "img[src*='skillicon']",
        "els => els.map(e => ({src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0}))",
    )
    print("SKILLICON_IMGS:", icons)
    # TouchControls DOM 존재 여부
    tc = pg.eval_on_selector_all("button[aria-label]", "els => els.map(e => e.getAttribute('aria-label'))")
    print("BUTTONS:", tc[:15])
    b.close()
