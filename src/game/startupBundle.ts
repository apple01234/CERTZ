import manifest from "../../public/assets/startup-bundle/manifest.json" with { type: "json" };
type Entry = { offset: number; length: number; type: string };
const entries = manifest.images as Record<string, Entry>;

/** One measured shared package per game; old browsers and failed bundles use the original files. */
export class StartupBundle {
  private data?: Promise<ArrayBuffer | null>;
  async image(url: string): Promise<string | null> {
    const entry = entries[url.startsWith("/") ? url.slice(1) : url];
    if (!entry || typeof DecompressionStream === "undefined") return null;
    this.data ??= fetch(manifest.url).then(async response => {
      if (!response.ok || !response.body) return null;
      const body = response.body.pipeThrough(new DecompressionStream("gzip"));
      const bytes = await new Response(body).arrayBuffer();
      if (bytes.byteLength !== manifest.decodedBytes) return null;
      return bytes;
    }).catch(() => null);
    const data = await this.data;
    return data ? URL.createObjectURL(new Blob([data.slice(entry.offset, entry.offset + entry.length)], { type: entry.type })) : null;
  }
}
