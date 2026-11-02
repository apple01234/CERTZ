/**
 * pixelfx 전투 연출 매니저 (v1.0.0) — "극한 사용" 통합 레이어
 *
 * 목적
 * ----
 * pixelfx 시트(266종)를 게임 이벤트에 **의미 있게** 매핑한다. 이펙트를 아무 데나 뿌리면
 * 화면이 시끄러워지고 성능이 죽는다. 그래서
 *   ① 이벤트(타격·스킬·사망·픽업·레벨업…)별로 **이펙트 1~2개**만 고른다
 *   ② 동시 재생 수를 상한으로 묶고(pool), 저사양/모바일에서는 자동으로 줄인다
 *   ③ 같은 이펙트가 0.05초 안에 중복 호출되면 무시한다(연타 폭주 방지)
 *
 * 성능
 * ----
 * 시트는 Phaser 아틀라스라 텍스처는 1장. 스프라이트만 풀에서 꺼내 재사용한다.
 * 풀이 비면 **그리지 않는다**(프레임 보호) — 새로 만들지 않는다.
 *
 * 사용
 * ----
 *   this.fx.play("hit.slash", x, y, { flip: dir < 0 });
 *   this.fx.element("fire");   // 원소별
 *   this.fx.rare("levelup", x, y);  // 큰 연출
 */
import Phaser from "phaser";
import { playFx, type PlayFxOpts } from "./pixelfxBridge";

export type FxEvent =
  | "hit.slash" | "hit.blunt" | "hit.ranged" | "hit.crit"
  | "elem.fire" | "elem.ice" | "elem.lightning" | "elem.holy"
  | "elem.shadow" | "elem.nature" | "elem.water" | "elem.arcane"
  | "death.normal" | "death.boss" | "spawn.enemy"
  | "pickup.gold" | "pickup.item" | "levelup" | "heal"
  | "ui.click" | "portal" | "shield" | "buff" | "debuff";

/** 이벤트 → pixelfx id 후보(랜덤 1개 선택). 실제 존재하는 시트만 로드돼 있다. */
const EVENT_FX: Record<FxEvent, string[]> = {
  "hit.slash":     ["melee/sword-slash", "melee/claw-swipe", "melee/spin-slash"],
  "hit.blunt":     ["impacts/blunt-hit", "melee/hammer-smash"],
  "hit.ranged":    ["impacts/bullet-impact", "impacts/hit-spark"],
  "hit.crit":      ["impacts/crit-hit", "impacts/impact-frame"],

  /* vc232 (#6 "속성 연계 이펙트 적절한 걸 골라서 써 (+과도하지 않게)")
   *  종전엔 원소마다 3종을 랜덤 선택했다. 연계가 연쇄되면 화면이 이펙트로 덮여
   *  전투 판독이 어려웠다(사용자 지적). 원소당 대표 1종만 남겨 "읽히는" 연출로 만든다. */
  "elem.fire":     ["fire/fireball"],
  "elem.ice":      ["ice/ice-spikes"],
  "elem.lightning": ["lightning/zap-hit"],
  "elem.holy":     ["holy/smite"],
  "elem.shadow":   ["shadow/shadow-flames"],
  "elem.nature":   ["nature/leaf-storm"],
  "elem.water":    ["water/splash"],
  "elem.arcane":   ["arcane/arcane-orb"],

  "death.normal":  ["spawn/shatter-death", "spawn/dissolve-burn", "spawn/poof"],
  "death.boss":    ["explosions/big-explosion", "explosions/implosion", "spawn/soul-rise"],
  "spawn.enemy":   ["spawn/spawn-portal", "arcane/blink-in", "spawn/summon-rise"],

  "pickup.gold":   ["pickups/coin-spin", "pickups/collect-burst"],
  "pickup.item":   ["pickups/gem-spin", "pickups/crystal-shard"],
  "levelup":       ["ui/level-up", "holy/resurrection", "holy/sunburst"],
  "heal":          ["holy/heal", "nature/healing-bloom"],

  "ui.click":      ["ui/quest-complete"],
  "portal":        ["arcane/portal", "transitions/pixel-dissolve"],
  "shield":        ["holy/divine-shield", "impacts/shield-block"],
  "buff":          ["status/haste", "status/rage"],
  "debuff":        ["status/poisoned", "status/frozen", "status/bleeding"],
};

