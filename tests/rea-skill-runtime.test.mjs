import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  WEAPON_MASTER_PROFILES, weaponMasterProfileOf, signatureZones, signatureZoneContains,
  startSignatureCast, STARTER_SIGNATURE, copiedReactionElement,
} from "../src/game/weaponMasterProfiles.ts";
import { CLASSES, SKILL_LABELS, chainOf, familyOf, resolveSkill1Of, resolveSkill2Of } from "../src/game/classes.ts";
import { FREE_DASH, freeDashDirection } from "../src/game/combat/freeDash.ts";
import { skillMasteryProgress, normalizeSkillMastery } from "../src/game/skillMastery.ts";

function clock() {
  let now = 0;
  const events = [];
  const schedule = (delay, callback) => {
    const event = { at: now + delay, callback, active: true };
    events.push(event);
    return () => { event.active = false; };
  };
  return {
    get now() { return now; }, schedule,
    advance(until) {
      while (true) {
        events.sort((a, b) => a.at - b.at);
        const event = events.find(event => event.active && event.at <= until);
        if (!event) break;
        event.active = false;
        now = event.at;
        event.callback();
      }
      now = until;
    },
    get pending() { return events.filter(event => event.active).length; },
  };
}

test("all ten original branches and upper tiers inherit the implemented teaching/label", () => {
  assert.equal(Object.keys(WEAPON_MASTER_PROFILES).length, 10);
  for (const cls of Object.values(CLASSES)) {
    const profile = weaponMasterProfileOf(cls.key);
    if (cls.tier === 1) { assert.equal(profile, null); continue; }
    assert.equal(profile, WEAPON_MASTER_PROFILES[chainOf(cls.key)[1].key]);
    assert.equal(SKILL_LABELS[cls.key][1], profile.name, `${cls.key} HUD describes the actual S1`);
  }
  assert.equal(weaponMasterProfileOf("bad-save"), null);
});

test("release happens after startup; repeated/return pulses claim a target only once and clean every timer", () => {
  const timer = clock(), phases = [], releases = [];
  let cleaned = 0;
  const target = {};
  const cast = startSignatureCast({ startup: 100, recovery: 90, pulses: [0, 140] }, {
    schedule: timer.schedule, valid: () => true,
    phase: phase => phases.push([timer.now, phase]),
    release: (pulse, claim) => releases.push([timer.now, pulse, claim(target), claim(target)]),
    cleanup: () => cleaned++,
  });
  timer.advance(99); assert.equal(cast.phase, "startup"); assert.equal(releases.length, 0);
  timer.advance(100); assert.deepEqual(releases, [[100, 0, true, false]]);
  timer.advance(240); assert.deepEqual(releases[1], [240, 1, false, false]);
  timer.advance(480); assert.equal(cast.phase, "recovery");
  timer.advance(570); assert.equal(cast.phase, "complete");
  cast.cancel(); timer.advance(9999);
  assert.equal(cleaned, 1); assert.equal(timer.pending, 0);
  assert.deepEqual(phases.map(p => p[1]), ["startup", "release", "release", "recovery", "complete"]);
});

test("invalid owner and manual cancellation prevent release and dispose once", () => {
  for (const manual of [false, true]) {
    const timer = clock(); let alive = true, hits = 0, cleaned = 0;
    const cast = startSignatureCast(WEAPON_MASTER_PROFILES.assassin, {
      schedule: timer.schedule, valid: () => alive, phase() {}, release: () => hits++, cleanup: () => cleaned++,
    });
    timer.advance(70);
    if (manual) cast.cancel(); else alive = false;
    timer.advance(9000);
    assert.equal(hits, 0); assert.equal(cast.phase, "cancelled"); assert.equal(cleaned, 1); assert.equal(timer.pending, 0);
  }
});

