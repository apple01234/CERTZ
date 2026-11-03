import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ignore from "ignore";
import { allowedCampaignAsset, pruneCampaignAssets } from "../../campaign-assets.mjs";

test("Vercel upload retains every original runtime pack and source-imported public metadata", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const rules = ignore().add(
    await readFile(path.join(root, ".vercelignore"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(
      path.join(root, "public/assets/campaign/drive/manifest.json"),
      "utf8",
    ),
  );
  const required = [
    ...Object.values(manifest.files).map(
      (art) => `public/assets/campaign/drive/${art.file}`,
    ),
    ...Object.values(manifest.projectFiles).map((art) => `public${art.url}`),
    ...Object.values(manifest.audioFiles).map((art) => `public${art.url}`),
  ];
  for (const pack of ["assets", "assets3d", "assets3d_vfx"]) {
    for (const entry of await readdir(path.join(root, "public", pack), { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) required.push(path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
    }
  }
  for (const entry of await readdir(path.join(root, "src"), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const source = path.join(entry.parentPath, entry.name);
    const text = await readFile(source, "utf8");
    for (const [, specifier] of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      if (!specifier.startsWith(".")) continue;
      const relative = path
        .relative(root, path.resolve(path.dirname(source), specifier))
        .split(path.sep)
        .join("/");
      if (relative.startsWith("public/")) required.push(relative);
    }
  }
  const excluded = [...new Set(required)].filter((file) => rules.ignores(file));
  assert.deepEqual(
    excluded,
    [],
    `Vercel excludes required files:\n${excluded.join("\n")}`,
  );
  for (const file of [
    "public/assets/npcbody/new-original-character.png",
    "public/assets/audio/new-original-track.ogg",
    "public/assets3d/new-original-model.glb",
    "public/assets3d_vfx/new-original-effect.glb",
  ])
    assert.equal(
      rules.ignores(file),
      false,
      `Runtime pack extensions must remain included: ${file}`,
    );
  for (const file of ["android/sertz-release.keystore", "db-backup/accounts.enc", "download/app.apk", ".next/cache/cache.bin"])
    assert.equal(rules.ignores(file), true, `Private/build output must stay excluded: ${file}`);
});

test("web, static and APK postbuild preserves complete asset bytes and sibling packs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sertz-pack-preservation-"));
  const fixtures = [];
  try {
    for (const output of [".next/standalone/public", ".next-apk", "out"]) {
      for (const relative of ["assets/hero_original.png", "assets/audio/combat.ogg", "assets/campaign/scene.png", "assets3d/model.glb", "assets3d_vfx/skill.glb"]) {
        const file = path.join(root, output, relative);
        const bytes = Buffer.from(`original ${output}/${relative}`);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes);
        fixtures.push({ file, bytes });
      }
      await pruneCampaignAssets(path.join(root, output, "assets"));
    }
    execFileSync(process.execPath, [fileURLToPath(new URL("../../campaign-assets.mjs", import.meta.url))], { cwd: root });
    for (const { file, bytes } of fixtures) assert.deepEqual(await readFile(file), bytes);
    assert.equal(allowedCampaignAsset("hero_original.png"), true);
    assert.equal(allowedCampaignAsset("audio/combat.ogg"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
