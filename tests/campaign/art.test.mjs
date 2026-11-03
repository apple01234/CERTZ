import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CHAPTERS } from "../../src/game/campaign/catalog.ts";

test("Drive art retains original bytes, native grids, provenance and every boss portrait", async () => {
  const root = new URL("../../public/assets/campaign/drive/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  assert.equal(manifest.license, "CC0-1.0");
  for (const chapter of CHAPTERS.filter((c) => c.boss))
    assert.ok(manifest.files[`boss-${chapter.id}`], chapter.id);
  for (const art of Object.values(manifest.files)) {
    assert.match(
      art.archivePath,
      /^CERTZ\/assets_dl\/extracted\/dungeoncrawl_32x32\//,
    );
    const bytes = await readFile(new URL(art.file, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), art.sha256);
    assert.equal(bytes.readUInt32BE(16), 32, art.file);
    assert.equal(bytes.readUInt32BE(20), 32, art.file);
  }
  for (const art of Object.values(manifest.projectFiles)) {
    const bytes = await readFile(
      new URL(`../../public${art.url}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), art.sha256);
    if (art.url.endsWith(".png")) {
      assert.equal(bytes.readUInt32BE(16), art.width);
      assert.equal(bytes.readUInt32BE(20), art.height);
    } else {
      assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
    }
  }
  for (const art of Object.values(manifest.audioFiles)) {
    const bytes = await readFile(
      new URL(`../../public${art.url}`, import.meta.url),
    );
    assert.equal(bytes.subarray(0, 4).toString(), "OggS");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), art.sha256);
  }
  assert.deepEqual(
    (await readdir(root)).sort(),
    [
      "LICENSE.txt",
      "README.txt",
      "manifest.json",
      ...Object.values(manifest.files).map((a) => a.file),
    ].sort(),
  );
});