test("preview and hit geometry retain direction, range, size and distinct signatures", () => {
  const origin = { x: 0, y: 0 }, aim = { x: 1, y: 0 };
  const beam = signatureZones("lightning", origin, aim, 2)[0];
  assert.equal(signatureZoneContains(beam, { x: -1, y: 0 }), false);
  assert.equal(signatureZoneContains(beam, { x: 300, y: 25 }), true);
  assert.equal(signatureZoneContains(beam, { x: 400, y: 0 }), false);
  assert.equal(signatureZoneContains(beam, { x: 386, y: 0 }, 12), true, "large boss body counts at edge");
  assert.equal(signatureZoneContains(signatureZones("solar", origin, aim, 2)[0], { x: -80, y: 0 }), false);
  const vertical = signatureZones("lightning", origin, { x: 0, y: -1 }, 2)[0];
  assert.equal(signatureZoneContains(vertical, { x: 0, y: -200 }), true);
  assert.equal(signatureZoneContains(vertical, { x: 200, y: 0 }), false);
  const signatures = Object.values(WEAPON_MASTER_PROFILES).map(profile => JSON.stringify(profile.pulses.map((_, i) => signatureZones(profile.style, origin, aim, 2, i))));
  assert.equal(new Set(signatures).size, 10, "mechanical geometry/sequence differs, independent of tint");
  assert.equal(copiedReactionElement("water"), "electric");
  assert.equal(copiedReactionElement("dark"), "light");
});

// Execute the actual Player methods with engine ports replaced. No copied damage/dispatch implementation.
const playerSource = readFileSync(new URL("../src/game/entities/Player.ts", import.meta.url), "utf8");
const playerAst = ts.createSourceFile("Player.ts", playerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const playerClass = playerAst.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "Player");
const methods = new Set(["actionAllowed", "useSkill1", "useSignatureSkill", "cancelSkillCast", "useSkill2", "useFreeDash", "skillCastPhase", "skill1Name", "skill1Mastery", "attackElem"]);
const subjectSource = `class Subject { ${playerClass.members.filter(member => methods.has(member.name?.getText(playerAst))).map(member => member.getText(playerAst)).join("\n")} } return Subject;`;
class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
  clone() { return new Vector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const n = Math.hypot(this.x, this.y) || 1; this.x /= n; this.y /= n; return this; }
  angle() { return Math.atan2(this.y, this.x); }
}
const PhaserStub = { Math: { Vector2: Vector, Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } } };
class EffectStub {
  constructor(scene, profile, origin, aim) { this.scene = scene; this.profile = profile; scene.effects.push(this); this.origin = origin; this.aim = aim; }
  startup() { this.started = true; }
  release(pulse) { (this.releases ??= []).push(pulse); }
  clear() { this.cleared = true; }
}
const Subject = new Function("Phaser", "weaponMasterProfileOf", "STARTER_SIGNATURE", "copiedReactionElement", "ELEMENT_META", "WeaponMasterCombat", "startSignatureCast", "signatureZones", "signatureZoneContains", "audio", "resolveSkill1Of", "resolveSkill2Of", "familyOf", "FAMILY_ELEM", "sweptHitsTarget", "FREE_DASH", "freeDashDirection", "skillMasteryProgress", "notice", ts.transpile(subjectSource))(
  PhaserStub, weaponMasterProfileOf, STARTER_SIGNATURE, copiedReactionElement,
  Object.fromEntries(["none", "fire", "nature", "water", "electric", "light", "dark", "wind", "earth", "ice"].map(elem => [elem, { hex: 123 }])),
  EffectStub, startSignatureCast, signatureZones, signatureZoneContains, { sfx: { elemCast() {} } }, resolveSkill1Of, resolveSkill2Of, familyOf, { warrior: "fire", thief: "dark" }, () => false, FREE_DASH, freeDashDirection, skillMasteryProgress, () => {},
);
function player(cls = null) {
  const timer = clock(), hits = [], scene = {
    effects: [], targets: [], active: true,
    sys: { isActive: () => scene.active }, textures: { exists: () => false },
    currentMoveVec: () => new Vector(1, 0), getAllTargets: () => scene.targets,
    time: {
      get now() { return timer.now; },
      delayedCall(delay, callback) { const remove = timer.schedule(delay, callback); return { remove }; },
      addEvent() { return { remove() {} }; },
    },
    emitHud() {}, sfxSkill() {}, sfxCrit() {}, onMeleeConnect() {}, saveSoon() { scene.saveRequests = (scene.saveRequests ?? 0) + 1; },
    spawnBurstAt() {}, spawnDashDust() {}, spawnSlash() {}, spawnPickupText() {},
  };
  const p = Object.assign(new Subject(), {
    x: 0, y: 0, cls, active: true, state: "idle", hp: 100, maxHp: 200, mp: 60, maxMp: 60,
    sTier: chainOf(cls).length, tier: chainOf(cls).length, isFifth: false,
    skill1Cd: 0, skill1MaxEff: 3600, skill2Cd: 0, skill2MaxEff: 5400,
    scene, texture: { key: "hero_idle0" }, frame: { name: "__BASE" }, scaleX: 1, scaleY: 1, flipX: true,
    facing: new Vector(1, 0), dashDir: new Vector(), hitSet: new Set(), copiedElement: "none",
    signatureCast: null, signatureElement: null, skillMastery: {},
    aimDirFree() { return this.facing.clone().normalize(); }, aimDir() { return this.facing.clone(); },
    faceAtk(aim) { this.facing.copy(aim); }, setFlipX() {}, setVelocity() {}, setData() {},
    netEmitAction(action) { (this.actions ??= []).push(action); }, tutNotify() {}, tierFlair() {}, clsHex: () => 0xffffff,
    playAnim(key) { this.animation = key; }, tierLabels: () => SKILL_LABELS[cls] ?? null,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    rollDamage(multiplier, skill) { assert.equal(skill, true); return { dmg: multiplier * 100, crit: false }; },
  });
  const target = (x, y, elem = "water") => {
    const foe = { x, y, elem, active: true, hitW: 24, hitH: 24,
      takeDamage(dmg) { hits.push({ at: timer.now, foe, dmg, element: p.attackElem }); },
    };
    scene.targets.push(foe); return foe;
  };
  return { p, timer, scene, hits, target };
}

