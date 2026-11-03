import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  readSlots,
  writeSlots,
  legacyArchive,
  putCharacter,
} from "../../src/game/campaign/storage.ts";
import { newCampaign } from "../../src/game/campaign/progress.ts";
import { createDefense, stepDefense } from "../../src/game/campaign/defense.ts";
import {
  allowedCampaignAsset,
  pruneCampaignAssets,
} from "../../campaign-assets.mjs";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
function storage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, String(v)),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}
test("legacy saves remain byte-identical and corrupt new saves recover from backup", () => {
  const s = storage(),
    bytes = ' {"stage":"forest1", "lv":99} ';
  s.setItem("sertz_save_v2", bytes);
  const p = newCampaign("새증인", "mage", "test0088"),
    slots = putCharacter(p, readSlots(s));
  writeSlots(slots, s);
  writeSlots({ ...slots, characters: [{ ...p, coins: 60 }] }, s);
  s.setItem(STORAGE_KEY, "damaged");
  assert.equal(readSlots(s).characters[0].coins, 0);
  assert.equal(legacyArchive(s).entries.sertz_save_v2, bytes);
  writeSlots(slots, s);
  assert.equal(s.getItem(`${STORAGE_KEY}:unreadable`), "damaged");
  assert.equal(s.getItem("sertz_save_v2"), bytes);
});
test("protection objectives are finite and actively defendable, not endless hunt quotas", () => {
  const d = createDefense("피난민", { x: 500, y: 400 });
  for (let i = 0; i < 260; i++)
    stepDefense(d, { x: 500, y: 400 }, true, 1000 / 30);
  assert.equal(d.status, "won");
  assert.ok(d.kills >= 3);
  assert.equal(d.integrity, 100);
});
test("build whitelist removes old art while preserving unified licensed assets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "oath-assets-"));
  try {
    await mkdir(path.join(root, "tiles"));
    await mkdir(path.join(root, "campaign"));
    await mkdir(path.join(root, "campaign/drive"));
    for (const f of [
      "hero_old.png",
      "tiles/kenney_tinytown.png",
      "tiles/kenney_tinydungeon.png",
      "campaign/skill-sunburst.png",
      "campaign/drive/knight.png",
    ])
      await writeFile(path.join(root, f), "fixture");
    await pruneCampaignAssets(root);
    await assert.rejects(access(path.join(root, "hero_old.png")));
    await assert.rejects(access(path.join(root, "tiles/kenney_tinytown.png")));
    await assert.rejects(access(path.join(root, "tiles/kenney_tinydungeon.png")));
    assert.equal(
      await readFile(path.join(root, "campaign/skill-sunburst.png"), "utf8"),
      "fixture",
    );
    assert.equal(allowedCampaignAsset("hero_old.png"), false);
    assert.equal(await readFile(path.join(root, "campaign/drive/knight.png"), "utf8"), "fixture");
  } finally {
    await rm(root, { recursive: true });
  }
});
