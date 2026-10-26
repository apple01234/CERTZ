/** tools/probe-evernote.js — Evernote 공유 노트 접근성/본문 수집 프로브
 *  사용: node tools/probe-evernote.js <outDir>
 *  각 노트를 실제 chromium 으로 열어 login wall 여부와 본문 텍스트를 JSON 으로 남긴다.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URLS = `https://share.evernote.com/note/e5498f40-0adf-378a-7b50-4100ca9aad79
https://share.evernote.com/note/c3e04891-5779-4d0c-bc6e-09a058efd852
https://share.evernote.com/note/146e86df-240b-44dc-8aa6-820aa1aba486
https://share.evernote.com/note/e5f489ab-66b3-6c29-5cf0-f20d6115bd72
https://share.evernote.com/note/41aebaf4-9032-c693-9cc5-da5d3e7f3df2
https://share.evernote.com/note/eb7c4467-8352-bc66-8250-0b19bab5294d
https://share.evernote.com/note/8a287115-b7ae-1f07-e4e4-6aab238230ca
https://share.evernote.com/note/19d8139f-3edb-44ba-b9e2-3da29f0c297c
https://share.evernote.com/note/b28f5405-ab57-b2e7-803f-cdaafc4d750a
https://share.evernote.com/note/c7752365-5f9c-41c6-bf83-7fb2954806d5
https://share.evernote.com/note/058386ee-a621-d1ef-a518-c34ae4cb44ed
https://share.evernote.com/note/b8373e02-ea5a-e37e-93ba-899ac8e7ef0c
https://share.evernote.com/note/fd8ab290-cee9-f4d0-3442-899840633549
https://share.evernote.com/note/078841d4-9ece-b6a5-9ebd-e74600a8e289
https://share.evernote.com/note/08d68b2c-5db1-cf58-8fee-dc50ea66d0b3
https://share.evernote.com/note/b8373e02-ea5a-e37e-93ba-899ac8e7ef0c`.split("\n").map((s) => s.trim()).filter(Boolean);

(async () => {
  const outDir = process.argv[2] || "/tmp/evernote";
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const out = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    for (let i = 0; i < URLS.length; i++) {
      const url = URLS[i];
      let rec = { idx: i + 1, url, title: "", len: 0, wall: false, err: null, text: "" };
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(3500);
        // 본문 후보: 에디터 영역 우선, 없으면 body
        const got = await page.evaluate(() => {
          const sels = ['[contenteditable="true"]', ".en-note", "article", "main", "#en-note", "body"];
          let best = "";
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.innerText && el.innerText.length > best.length) best = el.innerText;
          }
          return { text: best, title: document.title || "" };
        });
        rec.title = got.title;
        rec.text = got.text || "";
        rec.len = rec.text.length;
        rec.wall = /sign in|로그인|hCaptcha|Continue with Google/i.test(rec.text.slice(0, 400)) && rec.len < 3000;
      } catch (e) {
        rec.err = String(e && e.message ? e.message : e).slice(0, 200);
      }
      out.push(rec);
      console.log(`#${rec.idx} len=${rec.len} wall=${rec.wall} err=${rec.err || "-"} title=${rec.title.slice(0, 40)}`);
    }
  } finally {
    await browser.close();
  }
  const p = path.join(outDir, "evernote.json");
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  const open = out.filter((r) => r.len > 200 && !r.wall).length;
  console.log(`\n==> saved ${p}  open=${open}/${out.length}`);
})();