test("real Player S1 dispatch consumes the old MP/cooldown once, respects startup, and heals/buffs only on release", () => {
  for (const cls of [null, "warrior", ...Object.keys(WEAPON_MASTER_PROFILES), "arclord", "skylord"]) {
    const { p, timer, scene, target, hits } = player(cls);
    const profile = weaponMasterProfileOf(cls) ?? STARTER_SIGNATURE;
    const foe = target(profile.style === "book" ? 210 : 100, profile.style === "book" ? 40 : 0);
    target(1000, 1000);
    p.useSkill1(); p.useSkill1();
    assert.equal(p.mp, 45); assert.equal(p.skill1Cd, 3600);
    assert.deepEqual(p.actions, ["s1"]); assert.equal(p.skillCastPhase, "startup");
    assert.equal(scene.effects[0].started, true);
    assert.equal(p.hp, 100); assert.equal(hits.length, 0);
    timer.advance(profile.startup - 1); assert.equal(hits.length, 0);
    timer.advance(profile.startup); assert.equal(p.skillCastPhase, "release");
    if (["guardian", "sage"].includes(cls)) assert.ok(p.hp > 100);
    if (cls === "sage") { assert.equal(p.selfDefBuff.add, 12); assert.equal(p.mp, 50); }
    timer.advance(3000);
    assert.equal(p.state, "idle"); assert.equal(p.skillCastPhase, "cooldown");
    assert.equal(scene.effects[0].cleared, true); assert.equal(timer.pending, 0);
    assert.equal(hits.filter(hit => hit.foe === foe).length, 1, `${cls}: one victim hit once across all pulses/overlapping seals`);
    assert.equal(hits.filter(hit => hit.foe.x === 1000).length, 0);
    if (cls === "swashbuckler") assert.equal(hits[0].element, "electric", "copied water cycles into existing shock reaction");
    p.useSkill1(); assert.equal(scene.effects.length, 1, "cancelling/finishing cannot bypass cooldown");
  }
});

test("real Player damage uses release-time range and frozen aim, including vertical casts", () => {
  const { p, timer, target, hits } = player("sniper");
  p.facing.set(0, -1);
  const foe = target(0, -150);
  p.useSkill1();
  foe.x = 900; timer.advance(220);
  assert.equal(hits.length, 0, "a target that left the preview is not hit");
  assert.equal(p.animation, "hero-atk-up");
  assert.deepEqual(p.scene.effects[0].aim, new Vector(0, -1));
});

