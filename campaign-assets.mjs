/** Strip unused legacy art only from build outputs, never from source or saves. */
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function allowedCampaignAsset(name) {
  return (
    name === "tiles/kenney_tinydungeon.png" ||
    name === "tiles/kenney_tinytown.png" ||
    name.startsWith("campaign/")
  );
}
export async function pruneCampaignAssets(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true, recursive: true });
  } catch (e) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name),
      relative = path.relative(root, file).split(path.sep).join("/");
    if (!allowedCampaignAsset(relative)) await rm(file);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const output of [
    ".next/standalone/public/assets",
    ".next-apk/assets",
    "out/assets",
  ]) {
    await pruneCampaignAssets(path.resolve(output));
    for (const sibling of [
      "assets3d",
      "assets3d_vfx",
      "fxall.html",
      "fxtest.html",
      "perfbench.html",
    ])
      await rm(path.resolve(path.dirname(output), sibling), {
        recursive: true,
        force: true,
      });
  }
  console.log("Campaign asset whitelist applied to build outputs.");
}
