#!/usr/bin/env python
"""실패한 리소스 URL 캡처"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("response", lambda r: print(f"{r.status} {r.url[:120]}") if r.status >= 400 else None)
    pg.goto("http://localhost:3000/", wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(3000)
    b.close()