/** 보스 전용 — 패턴·페이즈 연출에 쓴다(가장 큰 이펙트) */
export type BossFxEvent =
  | "boss.intro" | "boss.phase" | "boss.pattern" | "boss.charge"
  | "boss.enrage" | "boss.death" | "boss.summon" | "boss.telegraph";

const BOSS_FX: Record<BossFxEvent, string[]> = {
  "boss.intro":     ["explosions/nuke", "shadow/eclipse", "holy/sunburst"],
  "boss.phase":     ["explosions/plasma-explosion", "arcane/time-stop", "lightning/storm-cloud"],
  "boss.pattern":   ["explosions/dirt-explosion", "impacts/ground-slam", "melee/heavy-cleave"],
  "boss.charge":    ["lightning/charge-up", "arcane/spell-charge"],
  "boss.enrage":    ["shadow/black-hole", "fire/fire-tornado", "lightning/ball-lightning"],
  "boss.death":     ["explosions/big-explosion", "spawn/soul-rise", "explosions/implosion"],
  "boss.summon":    ["shadow/necro-skulls", "spawn/summon-rise"],
  "boss.telegraph": ["impacts/hit-flash", "arcane/rune-circle"],
};

/** 게임 ElemKey → pixelfx 이벤트. data.ts 의 ElemKey 9종 + 한글 별칭. */
const ELEMENT_EVENT: Record<string, FxEvent> = {
  /* 게임 표준 키 (data.ts ElemKey) */
  fire: "elem.fire", water: "elem.water", wind: "elem.nature",
  electric: "elem.lightning", earth: "elem.nature", nature: "elem.nature",
  ice: "elem.ice", light: "elem.holy", dark: "elem.shadow",
  /* 한글 별칭 */
  불: "elem.fire", 물: "elem.water", 바람: "elem.nature",
  전기: "elem.lightning", 대지: "elem.nature", 자연: "elem.nature",
  얼음: "elem.ice", 빛: "elem.holy", 어둠: "elem.shadow",
  /* pixelfx 명칭 별칭 */
  lightning: "elem.lightning", holy: "elem.holy", shadow: "elem.shadow",
  arcane: "elem.arcane", 마법: "elem.arcane", 번개: "elem.lightning",
};

const THROTTLE_MS = 50;

