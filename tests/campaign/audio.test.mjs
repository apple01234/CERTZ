import { test } from "node:test";
import assert from "node:assert/strict";
import { OathAudio } from "../../src/game/campaign/audio.ts";

test("music switches reuse one stream, feedback is throttled, hidden/dispose stop every voice", async () => {
  const original = globalThis.Audio;
  const voices = [];
  globalThis.Audio = class {
    paused = true;
    constructor(src) {
      this.src = src;
      voices.push(this);
    }
    async play() {
      this.paused = false;
    }
    pause() {
      this.paused = true;
    }
    load() {}
    removeAttribute() {
      this.src = "";
    }
  };
  const sound = new OathAudio();
  try {
    await sound.start();
    sound.setScene("snow", false);
    sound.setScene("snow", true);
    assert.equal(voices.length, 1);
    assert.match(voices[0].src, /bgm_forest_boss\.ogg$/);
    sound.chime();
    sound.chime();
    assert.equal(voices.length, 2);
    sound.suspend();
    assert.ok(voices.every((v) => v.paused));
    assert.equal(voices[1].src, "");
    sound.dispose();
    assert.equal(voices[0].src, "");
  } finally {
    sound.dispose();
    globalThis.Audio = original;
  }
});
