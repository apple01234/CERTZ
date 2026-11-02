/** Original quiet score, synthesized with browser primitives; no unlicensed recordings. */
export class OathAudio {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private act = 1;
  private volume = 0.12;
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(0.3, v));
  }
  setAct(act: number) {
    this.act = act;
  }
  private tone(
    frequency: number,
    when: number,
    duration: number,
    gain: number,
  ) {
    const c = this.context;
    if (!c || !this.volume) return;
    const osc = c.createOscillator(),
      env = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain * this.volume, when + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(env);
    env.connect(c.destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }
  async start() {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (this.timer) return;
    this.timer = setInterval(() => {
      const c = this.context;
      if (!c || c.state !== "running") return;
      const melody =
        this.act === 1
          ? [0, 7, 10, 7, 3, 7, 5, 2]
          : this.act === 2
            ? [0, 3, 7, 10, 12, 10, 7, 3]
            : [0, 5, 7, 10, 7, 5, 3, 0];
      const n = melody[this.step % melody.length];
      this.tone(220 * 2 ** (n / 12), c.currentTime, 0.9, 0.35);
      if (this.step % 4 === 0)
        this.tone(
          110 * 2 ** ((this.step % 8 === 0 ? 0 : 5) / 12),
          c.currentTime,
          2.8,
          0.3,
        );
      this.step++;
    }, 800);
  }
  chime() {
    const c = this.context;
    if (!c) return;
    [0, 4, 7].forEach((n, i) =>
      this.tone(440 * 2 ** (n / 12), c.currentTime + i * 0.08, 0.45, 0.45),
    );
  }
  suspend() {
    void this.context?.suspend();
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
  }
}
