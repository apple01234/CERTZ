type Clock = { delayedCall: (ms: number, callback: () => void) => unknown };

/** Follow actual attacks, including callbacks scheduled by another impact. */
export class UltimateSequence {
  phase: "startup" | "active" | "recovery" | "idle" = "startup";
  private pending = 0;
  private finale: (() => void) | null = null;

  private clock: Clock;
  private alive: () => boolean;
  constructor(clock: Clock, alive: () => boolean) { this.clock = clock; this.alive = alive; }

  after = (ms: number, callback: () => void): ReturnType<Clock["delayedCall"]> => {
    this.pending++;
    return this.clock.delayedCall(ms, () => {
      try {
        if (!this.alive()) return;
        this.phase = "active";
        callback();
      } finally {
        this.pending--;
        this.finish();
      }
    });
  };

  complete(callback: () => void): void {
    this.finale = callback;
    this.finish();
  }

  private finish(): void {
    if (this.pending || !this.finale) return;
    const callback = this.finale;
    this.finale = null;
    if (!this.alive()) { this.phase = "idle"; return; }
    this.phase = "recovery";
    callback();
    this.clock.delayedCall(700, () => { this.phase = "idle"; });
  }
}
