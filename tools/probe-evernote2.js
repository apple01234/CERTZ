/** tools/probe-evernote2.js — Evernote 공유 노트 접근성 재시도 프로브
 *  노트별 최대 3회 재시도, 에디터 영역이 뜰 때까지 대기. 결과를 JSON 으로 저장.
 *  사용: node tools/probe-evernote2.js <outDir>
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
https://share.evernote.com/note/08d68b2c-5db1-cf58-8fee-dc50ea66d0b3`.split("\n").map((s) => s.trim()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const outDir = process.argv[2] || "/tmp/evernote";
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const out = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    for (let i = 0; i < URLS.length; i++) {
      const url = URLS[i];
      const rec = { idx: i + 1, url, title: "", len: 0, wall: false, attempts: 0, err: null, text: "" };
      for (let a = 0; a < 3; a++) {
        rec.attempts = a + 1;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          // 에디터/본문이 뜰 때까지 최대 12초 폴링
          let got = null;
          for (let t = 0; t < 12; t++) {
            await sleep(1000);
            got = await page.evaluate(() => {
              const wall = /Sign in\s*to continue your Evernote|hCaptcha/i.test(document.body.innerText || "");
              const sels = ['[contenteditable="true"]', ".en-note", "#en-note", "article"];
              let best = "";
              for (const s of sels) {
                const el = document.querySelector(s);
                if (el && el.innerText && el.innerText.length > best.length) best = el.innerText;
              }
              return { text: best, title: document.title || "", wall };
            });
            if (got.text && got.text.length > 200) break;
            if (got.wall) break;
          }
          rec.title = got.title;
          rec.text = got.text || "";
          rec.len = rec.text.length;
          rec.wall = !!got.wall;
          if (rec.len > 200) break; // 성공
        } catch (e) {
          rec.err = String(e && e.message ? e.message : e).slice(0, 160);
        }
        await sleep(1500);
      }
      out.push(rec);
      console.log(`#${rec.idx} len=${rec.len} wall=${rec.wall} tries=${rec.attempts} title=${rec.title.slice(0, 34)}`);
    }
  } finally {
    await browser.close();
  }
  const p = path.join(outDir, "evernote2.json");
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  const ok = out.filter((r) => r.len > 200).length;
  console.log(`\n==> ${p}  success=${ok}/${out.length}`);
})();
