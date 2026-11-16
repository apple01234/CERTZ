import manifest from "../../public/assets/startup-bundle/manifest.json" with { type: "json" };
type Entry = { package: number; offset: number; length: number; type: string };
const entries = manifest.images as Record<string, Entry>;

/** Only requested packages are fetched; release decoded bytes at the end of each load gate. */
export class StartupBundle {
  private enabled = true;
  private data = new Map<number, { promise: Promise<ArrayBuffer | null>; abort: AbortController; bytes: number }>();
  private remaining?: Map<number, Set<string>>;
  private consumed = new Set<number>();
  begin(urls: string[]): void {
    this.enabled = true; this.consumed.clear(); this.remaining = new Map();
    for (const url of urls) {
      const key = url.startsWith("/") ? url.slice(1) : url, entry = entries[key];
      if (!entry) continue;
      if (!this.remaining.has(entry.package)) this.remaining.set(entry.package, new Set());
      this.remaining.get(entry.package)!.add(key);
    }
  }
  get retainedBytes(): number { return [...this.data.values()].reduce((n, p) => n + p.bytes, 0); }
  release(): void {
    this.enabled = false;
    for (const p of this.data.values()) p.abort.abort();
    this.data.clear();
    this.remaining = undefined;
  }
  async image(url: string): Promise<string | null> {
    const key = url.startsWith("/") ? url.slice(1) : url, entry = entries[key];
    if (!this.enabled || !entry || this.consumed.has(entry.package) || typeof DecompressionStream === "undefined") return null;
    let pending = this.data.get(entry.package);
    if (!pending) {
      const pkg = manifest.packages[entry.package], abort = new AbortController();
      const record = { abort, bytes: 0, promise: Promise.resolve(null) as Promise<ArrayBuffer | null> };
      const timer = setTimeout(() => abort.abort(), 6000);
      record.promise = fetch(pkg.url, { signal: abort.signal }).then(async response => {
        if (!response.ok || !response.body) return null;
        const bytes = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
        if (abort.signal.aborted || bytes.byteLength !== pkg.decodedBytes) return null;
        record.bytes = bytes.byteLength;
        return bytes;
      }).catch(() => null).finally(() => clearTimeout(timer));
      this.data.set(entry.package, record); pending = record;
    }
    const data = await pending.promise;
    if (!data || pending.abort.signal.aborted) return null;
    const image = URL.createObjectURL(new Blob([data.slice(entry.offset, entry.offset + entry.length)], { type: entry.type }));
    const needed = this.remaining?.get(entry.package);
    if (needed) {
      needed.delete(key);
      if (!needed.size) { pending.bytes = 0; this.data.delete(entry.package); this.consumed.add(entry.package); }
    }
    return image;
  }
}
