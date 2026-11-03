/** Compatibility entry point: dynamic RPG loaders require complete runtime packs. */
import { fileURLToPath } from "node:url";
export function allowedCampaignAsset() {
  return true;
}
export async function pruneCampaignAssets() {
  // Retained API: older build/test callers may still invoke this function.
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Original runtime asset packs preserved in build outputs.");
}