test("real C dodge cancels an unreleased cast, preserves S1 cooldown and cannot cancel without MP/readiness", () => {
  for (const blocked of ["cooldown", "mp", null]) {
    const { p, timer, scene, hits } = player();
    p.useSkill1();
    if (blocked === "cooldown") p.skill2Cd = 10;
    if (blocked === "mp") p.mp = 19;
    p.useSkill2();
    if (blocked) {
      assert.equal(p.skillCastPhase, "startup");
      p.cancelSkillCast();
    } else {
      assert.equal(p.state, "dash"); assert.equal(scene.effects[0].cleared, true);
      assert.equal(p.mp, 25); assert.equal(p.skill2Cd, 5400);
    }
    timer.advance(2000); assert.equal(hits.length, 0);
    assert.equal(p.skill1Cd, 3600);
  }
});

test("real free dash cancels startup timers and FX for every signature without refunding S1", () => {
  for (const cls of [null, ...Object.keys(WEAPON_MASTER_PROFILES)]) {
    const { p, timer, scene, target, hits } = player(cls);
    target(100, 0); p.useSkill1();
    const mp = p.mp;
    assert.equal(p.useFreeDash(), true);
    assert.equal(p.state, "dash"); assert.equal(p.skillCastPhase, "cooldown");
    assert.equal(p.mp, mp); assert.equal(p.skill1Cd, 3600);
    assert.equal(scene.effects[0].cleared, true); assert.equal(timer.pending, 0);
    timer.advance(3000); assert.equal(hits.length, 0);
    p.useSkill1(); assert.equal(scene.effects.length, 1);
  }
});

test("death, shutdown, or explicit transition cancellation cannot release later in the actual Player", () => {
  for (const reason of ["dead", "shutdown", "transition"]) {
    const { p, timer, scene, target, hits } = player("assassin");
    target(100, 0); p.useSkill1();
    if (reason === "dead") { p.hp = 0; p.state = "dead"; }
    if (reason === "shutdown") scene.active = false;
    if (reason === "transition") p.cancelSkillCast();
    timer.advance(3000);
    assert.equal(hits.length, 0); assert.equal(scene.effects[0].cleared, true); assert.equal(timer.pending, 0);
    assert.equal(p.skill1Cd, 3600);
    if (reason === "dead") assert.equal(p.state, "dead");
  }
});

test("taught skills count one completed release per cast; cancellation and cooldown inputs earn nothing", () => {
  for (const cls of Object.keys(WEAPON_MASTER_PROFILES)) {
    const { p, timer, scene } = player(cls), profile = weaponMasterProfileOf(cls);
    p.useSkill1(); p.useSkill1();
    assert.deepEqual(p.skillMastery, {});
    timer.advance(3000);
    assert.deepEqual(p.skillMastery, { [profile.style]: 1 });
    assert.equal(scene.saveRequests, 1);
    p.useSkill1(); assert.equal(p.skillMastery[profile.style], 1);
    p.skill1Cd = 0; p.useSkill1(); p.cancelSkillCast(); timer.advance(6000);
    assert.equal(p.skillMastery[profile.style], 1);
  }
});

test("mastery damage/healing actually scale, cap at +20%, and persist independently across branch/tier changes", () => {
  for (const cls of ['berserker', 'guardian', 'sage']) {
    const damage = [], healing = [];
    for (const uses of [0, 491, 999999]) {
      const { p, timer, target, hits } = player(cls), key = weaponMasterProfileOf(cls).style;
      p.skillMastery = normalizeSkillMastery({ [key]: uses });
      target(70, 0); p.useSkill1(); timer.advance(3000);
      damage.push(hits[0].dmg); healing.push(p.hp - 100);
      assert.equal(p.skillMastery[key], uses === 0 ? 1 : 491);
    }
    assert.ok(Math.abs(damage[1] / damage[0] - 1.2) < 1e-10); assert.equal(damage[2], damage[1]);
    if (cls !== 'berserker') assert.ok(healing[1] > healing[0]);
  }
  const { p } = player('berserker'); p.skillMastery = { solar: 5, life: 13 };
  p.cls = 'warlord'; assert.equal(p.skill1Mastery.level, 1);
  p.cls = 'guardian'; assert.equal(p.skill1Mastery.level, 2);
  p.cls = 'berserker'; assert.equal(p.skill1Mastery.level, 1);
});

