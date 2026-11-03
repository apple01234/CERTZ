import {
  bgmGain,
  SFX_VOLUMES,
  SFX_THROTTLE_MS,
  SFX_MAX_CONCURRENT,
} from "../audio";
import type { Theme } from "./catalog";

/** Use the supplied recordings and existing mix limits; stream one track at a time. */
export class OathAudio {
  private bgm: HTMLAudioElement | null = null;
  private effects = new Set<HTMLAudioElement>();
  private track = "bgm_village_forest";
  private volume = 0.12;
  private playing = false;
  private lastEffect = -Infinity;
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(0.3, value));
    if (this.bgm)
      this.bgm.volume = Math.min(1, this.volume * bgmGain(this.track));
  }
  setScene(theme: Theme, combat: boolean) {
    const track = combat
      ? "bgm_forest_boss"
      : theme === "snow"
        ? "bgm_niflheim_1"
        : ["ruin", "machine", "volcano"].includes(theme)
          ? "bgm_cave_1"
          : theme === "astral"
            ? "bgm_alfheim_1"
            : ["garden", "forest", "desert"].includes(theme)
              ? "bgm_forest_1"
              : "bgm_village_forest";
    if (track === this.track) return;
    this.track = track;
    if (this.bgm) {
      this.bgm.src = `/assets/audio/${track}.ogg`;
      this.setVolume(this.volume);
      if (this.playing) void this.bgm.play().catch(() => {});
    }
  }
  async start() {
    this.playing = true;
    if (!this.bgm) {
      this.bgm = new Audio(`/assets/audio/${this.track}.ogg`);
      this.bgm.loop = true;
      this.setVolume(this.volume);
    }
    if (this.bgm.paused) await this.bgm.play();
  }
  chime() {
    const now = performance.now();
    if (
      !this.playing ||
      !this.volume ||
      now - this.lastEffect < SFX_THROTTLE_MS ||
      this.effects.size >= SFX_MAX_CONCURRENT
    )
      return;
    this.lastEffect = now;
    const sound = new Audio("/assets/audio/sfx_quest.ogg");
    sound.volume = Math.min(1, this.volume * SFX_VOLUMES.sfx_quest * 2);
    this.effects.add(sound);
    const clear = () => {
      this.effects.delete(sound);
      sound.onended = null;
      sound.onerror = null;
      sound.removeAttribute("src");
      sound.load();
    };
    sound.onended = clear;
    sound.onerror = clear;
    void sound.play().catch(clear);
  }
  suspend() {
    this.playing = false;
    this.bgm?.pause();
    for (const sound of this.effects) {
      sound.onended = null;
      sound.onerror = null;
      sound.pause();
      sound.removeAttribute("src");
      sound.load();
    }
    this.effects.clear();
  }
  dispose() {
    this.suspend();
    this.bgm?.removeAttribute("src");
    this.bgm?.load();
    this.bgm = null;
  }
}