export class PixelFxManager {
  private scene: Phaser.Scene;
  private lastAt = new Map<string, number>();
  /** 현재 살아 있는 이펙트 스프라이트 (상한 관리) */
  private live = new Set<Phaser.GameObjects.Sprite>();
  /** 저사양/모바일이면 이벤트당 후보를 1개만, 동시 재생 상한을 낮춘다 */
  private lowEnd = false;
  private maxLive = 14;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      this.lowEnd = isMobile;
      this.maxLive = isMobile ? 7 : 14;
    } catch { /* SSR/노드 무시 */ }
    /* 로드된 시트가 하나도 없으면 비활성 (미설치 환경 보호) */
    if (!this.hasAnySheet()) this.lowEnd = true;
  }

  private hasAnySheet(): boolean {
    try {
      return this.scene.textures.exists("torch") || this.scene.textures.exists("frost-nova");
    } catch { return false; }
  }

  /** 로드된 시트만 남긴 실제 후보 목록 */
  private candidates(ev: FxEvent): string[] {
    const all = EVENT_FX[ev] ?? [];
    const have = all.filter((k) => this.scene.textures.exists(k.replace(/\//g, "-")) || this.scene.textures.exists(k));
    if (have.length) return this.lowEnd ? have.slice(0, 1) : have;
    /* vc232 (#16 "몬스터가 죽을 때마다 얼음장판") — 여기가 원인이었다.
     *  후보가 없을 때 `frost-nova` 로 떨어졌는데, 사망 이펙트(death.normal)가
     *  아직 로드되지 않은 프레임에서는 **모든 몬스터 사망이 얼음장판**으로 보였다.
     *  이제 "무연출"을 기본으로 둔다 — 엉뚱한 이펙트보다 안 나오는 게 낫다. */
    return [];
  }

  /** 이벤트 재생. 중복·상한·스로틀을 모두 통과해야 실제로 그린다. */
  play(ev: FxEvent, x: number, y: number, opts: PlayFxOpts = {}): void {
    const now = this.scene.time.now;
    const last = this.lastAt.get(ev) ?? 0;
    if (now - last < THROTTLE_MS) return;

    if (this.live.size >= this.maxLive) {
      /* 풀 포화 — 가장 오래된 것 제거 후 재생 (새로 만들지 않는다) */
      const oldest = this.live.values().next().value as Phaser.GameObjects.Sprite | undefined;
      if (oldest) { try { oldest.destroy(); } catch { /* 무시 */ } this.live.delete(oldest); }
      else return;
    }

    const cands = this.candidates(ev);
    if (!cands.length) return;
    const key = Phaser.Utils.Array.GetRandom(cands);

    let sp: Phaser.GameObjects.Sprite | null = null;
    try {
      sp = playFx(this.scene, key, x, y, {
        ...opts,
        onComplete: () => { if (sp) this.live.delete(sp); opts.onComplete?.(); },
      });
    } catch { /* 연출 실패는 게임을 막지 않는다 */ }

    if (sp) {
      this.lastAt.set(ev, now);
      this.live.add(sp);
    }
  }

  /** 원소 이름으로 재생 (한글/영문 모두 허용) */
  element(elem: string, x: number, y: number, opts: PlayFxOpts = {}): void {
    const ev = ELEMENT_EVENT[elem] ?? ELEMENT_EVENT[elem.toLowerCase()];
    if (ev) this.play(ev, x, y, opts);
  }

  /** 보스 연출 — 페이즈·패턴·사망 등. 일반 이벤트보다 크게, 상한도2배 허용 */
  boss(ev: BossFxEvent, x: number, y: number, opts: PlayFxOpts = {}): void {
    const now = this.scene.time.now;
    const last = this.lastAt.get(ev) ?? 0;
    if (now - last < 120) return;          // 보스 연출은 길게 유지

    if (this.live.size >= this.maxLive + 3) {
      const oldest = this.live.values().next().value as Phaser.GameObjects.Sprite | undefined;
      if (oldest) { try { oldest.destroy(); } catch { /* 무시 */ } this.live.delete(oldest); }
      else return;
    }
    const all = BOSS_FX[ev] ?? [];
    const have = all.filter((k) => this.scene.textures.exists(k));
    if (!have.length) return;
    const key = Phaser.Utils.Array.GetRandom(have);

    let sp: Phaser.GameObjects.Sprite | null = null;
    try {
      sp = playFx(this.scene, key, x, y, {
        ...opts,
        depth: opts.depth ?? 9200,
        onComplete: () => { if (sp) this.live.delete(sp); opts.onComplete?.(); },
      });
    } catch { /* 무시 */ }
    if (sp) { this.lastAt.set(ev, now); this.live.add(sp); }
  }

  /** 화면 흔들림 + 이펙트 (보스·크리티컬용). 보스 이벤트도 받는다. */
  impact(ev: FxEvent | BossFxEvent, x: number, y: number, shake = 0.004, opts: PlayFxOpts = {}): void {
    if (ev.startsWith("boss.")) this.boss(ev as BossFxEvent, x, y, opts);
    else this.play(ev as FxEvent, x, y, opts);
    try { this.scene.cameras.main.shake(90, shake); } catch { /* 무시 */ }
  }

  /** 씬 정리 — 남은 스프라이트 회수 */
  destroy(): void {
    for (const s of this.live) { try { s.destroy(); } catch { /* 무시 */ } }
    this.live.clear();
    this.lastAt.clear();
  }

  /** 디버그: 현재 살아 있는 이펙트 수 */
  get liveCount(): number { return this.live.size; }
}
