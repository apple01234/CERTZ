#!/usr/bin/env python
"""v3.0.27 최종 검증 — 배지, 스킬 아이콘, 새 SFX 27종 로딩"""
from playwright.sync_api import sync_playwright

sfx_reqs, fails = [], []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 740, "height": 360}, has_touch=True, is_mobile=True,
                        user_agent="Mozilla/5.0 (Linux; Android 11) Chrome/120 Mobile Safari/537.36")
    pg = ctx.new_page()
    pg.on("response", lambda r: (sfx_reqs.append(f"{r.status} {r.url.split('/')[-1]}")
                                 if "skl_" in r.url else (fails.append(f"{r.status} {r.url}") if r.status >= 400 else None)))
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(7000)  # 리소스 프리로드 대기
    pg.screenshot(path="/home/z/my-project/scripts/verify-v327-title.png")
    try:
        pg.locator("text=새로운 모험").first.click(timeout=3000)
    except Exception:
        pg.touchscreen.tap(370, 214)
    pg.wait_for_timeout(5000)
    try:
        pg.locator("button[aria-label='퀘스트 로그 닫기'], button:has-text('✕')").first.click(timeout=2000)
    except Exception:
        pg.touchscreen.tap(531, 60)
    pg.wait_for_timeout(2000)
    pg.screenshot(path="/home/z/my-project/scripts/verify-v327-game.png")
    icons = pg.eval_on_selector_all("img[src*='skillicon']", "els => els.map(e => ({src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0}))")
    print("SKILLICON:", icons)
    print(f"SFX 요청: {len(sfx_reqs)}건 중 200 아닌 것:", [r for r in sfx_reqs if not r.startswith("200")][:5] or "없음 (전부 200)")
    print("FAILED(>=400):", fails[:8] or "없음")
    b.close()
