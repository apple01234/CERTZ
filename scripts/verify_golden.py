#!/usr/bin/env python
"""골든 패스 검증 — 새로운 모험 클릭 → 게임 진입 확인"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)[:150]))
    pg.goto("http://localhost:3000/", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(4000)

    # 새로운 모험 버튼은 Phaser 캔버스 안 — 화면 중앙 클릭
    btn = pg.locator("text=새로운 모험").first
    if btn.count() > 0:
        btn.click()
        print("BUTTON: DOM 버튼 클릭됨")
    else:
        pg.mouse.click(640, 428)  # 캔버스 좌표 클릭
        print("BUTTON: 캔버스 좌표 클릭 (640,428)")
    pg.wait_for_timeout(5000)
    pg.screenshot(path="/home/z/my-project/scripts/verify-ingame.png")
    print("PAGE_ERRORS:", len(errors), errors[:3])
    b.close()
