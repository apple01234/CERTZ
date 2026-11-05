/**
 * vc251 진단 — `http://127.0.0.1` 오리진에서 `Secure` 쿠키가 저장되는가?
 *
 * [왜 이걸 직접 재는가]
 *  현대 Chromium 은 `localhost` 뿐 아니라 **`127.0.0.1` 도 "potentially trustworthy origin"**
 *  으로 취급한다. 그렇다면 Secure 쿠키도 저장되므로 "Secure 때문에 PC 로그인이 안 된다"는
 *  가설이 틀린 것이 된다. 추측을 확정으로 바꾸려면 저장소를 직접 봐야 한다.
 *
 * [방법] 로컬 http 서버가 Secure 쿠키를 내려주고, Playwright(Chromium)가 저장하는지 확인.
 *  localhost / 127.0.0.1 / 일반 http 호스트(외부 IP) 3가지를 비교한다.
 */
import http from "node:http";
import { chromium } from "playwright";

/* 로컬 서버 — Secure 쿠키와 비-Secure 쿠키를 동시에 내려준다 */
const server = http.createServer((req, res) => {
  if (req.url === "/set") {
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Set-Cookie": [
        "sec_test=1; Path=/; Secure; SameSite=Lax",
        "nosec_test=1; Path=/; SameSite=Lax",
      ],
    });
    res.end("<html><body>ok</body></html>");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<html><body>ok</body></html>");
});
await new Promise((r) => server.listen(0, "0.0.0.0", r));
const PORT = server.address().port;

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });

async function probe(origin, label) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${origin}/set`, { waitUntil: "domcontentloaded", timeout: 8000 });
  } catch (e) {
    console.log(`${label}: 접속 실패 (${String(e.message).slice(0, 50)})`);
    await ctx.close();
    return;
  }
  const cookies = await ctx.cookies();
  const sec = cookies.find((c) => c.name === "sec_test");
  const nosec = cookies.find((c) => c.name === "nosec_test");
  console.log(
    `${label.padEnd(22)} Secure쿠키: ${sec ? "저장됨 ✓" : "거부됨 ✗"} | 일반쿠키: ${nosec ? "저장됨 ✓" : "거부됨 ✗"}`
  );
  await ctx.close();
}

await probe(`http://127.0.0.1:${PORT}`, "http://127.0.0.1");
await probe(`http://localhost:${PORT}`, "http://localhost");

/* 호스트명으로도 확인 — 127.0.0.1 과 동작이 같은지 */
await probe(`http://[::1]:${PORT}`, "http://[::1]");

await browser.close();
server.close();