test("legacy/corrupt mastery data is bounded and level thresholds are exact", () => {
  for (const v of [undefined, null, [], 'invalid']) assert.deepEqual(normalizeSkillMastery(v), {});
  assert.deepEqual(normalizeSkillMastery({ solar: -2, life: NaN, lightning: Infinity, art: '20', shadow: 99999, unknown: 20 }), { shadow: 491 });
  assert.equal(skillMasteryProgress(4).level, 0); assert.equal(skillMasteryProgress(5).level, 1);
  assert.equal(skillMasteryProgress(490).usesToNext, 1); assert.equal(skillMasteryProgress(491).usesToNext, 0);
  assert.equal(skillMasteryProgress(999999).powerBonusPct, 20);
});

test("actual native renderer uses shipped sheets, tags every object and removes cast-owned effects/tweens", () => {
  const source = readFileSync(new URL("../src/game/fx/WeaponMasterCombat.ts", import.meta.url), "utf8");
  const boot = readFileSync(new URL("../src/game/scenes/BootScene.ts", import.meta.url), "utf8");
  for (const [, key] of source.matchAll(/this\.native\("([^"]+)"/g)) {
    assert.ok(boot.includes(`"${key}"`), `${key} already loaded by BootScene`);
    assert.ok(existsSync(new URL(`../public/assets/fx/${key}.png`, import.meta.url)), `${key}: existing sheet`);
    assert.ok(existsSync(new URL(`../public/assets/fx/${key}.json`, import.meta.url)), `${key}: existing animation metadata`);
  }
  for (const profile of [STARTER_SIGNATURE, ...Object.values(WEAPON_MASTER_PROFILES)]) {
    const live = new Set(), all = [], killed = [], natives = [], tweens = [];
    function object() {
      const events = new Map(), data = new Map();
      const target = { active: true, data,
        setData(k, v) { data.set(k, v); return proxy; },
        once(k, fn) { events.set(k, fn); return proxy; },
        destroy() { if (!target.active) return; target.active = false; live.delete(proxy); events.get("destroy")?.(); },
      };
      const proxy = new Proxy(target, { get(t, k) { return k in t ? t[k] : () => proxy; } });
      live.add(proxy); all.push(proxy); return proxy;
    }
    const scene = {
      fxLevel: 1, textures: { exists: () => true }, anims: { exists: () => true },
      add: { graphics: object, image: object, sprite: object },
      tweens: { add(tween) { tweens.push(tween); }, killTweensOf: object => killed.push(object) },
    };
    const Renderer = new Function("Phaser", "playFx", "signatureZones", ts.transpile(
      source.replace(/^import[^\n]*\n/gm, "").replace("export class WeaponMasterCombat", "class WeaponMasterCombat") + "\nreturn WeaponMasterCombat;",
      { target: ts.ScriptTarget.ES2022 },
    ))({ BlendModes: { ADD: 1 }, GameObjects: { Events: { DESTROY: "destroy" } }, Animations: { Events: { ANIMATION_COMPLETE: "complete" } } },
      (_scene, key) => { natives.push(key); return object(); }, signatureZones);
    const renderer = new Renderer(scene, profile, { x: 0, y: 0 }, { x: 1, y: 0 }, 2,
      { texture: "hero_idle0", frame: "__BASE", flip: true, scaleX: 1, scaleY: 1 });
    renderer.startup();
    assert.ok(all.some(object => object.data.get("rea:phase") === "startup"));
    const preview = all[0];
    assert.ok(tweens.some(tween => tween.targets === preview && tween.alpha === 1 && tween.duration === profile.startup));
    profile.pulses.forEach((_, pulse) => renderer.release(pulse));
    assert.equal(killed.filter(object => object === preview).length, 1, "release cancels the warning tween before destroying it");
    assert.ok(all.length < 30, `${profile.style}: bounded effect count`);
    for (const object of all) assert.equal(object.data.get("rea:skill"), profile.style);
    const beforeClear = live.size;
    renderer.clear(); renderer.clear();
    assert.equal(live.size, 0); assert.equal(killed.length, beforeClear + 1, "released preview and all still-live tweens cancelled exactly once");
    assert.equal(new Set(killed).size, killed.length);
    if (profile.style === "book") assert.deepEqual(natives, ["arcane-orb", "arcane-orb", "arcane-orb"]);
  }
});
