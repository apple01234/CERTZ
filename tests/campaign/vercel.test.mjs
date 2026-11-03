import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ignore from "ignore";

test("Vercel upload retains selected game assets and source-imported public metadata", async () => {
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
    "public/assets/tiles/kenney_tinytown.png",
    "public/assets/npcbody/unused.png",
    "public/assets/audio/unused.ogg",
    "public/assets3d/unused.glb",
  ])
    assert.equal(
      rules.ignores(file),
      true,
      `Unused asset should stay excluded: ${file}`,
    );
});
