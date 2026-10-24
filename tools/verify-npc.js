// 마을에서 씹덕 NPC 6종이 실제로 로드·배치되는지 확인
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // 게임 부팅 + 마을 진입 (세이브가 마을이면 바로 뜬다)
  await page.goto("http://127.0.0.1:3200/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(14000);

  const info = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const out = { canvas: !!canvas, w: canvas?.width, h: canvas?.height };
    // Phaser 인스턴스를 찾아 텍스처 존재 여부 확인
    try {
      const g = window.__PHASER_GAME__ || window.Phaser?.GAMES?.[0] || (window.game && window.game.textures ? window.game : null);
      out.phaserFound = !!g;
      const scene = g?.scene?.getScene?.("WorldScene");
      out.sceneKeys = g?.scene?.getScenes?.()?.map?.((s) => s.sys?.settings?.key) ?? [];
      if (g?.textures) {
        const need = ["npc_guide_lily", "npc_scholar_mio", "npc_mage_rin", "npc_merchant_nyan", "npc_witch_nyx", "npc_fairy_aria"];
        out.tex = Object.fromEntries(need.map((k) => [k, g.textures.exists(k)]));
        out.texSize = Object.fromEntries(need.map((k) => {
          const t = g.textures.get(k);
          const s = t && t.getSourceImage ? t.getSourceImage() : null;
          return [k, s ? `${s.width}x${s.height}` : "?"];
        }));
      }
      // 마을에 배치된 이미지 수 (텍스처 키가 npc_로 시작)
      if (scene) {
        const kids = scene.children?.list ?? [];
        out.npcImages = kids.filter((o) => typeof o.texture?.key === "string" && o.texture.key.startsWith("npc_")).length;
        out.npcKeys = [...new Set(kids.filter((o) => typeof o.texture?.key === "string" && o.texture.key.startsWith("npc_")).map((o) => o.texture.key))];
      }
    } catch (e) { out.err = String(e); }
    return out;
  });

  console.log(JSON.stringify(info, null, 2));
  if (errors.length) console.log("ERRORS:", errors.slice(0, 6));
  await browser.close();
})();
