import Phaser from 'phaser';
import {
  WORLDS, MONSTERS, relicOf, ELEMENTS, GEMS, QUESTS,
  type RelicId, type GemId, type ElementId, type WorldDef, type MonsterDef,
} from './data';
import { useAtl, bus, saveGame } from './state';
import { sfx } from './sfx';
import { RelicAffinitySystem } from './RelicAffinity';

// ─────────── 전역 진행 상태 (모듈 레벨 — 씬 재시작에도 유지) ───────────
export interface GameState {
  world: string; x: number; y: number; hasPos: boolean;
  lvl: number; exp: number; hp: number; mp: number; gold: number;
  relics: RelicId[]; eq: RelicId | null; gems: GemId[];
  keys: number; potions: number; potionBig: number;
  flags: string[]; stage: number;
}
const fresh = (): GameState => ({
  world:'midgard', x:0, y:0, hasPos:false,
  lvl:1, exp:0, hp:60, mp:30, gold:0,
  relics:[], eq:null, gems:[], keys:0, potions:1, potionBig:0,
  flags:[], stage:0,
});
let G: GameState = fresh();

export const expNext = (lvl:number)=> Math.floor(40*Math.pow(lvl,1.45));
export function resetGameState(){ G = fresh(); }
export function getGameState(){ return G; }
export function setGameState(s:GameState){ G = s; }
export function exportSave(){
  return { ...G, hasPos:undefined as never, x:G.hasPos?G.x:0, y:G.hasPos?G.y:0 };
}
export function saveNow(){
  saveGame({ world:G.world, x:G.hasPos?G.x:0, y:G.hasPos?G.y:0,
    lvl:G.lvl, exp:G.exp, hp:G.hp, mp:G.mp, gold:G.gold,
    relics:G.relics, eqRelic:G.eq, gems:G.gems, keys:G.keys,
    potions:G.potions, potionBig:G.potionBig, flags:G.flags, stage:G.stage, dead_bosses:[] });
}
export function importSave(s:{ world?:string; x?:number; y?:number; lvl?:number; exp?:number; hp?:number; mp?:number; gold?:number;
  relics?:RelicId[]; eqRelic?:RelicId|null; gems?:GemId[]; keys?:number; potions?:number; potionBig?:number; flags?:string[]; stage?:number }){
  G = { world:s.world||'midgard', x:s.x||0, y:s.y||0, hasPos:!!s.x, lvl:s.lvl||1, exp:s.exp||0,
    hp:s.hp||60, mp:s.mp||30, gold:s.gold||0, relics:s.relics||[], eq:s.eqRelic||null,
    gems:s.gems||[], keys:s.keys||0, potions:s.potions??1, potionBig:s.potionBig||0,
    flags:s.flags||[], stage:s.stage||0 };
}

const flag = (f:string)=> G.flags.includes(f);
const setFlag = (f:string)=>{ if(!flag(f)) G.flags.push(f); };

// ─────────── 헬퍼: 시드 랜덤 ───────────
function seeded(seedStr:string){
  let h = 1779033703;
  for (let i=0;i<seedStr.length;i++){ h = Math.imul(h^seedStr.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return ()=>{ h = Math.imul(h^(h>>>16), 2246822507); h = Math.imul(h^(h>>>13), 3266489909); h ^= h>>>16; return (h>>>0)/4294967296; };
}

// ─────────── 메인 씬 ───────────
interface Interact { kind:string; obj:Phaser.GameObjects.GameObject&{x:number;y:number}; data:Record<string,unknown>; hint:string }

export default class WorldScene extends Phaser.Scene {
  private worldDef!: WorldDef;
  private cols = 0; private rows = 0;
  private grid: string[][] = [];
  private solid: boolean[][] = [];
  blockers!: Phaser.Physics.Arcade.StaticGroup;
  monsters: AtlMonster[] = [];
  player!: AtlPlayer;
  private pProjectiles!: Phaser.Physics.Arcade.Group;
  private eProjectiles!: Phaser.Physics.Arcade.Group;
  private interactables: Interact[] = [];
  private gates: { need:RelicId; img:Phaser.GameObjects.Image; body:Phaser.Physics.Arcade.Image; def:{kind:string;msg:string} }[] = [];
  private chestObjs = new Map<string, Phaser.GameObjects.Sprite>();
  private hintObj: Phaser.GameObjects.Text|null = null;
  private nearInteract: Interact|null = null;
  private facing: 'down'|'up'|'left'|'right' = 'down';
  private lastAttack = 0; private lastSkill = 0;
  iframes = 0; private lavaTick = 0; private regenTick = 0;
  private guardUntil = 0;
  private boss: AtlMonster|null = null;
  private ragnaCycle = 0; private ragnaIdx = 0;
  private runeStep = 0;
  private runeObjs: { color:string; img:Phaser.GameObjects.Image; done:boolean }[] = [];
  private keysObj!: Record<string, Phaser.Input.Keyboard.Key>;
  private dead = false;
  private busOffs: (()=>void)[] = [];
  private god = false;
  private coinTexMade = false;

  constructor(){ super('World'); }

  init(data:{ world?:string }){
    if (data.world) G.world = data.world;
    this.dead = false;
    this.boss = null; this.runeStep = 0; this.runeObjs = [];
  }

  // ───────────────────────── 생성 ─────────────────────────
  create(){
    try {
    this.worldDef = WORLDS[G.world];
    // 씬 재시작 시 이전 월드의 잔여 객체 초기화
    // (인터랙터블/몬스터/결계 누적 → 이전 월드 포탈로 워프되는 고스팅 버그 방지)
    this.interactables = [];
    this.gates = [];
    this.chestObjs = new Map();
    this.proxCbs = [];
    this.loose = [];
    this.monsters = [];
    this.hintObj = null;
    this.nearInteract = null;
    const st = useAtl.getState();
    const w0 = window as unknown as Record<string, unknown>;
    w0.__ATL_STEP = 'start';
    st.patch({ world:G.world, worldName:this.worldDef.name, worldSub:this.worldDef.sub,
      boss:null, invOpen:false, shopOpen:false, loaded:true });

    this.parseGrid();
    this.makeFxTextures();
    this.buildTilemap();
    this.physics.world.setBounds(0,0,this.cols*16,this.rows*16);

    this.blockers = this.physics.add.staticGroup();
    this.buildBlockers();
    this.buildProps();
    this.buildNpcs();
    this.buildPortals();
    this.buildChests();
    this.buildGates();
    this.buildRunes();
    this.spawnZones();
    this.spawnBoss();

    this.player = new AtlPlayer(this, ...this.playerSpawn());
    this.cameraSetup();
    this.inputSetup();
    this.groupsSetup();
    this.busSetup();
    this.applyGateState();
    this.syncHud(true);

    // E2E 훅
    const w = window as unknown as Record<string, unknown>;
    w.__ATL_STEP = 'done';
    w.__ATL__ = {
      game: this.game,
      scene: ()=>this,
      G: ()=>JSON.parse(JSON.stringify({ world:G.world, lvl:G.lvl, exp:G.exp, hp:G.hp, mp:G.mp, gold:G.gold,
        relics:G.relics, eq:G.eq, gems:G.gems, keys:G.keys, potions:G.potions, potionBig:G.potionBig,
        flags:G.flags, stage:G.stage, x:this.player.x, y:this.player.y })),
      warp:(id:string)=>this.switchWorld(id),
      give:(r:RelicId)=>{ if(!G.relics.includes(r)) G.relics.push(r); this.syncHud(true); saveNow(); },
      equip:(r:RelicId)=>{ if(G.relics.includes(r)){ G.eq=r; this.applyGateState(); this.syncHud(true); } },
      gem:(g:GemId)=>{ if(!G.gems.includes(g)) G.gems.push(g); this.syncHud(true); saveNow(); },
      set:(k:string,v:number)=>{ (G as unknown as Record<string,number>)[k]=v; this.syncHud(true); },
      god:(v:boolean)=>{ this.god=v; },
      killBoss:()=>{ if(this.boss) this.boss.hurt(999999, this.player.x, this.player.y); },
      monsters:()=>this.monsters.filter(m=>m.active).map(m=>({ key:m.def.key, hp:m.hp, x:m.x, y:m.y })),
      usePotion:()=>this.usePotion(1),
      interact:()=>this.tryInteract(),
      attack:()=>this.doAttack(),
      near:()=>this.nearInteract?.kind ?? null,
      stage:(v:number)=>{ G.stage=v; this.syncHud(true); saveNow(); },
    };
    } catch(err){
      (window as unknown as Record<string, unknown>).__ATL_ERR = String((err as Error)?.stack ?? err);
      throw err;
    }
  }

  private parseGrid(){
    const def = this.worldDef;
    // JSON 타일맵 우선 (public/atlantis/maps/<id>.json — BootScene 로드, gen_atlantis_maps.mjs 생성)
    // 로드 실패/불일치 시 data.ts ASCII 맵으로 폴백 — 두 소스는 생성기가 항상 동기화한다.
    const jm = this.cache.json.get(`atlmap_${G.world}`) as
      { cols:number; rows:number; grid:string[]; solid:string }|null;
    let raw: string[];
    if (jm && Array.isArray(jm.grid) && jm.grid.length>0 && jm.grid.length===jm.rows){
      raw = jm.grid;
    } else {
      raw = def.map;
    }
    this.rows = raw.length;
    this.cols = Math.max(def.size[0], ...raw.map(r=>r.length));
    this.grid = []; this.solid = [];
    for (let y=0;y<this.rows;y++){
      const row = raw[y].padEnd(this.cols,'#').split('');
      this.grid.push(row);
      this.solid.push(row.map(c=> c==='#'||c==='~'||c==='W'));
    }
  }

  private buildTilemap(){
    const def = this.worldDef;
    const g = def.ground;
    const rng = seeded(G.world+'tiles');
    // 바닥(타일스프라이트) + 특수 셀은 개별 이미지
    this.add.tileSprite(0, 0, this.cols*16, this.rows*16, def.dungeon ? 'dun_floor' : `ground_${g}`)
      .setOrigin(0).setDepth(0);
    const waterCells: [number,number][] = [];
    for (let y=0;y<this.rows;y++) for (let x=0;x<this.cols;x++){
      const c = this.grid[y][x];
      const px = x*16+8, py = y*16+8;
      if (def.dungeon){
        if (c==='W'){
          this.add.image(px,py, ((x+y)%5===0)?'dun_wallcap':'dun_wall').setDepth(0);
        } else if ((x+y)%7===0){
          this.add.image(px,py,'dun_floor2').setDepth(0);
        }
        continue;
      }
      if (c==='#'){
        this.add.image(px,py,`rim_${g}`).setDepth(0);
      } else if (c==='~'||c==='L'){
        this.add.image(px,py,`water_${g}`,0).setDepth(0);
        waterCells.push([x,y]);
      } else if (c==='p'){
        this.add.image(px,py,`path_${g}`).setDepth(0);
      }
    }
    // 물/용암 일부 애니메이션
    const picked = new Set<string>();
    for (let i=0;i<400&&picked.size<24&&i<waterCells.length;i++){
      const [x,y] = waterCells[Math.floor(rng()*waterCells.length)];
      const key = `${x},${y}`;
      if (picked.has(key)) continue;
      picked.add(key);
      const s = this.add.sprite(x*16+8, y*16+8, `water_${g}`, 0).setDepth(0.5);
      let fr = 0;
      this.time.addEvent({ delay:240, loop:true, callback:()=>{ fr=(fr+1)%4; s.setFrame(fr); } });
    }
  }

  private buildBlockers(){
    for (let y=0;y<this.rows;y++){
      let x = 0;
      while (x<this.cols){
        if (this.solid[y][x]){
          let x2 = x;
          while (x2+1<this.cols && this.solid[y][x2+1]) x2++;
          const b = this.add.rectangle(x*16+((x2-x+1)*8), y*16+8, (x2-x+1)*16, 16);
          this.physics.add.existing(b, true);
          this.blockers.add(b);
          b.setVisible(false);
          x = x2+1;
        } else x++;
      }
    }
  }

  private nearSolidFree(tx:number, ty:number):boolean{
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){
      const x=tx+dx,y=ty+dy;
      if (x<1||y<1||x>=this.cols-1||y>=this.rows-1) continue;
      if (!this.solid[y] || !this.solid[y][x]) return true;
    }
    return false;
  }

  private walkable(tx:number,ty:number):boolean{
    return tx>=0&&ty>=0&&tx<this.cols&&ty<this.rows&&!this.solid[ty][tx];
  }

  private findWalkable(tx:number,ty:number,r=6):[number,number]{
    if (this.walkable(tx,ty)) return [tx,ty];
    for (let rad=1;rad<=r;rad++)
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (Math.abs(dx)!==rad&&Math.abs(dy)!==rad) continue;
        if (this.walkable(tx+dx,ty+dy)) return [tx+dx,ty+dy];
      }
    return [tx,ty];
  }

  private tileCenter(tx:number,ty:number):[number,number]{ return [tx*16+8, ty*16+8]; }

  private playerSpawn():[number,number]{
    let [tx,ty] = G.hasPos ? [G.x,G.y] : [this.worldDef.spawn.x, this.worldDef.spawn.y];
    if (!G.hasPos) [tx,ty] = this.findWalkable(tx,ty);
    [tx,ty] = this.findWalkable(tx,ty);
    const [px,py] = this.tileCenter(tx,ty);
    return [px,py];
  }

  private buildProps(){
    const def = this.worldDef;
    const rng = seeded(G.world+'props');
    const occ = new Set<string>();
    const reserve = (tx:number,ty:number,r=2)=>{
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++) occ.add(`${tx+dx},${ty+dy}`);
    };
    // 오브젝트 주변 예약
    def.portals.forEach(p=>reserve(p.x,p.y,3));
    def.npcs.forEach(n=>reserve(n.x,n.y,2));
    def.chests.forEach(c=>reserve(c.x,c.y,2));
    (def.gates||[]).forEach(g=>reserve(g.x,g.y,3));
    (def.runes||[]).forEach(r=>reserve(r.x,r.y,2));
    if (def.boss) reserve(def.boss.x, def.boss.y, 4);
    reserve(def.spawn.x, def.spawn.y, 2);
    // 치크포인트 통로 보존
    if (G.world==='nevada'){ for(let x=22;x<=30;x++) for(let y=14;y<=19;y++) occ.add(`${x},${y}`); }
    if (G.world==='niflheim'){ for(let x=18;x<=25;x++) for(let y=13;y<=18;y++) occ.add(`${x},${y}`); }
    if (G.world==='muspelheim'){ for(let x=17;x<=25;x++) for(let y=5;y<=9;y++) occ.add(`${x},${y}`); }

    // 집 (허브)
    (def.houses||[]).forEach(h=>{
      const img = this.add.image(h.x*16+8, h.y*16+18, h.img).setOrigin(0.5,0.85).setDepth(h.y*16+18);
      const w = img.width-10, hh = Math.max(14, img.height*0.45);
      const zone = this.add.zone(img.x, img.y+img.height*0.14, w, hh);
      this.physics.add.existing(zone, true);
      this.blockers.add(zone); zone.setVisible(false);
      reserve(h.x,h.y,3);
    });
    // 분수/제단/성배 (허브)
    if (G.world==='hub'){
      this.addProp('fountain', 22, 10, 0.9);
      this.addProp('altar', 22, 5.5, 0.55);
      this.addProp('chalice', 26, 8, 0.5, false);
      this.addProp('altar', 28, 24, 0.4);
      for (const [cx,cy] of [[14,13],[30,17]]) this.addAnimProp('campfire', cx, cy);
    }
    if (G.world==='midgard'){
      this.addAnimProp('campfire', 18, 10);
      this.addProp('fountain', 12, 12, 0.7);
    }
    // 나무
    const treeCount = (G.world==='forest')?70:(G.world==='alfheim'?40:(G.world==='midgard'?22:(G.world==='hub'?26:(G.world==='jotunheim'?20:(G.world==='niflheim'?26:12)))));
    const treePool = def.trees==='pine' ? ['tree_pine','tree_pine']
      : def.trees==='fm' ? ['tree_maple','tree_teal','tree_gold','tree_pine','willow']
      : [];
    if (def.dungeon){
      for(let i=0;i<10;i++){
        const tx=Math.floor(rng()*this.cols), ty=Math.floor(rng()*this.rows);
        if (this.walkable(tx,ty)&&!occ.has(`${tx},${ty}`)){
          const [px,py]=this.tileCenter(tx,ty);
          this.add.image(px,py,'barrel').setOrigin(0.5,0.8).setDepth(py);
          this.addBodyAt(px,py,10,8);
          occ.add(`${tx},${ty}`);
        }
      }
    }
    for (let i=0;i<treeCount && treePool.length;i++){
      const tx = 2+Math.floor(rng()*(this.cols-4));
      const ty = 2+Math.floor(rng()*(this.rows-4));
      if (!this.walkable(tx,ty)||occ.has(`${tx},${ty}`)) continue;
      const [px,py]=this.tileCenter(tx,ty);
      const key = treePool[Math.floor(rng()*treePool.length)];
      const s = 0.8+rng()*0.5;
      const img = this.add.image(px,py+4,key).setOrigin(0.5,0.92).setScale(s).setDepth(py+4);
      this.addBodyAt(px, py+2, 10*s, 7*s);
      occ.add(`${tx},${ty}`);
    }
    // 꽃/풀 장식 (biome 0-3, decor 0-3)
    for (let i=0;i<46;i++){
      const tx = 2+Math.floor(rng()*(this.cols-4));
      const ty = 2+Math.floor(rng()*(this.rows-4));
      if (!this.walkable(tx,ty)||occ.has(`${tx},${ty}`)) continue;
      const [px,py]=this.tileCenter(tx,ty);
      const sheet = rng()<0.5?'biome':'decor';
      const fr = Math.floor(rng()*4);
      this.add.image(px,py,sheet,fr).setOrigin(0.5,0.75).setDepth(py-8).setAlpha(0.95);
    }
    // 연꽃
    for (let i=0;i<14;i++){
      const tx = 2+Math.floor(rng()*(this.cols-4));
      const ty = 2+Math.floor(rng()*(this.rows-4));
      if (this.walkable(tx,ty)) continue;
      if (this.grid[ty][tx]!=='~') continue;
      const [px,py]=this.tileCenter(tx,ty);
      this.add.image(px,py,'lillies',Math.floor(rng()*6)).setDepth(0.6);
    }
    // 저주 프롭 (니플헤임)
    if (G.world==='niflheim'){
      const cursed = ['cursed_bones','cursed_rock','cursed_spike','cursed_ruins','cursed_rockeye','cursed_meatflower'];
      for (let i=0;i<20;i++){
        const tx = 2+Math.floor(rng()*(this.cols-4));
        const ty = 2+Math.floor(rng()*(this.rows-4));
        if (!this.walkable(tx,ty)||occ.has(`${tx},${ty}`)) continue;
        const [px,py]=this.tileCenter(tx,ty);
        this.add.image(px,py,cursed[Math.floor(rng()*cursed.length)]).setOrigin(0.5,0.75).setDepth(py-6).setScale(0.8);
      }
    }
    // 항아리 (깨뜨림)
    for (let i=0;i<8;i++){
      const tx = 2+Math.floor(rng()*(this.cols-4));
      const ty = 2+Math.floor(rng()*(this.rows-4));
      if (!this.walkable(tx,ty)||occ.has(`${tx},${ty}`)) continue;
      const [px,py]=this.tileCenter(tx,ty);
      const pot = this.physics.add.staticImage(px,py-4,'pot0').setOrigin(0.5,0.85).setDepth(py);
      pot.setData('pot',true);
      this.addOverlapPlayer(pot as unknown as Phaser.GameObjects.GameObject&{x:number;y:number}, ()=>this.breakPot(pot), 14);
      occ.add(`${tx},${ty}`);
    }
  }

  private addProp(key:string, tx:number, ty:number, scale=1, solid=true){
    const [px,py]=this.tileCenter(Math.round(tx*2)/2, Math.round(ty*2)/2);
    const img = this.add.image(px,py,key).setOrigin(0.5,0.85).setScale(scale).setDepth(py);
    if (solid) this.addBodyAt(px,py, img.displayWidth*0.5, img.displayHeight*0.3);
    return img;
  }
  private addAnimProp(key:string, tx:number, ty:number){
    const [px,py]=this.tileCenter(tx,ty);
    const s = this.add.sprite(px,py-2,key,0).setOrigin(0.5,0.8).setDepth(py);
    s.play('campfire_burn');
  }

  // ── 오브젝트 빌드 ──
  private addBodyAt(px:number, py:number, w:number, h:number){
    const b = this.add.rectangle(px, py, Math.max(8,w), Math.max(8,h));
    this.physics.add.existing(b, true);
    this.blockers.add(b); b.setVisible(false);
    return b;
  }

  private proxCbs: { obj:Phaser.GameObjects.GameObject&{x:number;y:number}; cb:()=>void; r:number }[] = [];
  private addOverlapPlayer(obj:Phaser.GameObjects.GameObject&{x:number;y:number}, cb:()=>void, r=14){
    this.proxCbs.push({ obj, cb, r });
  }

  private buildNpcs(){
    for (const n of this.worldDef.npcs){
      const [tx,ty] = this.findWalkable(n.x, n.y);
      const [px,py] = this.tileCenter(tx,ty);
      let obj: Phaser.GameObjects.Sprite&{x:number;y:number};
      if (n.sprite==='altar'){
        const img = this.add.image(px, py+6, 'altar').setOrigin(0.5,0.9).setScale(0.16).setDepth(py);
        this.addBodyAt(px, py+2, 14, 8);
        obj = img as unknown as Phaser.GameObjects.Sprite&{x:number;y:number};
      } else {
        const s = this.add.sprite(px, py, n.sprite, 0).setOrigin(0.5,0.78).setDepth(py);
        s.play(`${n.sprite}_idle`);
        this.addBodyAt(px, py+2, 12, 8);
        obj = s;
      }
      this.interactables.push({ kind:'npc', obj, data:{ id:n.id, name:n.name }, hint:n.name });
      // 퀘스트 느낌표
      if (this.npcHasQuest(n.id)){
        const ex = this.add.image(px, py-26, 'exclaim').setDepth(py+10).setScale(0.8);
        this.tweens.add({ targets:ex, y:py-30, duration:600, yoyo:true, repeat:-1 });
      }
    }
  }

  private npcHasQuest(id:string):boolean{
    const s = G.stage;
    return (id==='grandma'&&s===0)||(id==='grave'&&s===1)||(id==='king'&&(s===3||s===5))
      ||(id==='sage'&&s>=6&&!flag('gotTrident'))||(id==='forestfairy'&&s===4)||(id==='odin'&&s>=9);
  }

  private buildPortals(){
    for (const p of this.worldDef.portals){
      const [tx,ty] = this.findWalkable(p.x,p.y);
      const [px,py] = this.tileCenter(tx,ty);
      const s = this.add.sprite(px, py+14, 'portal', 0).setOrigin(0.5,0.85).setScale(0.42).setDepth(py+12);
      s.play('portal_spin');
      const locked = !!p.activeFlag && !flag(p.activeFlag);
      if (locked) s.setAlpha(0.45);
      const label = this.add.text(px, py-14, p.label, {
        fontFamily:'sans-serif', fontSize:'9px', color:'#ffffff', stroke:'#00000088', strokeThickness:3,
      }).setOrigin(0.5).setDepth(py+13);
      this.tweens.add({ targets:label, y:py-17, duration:900, yoyo:true, repeat:-1, ease:'sine.inout' });
      this.interactables.push({ kind:'portal', obj:s, data:{ def:p }, hint:`${p.label} 포탈` });
    }
  }

  private buildChests(){
    for (const c of this.worldDef.chests){
      if ((c.id==='al_ring'||c.id==='al_gem') && !flag('runesDone')) continue;
      this.makeChest(c);
    }
  }

  private makeChest(c:{ id:string;x:number;y:number;loot:Record<string,unknown>;hidden?:boolean }){
    const [tx,ty] = this.findWalkable(c.x,c.y);
    const [px,py] = this.tileCenter(tx,ty);
    const opened = flag('chest_'+c.id);
    const s = this.add.sprite(px, py-2, 'chest', opened?3:0).setOrigin(0.5,0.8).setDepth(py);
    if (!opened) this.interactables.push({ kind:'chest', obj:s as unknown as Phaser.GameObjects.Sprite&{x:number;y:number}, data:{ def:c }, hint:'상자' });
    this.chestObjs.set(c.id, s);
  }

  private buildGates(){
    for (const gdef of (this.worldDef.gates||[])){
      const [px,pyBottom] = [gdef.x*16+8, gdef.y*16+16];
      const img = this.add.image(px, pyBottom, `gate_${gdef.kind}`).setOrigin(0.5,1).setDepth(gdef.y*16+20);
      const body = this.physics.add.staticImage(px, pyBottom-10, 'qmark').setScale(0.01).setVisible(false);
      body.refreshBody();
      if (body.body){
        (body.body as Phaser.Physics.Arcade.StaticBody).setSize(16,14);
        (body.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      }
      this.gates.push({ need:gdef.need, img, body, def:{ kind:gdef.kind, msg:gdef.msg } });
      this.interactables.push({ kind:'gate', obj:img as unknown as Phaser.GameObjects.Sprite&{x:number;y:number}, data:{ def:gdef }, hint:`${gdef.kind} 결계` });
    }
  }

  applyGateState(){
    for (const g of this.gates){
      const pass = G.eq===g.need;
      if (g.body.body) g.body.body.enable = !pass;
      g.img.setAlpha(pass?0.25:1);
    }
  }

  private buildRunes(){
    for (const r of (this.worldDef.runes||[])){
      const [tx,ty] = this.findWalkable(r.x,r.y);
      const [px,py] = this.tileCenter(tx,ty);
      const img = this.add.image(px,py-4,`rune_${r.color}`).setOrigin(0.5,0.85).setScale(1.3).setDepth(py);
      this.addBodyAt(px,py,10,8);
      this.runeObjs.push({ color:r.color, img, done:false });
      this.interactables.push({ kind:'rune', obj:img as unknown as Phaser.GameObjects.Sprite&{x:number;y:number}, data:{ color:r.color, id:r.id }, hint:'룬석' });
    }
  }

  private spawnZones(){
    const rng = seeded(G.world+'mobs'+G.stage);
    for (const z of this.worldDef.zones){
      let placed = 0, tries = 0;
      while (placed<z.count && tries<120){
        tries++;
        const tx = z.x+Math.floor(rng()*z.w), ty = z.y+Math.floor(rng()*z.h);
        if (!this.walkable(tx,ty)) continue;
        const [px,py] = this.tileCenter(tx,ty);
        const type = z.types[Math.floor(rng()*z.types.length)];
        new AtlMonster(this, type, px, py); // 생성자에서 scene.monsters에 등록됨
        placed++;
      }
    }
  }

  private spawnBoss(){
    const b = this.worldDef.boss;
    if (!b || flag('b_'+b.type)) return;
    const [tx,ty] = this.findWalkable(b.x,b.y);
    const [px,py] = this.tileCenter(tx,ty);
    this.boss = new AtlMonster(this, b.type, px, py, true);
  }

  private makeFxTextures(){
    if (this.coinTexMade) return;
    this.coinTexMade = true;
    const mk = (key:string, draw:(g:Phaser.GameObjects.Graphics)=>void)=>{
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, 24, 24);
      g.destroy();
    };
    mk('coin', g=>{ g.fillStyle(0xffd34d,1).fillCircle(12,12,5); g.fillStyle(0xfff3b0,1).fillCircle(10.5,10.5,2); });
    mk('bolt', g=>{ g.fillStyle(0x9be8ff,1).fillCircle(12,12,4); g.fillStyle(0xffffff,1).fillCircle(12,12,2); });
    mk('ebolt', g=>{ g.fillStyle(0xff6a5a,1).fillCircle(12,12,4); g.fillStyle(0xffd0a0,1).fillCircle(12,12,2); });
    mk('arrow', g=>{ g.fillStyle(0xdcf3ff,1).fillRect(4,10,16,3); g.fillStyle(0xffffff,1).fillTriangle(20,7,20,16,24,11.5); });
    mk('ring', g=>{ g.lineStyle(3,0xaef0ff,1).strokeCircle(12,12,9); });
    mk('guard', g=>{ g.lineStyle(3,0xffe08a,1).strokeCircle(12,12,9); });
  }

  private cameraSetup(){
    const cam = this.cameras.main;
    cam.setBounds(0,0,this.cols*16,this.rows*16);
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.setZoom(2.4);
    cam.setRoundPixels(true);
    cam.fadeIn(320, 8, 10, 14);
  }

  private inputSetup(){
    const kb = this.input.keyboard!;
    this.keysObj = kb.addKeys('W,A,S,D,SPACE,J,K,I,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', ()=>this.tryInteract());
    kb.on('keydown-J', ()=>this.doAttack());
    kb.on('keydown-K', ()=>this.doSkill());
    kb.on('keydown-I', ()=>{ const st=useAtl.getState(); st.patch({ invOpen:!st.invOpen }); });
    kb.on('keydown-ESC', ()=>{ const st=useAtl.getState(); st.patch({ invOpen:false, shopOpen:false }); });
    const numMap: Record<string,RelicId[]> = {
      ONE:['rust','sword'], TWO:['trident'], THREE:['ring'], FOUR:['necklace'], FIVE:['shield'], SIX:['staff'], SEVEN:['bow'],
    };
    for (const [k,ids] of Object.entries(numMap)){
      kb.on(`keydown-${k}`, ()=>{ for(const id of ids){ if(G.relics.includes(id)){ this.equipRelic(id); return; } } });
    }
    this.input.on('pointerdown', (p:Phaser.Input.Pointer)=>{
      if (p.event?.target && !(p.event.target as HTMLElement).closest('canvas')) return;
      const st = useAtl.getState();
      if (st.dialog){ st.advanceDialog(); return; }
      const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.doAttack(wp);
    });
  }

  private groupsSetup(){
    this.pProjectiles = this.physics.add.group({ allowGravity:false });
    this.eProjectiles = this.physics.add.group({ allowGravity:false });
  }

  private busSetup(){
    const offs = this.busOffs;
    offs.push(bus.on('buy', (what)=>{
      const item = what as string;
      if (item==='potion'){ if(G.gold>=25){ G.gold-=25; G.potions++; sfx.gold(); this.toast('포션 구매 (-25G)'); } else this.toast('골드가 부족하다'); }
      if (item==='potionBig'){ if(G.gold>=60){ G.gold-=60; G.potionBig++; sfx.gold(); this.toast('대형 포션 구매 (-60G)'); } else this.toast('골드가 부족하다'); }
      this.syncHud(true); saveNow();
    }));
    offs.push(bus.on('equipRelic', (r)=>this.equipRelic(r as RelicId)));
    offs.push(bus.on('usePotion', (big)=>this.usePotion(big as number)));
    this.events.on('shutdown', ()=>{ this.busOffs.forEach(off=>off()); this.busOffs=[]; });
  }

  private equipRelic(r:RelicId){
    if (!G.relics.includes(r)) return;
    G.eq = r;
    sfx.pickup();
    const rd = relicOf(r);
    this.toast(`장착: ${rd.name}`, rd.icon);
    this.applyGateState();
    this.syncHud(true); saveNow();
  }

  private toast(text:string, icon?:string){ useAtl.getState().toast(text, icon); }

  private hudKey = '';
  syncHud(force=false){
    const key = `${G.hp}|${G.mp}|${G.gold}|${G.lvl}|${G.exp}|${G.eq}|${G.relics.join(',')}|${G.gems.join(',')}|${G.keys}|${G.potions}|${G.potionBig}|${G.stage}`;
    if (!force && key===this.hudKey) return;
    this.hudKey = key;
    const q = QUEST();
    useAtl.getState().patch({
      hp:Math.max(0,Math.ceil(G.hp)), maxHp:this.maxHp(), mp:Math.ceil(G.mp), maxMp:this.maxMp(),
      lvl:G.lvl, exp:G.exp, expNext:expNext(G.lvl), gold:G.gold,
      relics:[...G.relics], eqRelic:G.eq, gems:[...G.gems], keys:G.keys,
      potions:G.potions, potionBig:G.potionBig, stage:G.stage,
      world:G.world, worldName:this.worldDef.name, worldSub:this.worldDef.sub,
      questTitle:q.title, questHint:q.hint,
    } as Partial<ReturnType<typeof useAtl.getState>>);
  }

  maxHp(){ return 60 + (G.lvl-1)*12; }
  maxMp(){ return 30 + (G.lvl-1)*6; }

  // ── 인터랙션 ──
  tryInteract(){
    const st = useAtl.getState();
    if (this.dead) return;
    if (st.dialog){ st.advanceDialog(); return; }
    if (!this.nearInteract) return;
    const it = this.nearInteract;
    if (it.kind==='npc') this.interactNpc(it.data.id as string, it.data.name as string);
    else if (it.kind==='portal') this.interactPortal(it.data.def as WorldDef['portals'][number]);
    else if (it.kind==='chest') this.interactChest(it.data.def as { id:string;loot:Record<string,unknown> });
    else if (it.kind==='gate') this.interactGate(it.data.def as { need:RelicId;msg:string });
    else if (it.kind==='rune') this.interactRune(it.data.color as string);
  }

  private say(name:string, lines:string[], onDone?:()=>void){ useAtl.getState().say(name, lines, onDone); sfx.dialog(); }

  private interactNpc(id:string, name:string){
    const S = G.stage;
    switch(id){
      case 'grandma':
        if (S===0){
          this.say(name,[
            '…그래, 왔구나. 할머니 이제 갈 때가 됐어.',
            '너는… 그 애 아들이자, 바다의 피를 이은 아이야.',
            '묘비에 마지막 유언을 남겨뒀다. 꼭 읽고 가렴…',
          ],()=>{ setFlag('f_met_grandma'); G.stage=1; this.syncHud(true); saveNow(); });
        } else if (S>=2){
          this.say(name,[ '바다의 인어들이 다시 노래하기를… 꼭 부탁한다.' ]);
        } else {
          this.say(name,[ '먼저 묘비를 읽고 오렴…' ]);
        }
        break;
      case 'grave':
        if (S===1){
          this.say('할머니의 유언',[
            '"얘야. 네 어머니는 인어가 아니라, 바다의 수호자였다."',
            '"니플헤임의 이리가 탐욕의 보석을 삼키고, 네바다의 불거인이 분노를 태울 때…"',
            '"일곱 성물과 일곱 보석이 아홉 세계를 다시 잇는다."',
            '"쿠소디아로 가라. 왕이 그 시작을 알고 있다."',
          ],()=>{
            setFlag('f_grave');
            this.awaken();
          });
        } else {
          this.say('묘비',[ '"일곱 성물과 일곱 보석이 아홉 세계를 다시 잇는다."' ]);
        }
        break;
      case 'king':
        if (S===2){
          this.say(name,[
            '미드가르드의 아이로군… 할머니의 유언은 들었다.',
            '숲의 니드호그가 탐식의 힘으로 숲을 삼키고 있다.',
            '이 절제의 검을 받아라. 탐식을 베는 유일한 성물이다.',
            '숲은 왕국 남문 밖이다. 물러가라!',
          ],()=>{
            if (!G.relics.includes('sword')) G.relics.push('sword');
            this.equipRelic('sword');
            G.stage=3; this.syncHud(true); saveNow(); sfx.relic();
            this.toast('절제의 검 획득! (숫자키 1)', 'relic_sword');
            this.checkAsgardReady();
          });
        } else if (S===3){
          this.say(name,[ '니드호그는 탐식 속성이다. 절제의 검(1번)을 장착하고 남쪽 숲으로.' ]);
        } else if (S===5){
          this.say(name,[
            '…니드호그를 베었다고! 잘했다, 용사.',
            '이 소식에 아홉 세계가 움직일 것이다.',
            '알프헤임, 스바르트알프헤임, 요툰헤임, 요르문간드의 포탈이 열렸다.',
            '남은 성물을 모아 네바다의 수르트를 막아라!',
          ],()=>{ setFlag('f_ch1'); G.stage=6; this.syncHud(true); saveNow(); sfx.levelup(); });
        } else if (S>=6){
          this.say(name,[ '성물 7개, 보석 7개… 그것이 아홉 세계를 되살린다.' ]);
        } else {
          this.say(name,[ '쿠소디아에 온 것을 환영한다.' ]);
        }
        break;
      case 'forestfairy':
        this.say(name,[
          '니드호그는 [탐식] 속성! 절제의 검(1번)으로 때려야 큰 피해를 준다.',
          '깨질 수 있는 항아리를 부수면 숨긴 물건이 나올지도?',
        ]);
        break;
      case 'fairy':
        this.say(name,[
          '숫자키 1~7로 성물을 장착할 수 있어요.',
          '적 위의 색 표식이 적의 속성입니다. 상성이 맞으면 2.2배!',
          'K키로 성물 스킬을 쓸 수 있어요 (MP 소모).',
        ]);
        break;
      case 'merchant':{
        const st = useAtl.getState();
        st.patch({ shopOpen:true });
        break;
      }
      case 'guard1': case 'guard2':
        this.say('왕국 근위병',[ '포탈은 모두 개방되어 있다. 다만 니플헤임은 수르트를 잡아야 열린다.' ]);
        break;
      case 'elfelder':
        this.say(name,[
          '룬석은 오래된 순서로 만져야 한다. 파랑… 초록… 빨강.',
          '순서가 틀리면 룬이 모두 꺼지니 조심하게.',
          '수호천사는 [오만] 속성 — 겸손한 자만이 지나갈 수 있다.',
        ]);
        break;
      case 'smith':
        this.say(name,[
          '이 동굴 깊은 곳에 내 금고가 있다. 열쇠 두 개가 필요하지.',
          '열쇠는 동굴 곳곳의 상자에 있다. 심연의 기사 조심하고.',
        ]);
        break;
      case 'sage':
        if (!flag('gotTrident') && S>=6){
          this.say(name,[
            '네가 절제의 검사로구나. 나는 잿빛 현자.',
            '수르트의 분노는 상식을 태운다. 인내만이 그 불길을 견딘다.',
            '이 인내의 삼지창을 받아라. 용암도 견딜 수 있을 것이다.',
          ],()=>{
            if (!G.relics.includes('trident')) G.relics.push('trident');
            this.equipRelic('trident');
            setFlag('gotTrident'); saveNow(); sfx.relic();
            this.toast('인내의 삼지창 획득! (숫자키 2)', 'relic_trident');
            this.checkAsgardReady();
          });
        } else {
          this.say(name,[ '수르트는 [분노]. 인내의 삼지창(2번)을 장착하라.' ]);
        }
        break;
      case 'ghostgirl':
        this.say(name,[
          '추워라… 나는 여기서 펜리르를 기다리다 얼어버렸어.',
          '펜리르는 [탐욕]. 희망의 활이 있으면 관통할 수 있을 텐데…',
          '얼음 결계는 따뜻한 지팡이로 녹일 수 있어.',
        ]);
        break;
      case 'giant':
        this.say(name,[ '돌거인 왕은 [오만]. 겸손의 방패와 대지의 보석을 챙겨가라.' ]);
        break;
      case 'sailor':
        this.say(name,[
          '뱀신 요르문간드가 북섬을 삼켰다. [질투] 속성이다.',
          '남쪽 다리를 건너면 보석이 숨겨진 섬이 있다.',
        ]);
        break;
      case 'odin':
        this.say(name,[
          '…라그나로크의 그림자는 일곱 속성을 순환한다.',
          '그때그때 상성에 맞는 성물로 응수하라. 그것이 신들의 시험이다.',
        ]);
        break;
      case 'mermaid':
        this.say(name,[
          '…어머니? 아니, 그립다만 어머니는 아니야. 나도 바다의 피를 이었어.',
          '니플헤임의 이리가 진짜를 삼킨 뒤로 모두가 흉흉해졌지.',
          '힘을 빌려줄게. 파도는 언제나 네 편이야.',
        ]);
        break;
      default:
        this.say(name,[ '…' ]);
    }
  }

  private awaken(){
    sfx.relic();
    this.cameras.main.flash(600, 120, 220, 255);
    this.say('각성',[
      '…몸속에서 파도 소리가 들린다.',
      '손에 익숙한 무게 — 할머니의 녹슨 검.',
      '인어의 혈통이 눈을 떴다. (녹슨 검 장착 — 숫자키 1)',
    ],()=>{
      if (!G.relics.includes('rust')) G.relics.push('rust');
      this.equipRelic('rust');
      setFlag('f_portal'); G.stage=2; this.syncHud(true); saveNow();
      this.toast('미드가르드 북쪽 포탈 개방!');
    });
  }

  private interactPortal(p:WorldDef['portals'][number]){
    if (p.activeFlag && !flag(p.activeFlag)){
      sfx.error();
      this.toast(p.needMsg || '아직 열리지 않은 포탈이다');
      return;
    }
    sfx.portal();
    this.cameras.main.fadeOut(260, 8, 10, 14);
    this.time.delayedCall(280, ()=>this.switchWorld(p.to));
  }

  switchWorld(to:string){
    if (!WORLDS[to]) return;
    G.world = to; G.hasPos = false;
    saveNow();
    this.scene.restart({ world: to });
  }

  private interactChest(c:{ id:string;loot:Record<string,unknown> }){
    if (flag('chest_'+c.id)) return;
    sfx.pickup();
    const spr = this.chestObjs.get(c.id);
    if (spr){ spr.play('chest_open'); }
    setFlag('chest_'+c.id);
    this.interactables = this.interactables.filter(i=>!(i.kind==='chest'&&(i.data.def as {id:string}).id===c.id));
    const L = c.loot;
    if (L.gold){ G.gold+=L.gold as number; sfx.gold(); this.toast(`+${L.gold}G`); }
    if (L.potion){ G.potions+=L.potion as number; this.toast(`포션 x${L.potion}`, 'icon_potion'); }
    if (L.potionBig){ G.potionBig+=L.potionBig as number; this.toast(`대형 포션 x${L.potionBig}`, 'icon_potion_big'); }
    if (L.key){ G.keys+=L.key as number; sfx.pickup(); this.toast(`열쇠 x${L.key}`, 'key'); }
    if (L.relic){ const r=L.relic as RelicId; if(!G.relics.includes(r)) G.relics.push(r);
      sfx.relic(); const rd=relicOf(r); this.toast(`${rd.name} 획득!`, rd.icon);
      if (r==='ring'||r==='staff') this.toast('장착: 해당 숫자키 (3/6)');
    }
    if (L.gem){ const g=L.gem as GemId; if(!G.gems.includes(g)) G.gems.push(g);
      sfx.gem(); const gd=GEMS.find(x=>x.id===g)!; this.toast(`${gd.name} 획득!`, gd.icon);
    }
    // 성물/보석을 어느 경로로 얻든 아스가르드 개방 조건을 즉시 재평가 (마지막 수집이 상자여도 빠짐없이)
    this.checkAsgardReady();
    this.syncHud(true); saveNow();
  }

  private interactGate(gdef:{ need:RelicId;msg:string }){
    if (G.eq===gdef.need){ this.toast('정화되어 통과할 수 있다'); return; }
    sfx.error();
    if (G.relics.includes(gdef.need)) this.toast(`${relicOf(gdef.need).name}을(를) 장착하자 (숫자키)`);
    else this.toast(gdef.msg);
  }

  private interactRune(color:string){
    const order = ['b','g','r'];
    const expected = order[this.runeStep];
    const ro = this.runeObjs.find(r=>r.color===color);
    if (!ro) return;
    if (color===expected){
      ro.done = true; this.runeStep++;
      sfx.pickup();
      this.tweens.add({ targets:ro.img, scale:1.6, duration:160, yoyo:true });
      ro.img.setTint(0xfff2a0);
      if (this.runeStep>=3){
        setFlag('runesDone');
        sfx.relic();
        this.toast('룬의 비밀이 열렸다!');
        const alRing = this.worldDef.chests.find(c=>c.id==='al_ring');
        const alGem = this.worldDef.chests.find(c=>c.id==='al_gem');
        if (alRing) this.makeChest(alRing);
        if (alGem) this.makeChest(alGem);
        this.checkAsgardReady();
      }
    } else {
      this.runeStep = 0;
      this.runeObjs.forEach(r=>{ r.done=false; r.img.clearTint(); });
      sfx.error();
      this.toast('룬이 모두 꺼졌다… 순서가 틀렸다');
    }
  }

  private checkAsgardReady(){
    if (G.relics.length>=7 && G.gems.length>=7 && !flag('asgard_open')){
      setFlag('asgard_open');
      sfx.levelup();
      this.toast('아스가르드 포탈이 열렸다!');
    }
  }

  // ── 전투 ──
  private faceVec():[number,number]{
    switch(this.facing){ case 'up': return [0,-1]; case 'down': return [0,1]; case 'left': return [-1,0]; default: return [1,0]; }
  }

  doAttack(toward?:Phaser.Math.Vector2){
    if (this.dead||!this.player) return;
    const now = this.time.now;
    const rd = relicOf(G.eq ?? 'rust');
    if (now < this.lastAttack + rd.cd) return;
    this.lastAttack = now;
    let [fx,fy] = this.faceVec();
    if (toward){
      const d = new Phaser.Math.Vector2(toward.x-this.player.x, toward.y-this.player.y);
      if (d.length()>4){ d.normalize(); fx=d.x; fy=d.y; this.facing = Math.abs(fx)>Math.abs(fy) ? (fx>0?'right':'left') : (fy>0?'down':'up'); }
    }
    this.player.playAttack(this.facing);
    const base = rd.atk + G.lvl*2;
    if (rd.type==='pulse'){
      sfx.pulse();
      this.spawnRing(this.player.x, this.player.y, 'ring', 44);
      this.hitArea(this.player.x, this.player.y, 44, base, null);
    } else if (rd.type==='shot'){
      sfx.shoot();
      this.fireProjectile(this.player.x, this.player.y, fx, fy, 'arrow', 240, base, rd.id==='bow'?52:40, false);
    } else if (rd.type==='thrust'){
      sfx.hit();
      const cx = this.player.x+fx*30, cy = this.player.y+fy*30;
      this.spawnRing(cx, cy, 'ring', 24);
      this.hitArea(cx, cy, 26, base, [fx,fy]);
    } else {
      sfx.hit();
      const cx = this.player.x+fx*22, cy = this.player.y+fy*22;
      this.spawnRing(cx, cy, 'ring', 20);
      this.hitArea(cx, cy, 30, base, [fx,fy]);
    }
  }

  doSkill(){
    if (this.dead||!this.player) return;
    const now = this.time.now;
    if (now < this.lastSkill + 900) return;
    const rd = relicOf(G.eq ?? 'rust');
    if (G.mp < rd.skill.mp){ sfx.error(); this.toast('MP가 부족하다'); return; }
    this.lastSkill = now;
    G.mp -= rd.skill.mp;
    const [fx,fy] = this.faceVec();
    const base = (rd.atk + G.lvl*2) * 2.3;
    switch(rd.id){
      case 'shield':
        this.guardUntil = now+3000;
        this.spawnRing(this.player.x,this.player.y,'guard',40);
        sfx.heal(); this.toast('방어 태세! 3초간 피해 75% 감소');
        break;
      case 'necklace': {
        const heal = Math.floor(this.maxHp()*0.35);
        G.hp = Math.min(this.maxHp(), G.hp+heal);
        sfx.heal(); this.spawnRing(this.player.x,this.player.y,'guard',36);
        this.floatText(this.player.x, this.player.y-20, `+${heal}`, '#7dff9a');
        break;
      }
      case 'trident': {
        sfx.crit();
        this.tweens.add({ targets:this.player, x:this.player.x+fx*56, y:this.player.y+fy*56, duration:150, ease:'power3' });
        for (let i=1;i<=3;i++) this.hitArea(this.player.x+fx*i*20, this.player.y+fy*i*20, 20, base/2, null);
        this.spawnRing(this.player.x+fx*40, this.player.y+fy*40, 'ring', 30);
        break;
      }
      case 'ring': {
        sfx.pulse();
        this.spawnRing(this.player.x,this.player.y,'ring',64);
        this.hitArea(this.player.x,this.player.y,66,base,null);
        this.cameras.main.flash(120, 180, 240, 255);
        break;
      }
      case 'staff': {
        sfx.crit();
        const cx = this.player.x+fx*64, cy = this.player.y+fy*64;
        const ring = this.add.image(cx,cy,'ring').setScale(0.5).setDepth(8000).setAlpha(0.9);
        this.tweens.add({ targets:ring, scale:3.4, alpha:0, duration:360, onComplete:()=>ring.destroy() });
        this.time.delayedCall(240, ()=>{ this.hitArea(cx,cy,46,base,null); this.cameras.main.shake(120, 0.004); });
        break;
      }
      case 'bow': {
        sfx.shoot();
        this.fireProjectile(this.player.x,this.player.y,fx,fy,'arrow',330,base,64,true);
        break;
      }
      default: {
        // 녹슨 검 / 절제의 검 — 회전참격
        sfx.crit();
        this.spawnRing(this.player.x,this.player.y,'ring',48);
        this.hitArea(this.player.x,this.player.y,50,base,null);
        break;
      }
    }
    this.syncHud();
  }

  private hitArea(cx:number,cy:number,r:number,dmg:number,dir:[number,number]|null){
    for (const m of this.monsters){
      if (!m.active||m.dying) continue;
      const dx=m.x-cx, dy=m.y-cy;
      if (dx*dx+dy*dy > r*r) continue;
      if (dir && (dx*dir[0]+dy*dir[1]) < -6) continue;
      this.damageMonster(m, dmg);
    }
  }

  private elementMult(m:AtlMonster){
    // 상성 시스템 (클래스) 위임 — 장착 성물 ↔ 몬스터 속성 판정
    return RelicAffinitySystem.forEquipped(G.eq).multiplierFor(m.def);
  }

  private damageMonster(m:AtlMonster, base:number){
    const mult = this.elementMult(m);
    const crit = Math.random()<0.1;
    const dmg = Math.max(1, Math.round(base*mult*(0.9+Math.random()*0.2)*(crit?1.5:1)));
    m.hurt(dmg, this.player.x, this.player.y);
    if (mult>1.5){ sfx.crit(); this.floatText(m.x, m.y-22, `${dmg}!`, '#ffe066'); this.toastOnce('효과가 좋다! (2.2배)'); }
    else this.floatText(m.x, m.y-22, `${dmg}`, mult<1?'#9aa':'#fff');
  }

  private lastToast = 0;
  private toastOnce(t:string){ if (this.time.now-this.lastToast>1600){ this.lastToast=this.time.now; this.toast(t); } }

  fireProjectile(x:number,y:number,dx:number,dy:number,tex:string,speed:number,dmg:number,life:number,pierce:boolean,enemy=false){
    const p = (enemy?this.eProjectiles:this.pProjectiles).create(x,y,tex) as Phaser.Physics.Arcade.Image;
    p.setDepth(7000);
    const v = new Phaser.Math.Vector2(dx,dy).normalize().scale(speed);
    p.setVelocity(v.x,v.y);
    p.setRotation(v.angle());
    p.setData('dmg',dmg); p.setData('life',this.time.now+life); p.setData('pierce',pierce); p.setData('hitset',new Set<string>());
    return p;
  }

  spawnRing(x:number,y:number,tex:string,r:number){
    const img = this.add.image(x,y,tex).setDepth(7500).setScale(0.4).setAlpha(0.9);
    this.tweens.add({ targets:img, scale:r/10, alpha:0, duration:280, onComplete:()=>img.destroy() });
  }

  floatText(x:number,y:number,text:string,color='#fff'){
    const t = this.add.text(x,y,text,{ fontFamily:'sans-serif', fontSize:'10px', color, stroke:'#00000099', strokeThickness:3 })
      .setOrigin(0.5).setDepth(9200);
    this.tweens.add({ targets:t, y:y-22, alpha:0, duration:640, onComplete:()=>t.destroy() });
  }

  damagePlayer(dmg:number, sx:number, sy:number){
    if (this.dead||this.god) return;
    const now = this.time.now;
    if (now < this.iframes) return;
    this.iframes = now + 700;
    let d = dmg;
    if (G.eq==='shield') d*=0.75;
    if (now < this.guardUntil) d*=0.25;
    d = Math.max(1, Math.round(d*(0.9+Math.random()*0.2)));
    G.hp -= d;
    sfx.hurt();
    this.player.knockback(sx, sy);
    this.player.setTintFlash();
    this.floatText(this.player.x, this.player.y-24, `-${d}`, '#ff7b6b');
    this.cameras.main.shake(90, 0.003);
    this.syncHud();
    if (G.hp<=0) this.playerDie();
  }

  private playerDie(){
    this.dead = true;
    sfx.die();
    useAtl.getState().patch({ boss:null });
    this.player.die();
    this.cameras.main.fadeOut(1100, 10, 8, 14);
    this.time.delayedCall(1200, ()=>{
      G.hp = Math.floor(this.maxHp()*0.5);
      G.mp = this.maxMp();
      G.gold = Math.floor(G.gold*0.9);
      G.world = 'hub'; G.hasPos = false;
      this.toast('쓰러졌다… 쿠소디아에서 눈을 떴다');
      saveNow();
      this.scene.restart({ world:'hub' });
    });
  }

  usePotion(big=0){
    if (this.dead) return;
    if (big){ if (G.potionBig<=0) return; G.potionBig--; G.hp=Math.min(this.maxHp(),G.hp+100); G.mp=Math.min(this.maxMp(),G.mp+40); }
    else { if (G.potions<=0){ sfx.error(); this.toast('포션이 없다 — 상인에게 구매하자'); return; } G.potions--; G.hp=Math.min(this.maxHp(),G.hp+40); }
    sfx.potion();
    this.floatText(this.player.x, this.player.y-20, big?'+100':'+40', '#7dff9a');
    this.syncHud(); saveNow();
  }

  addExp(n:number){
    G.exp += n;
    while (G.exp >= expNext(G.lvl)){
      G.exp -= expNext(G.lvl);
      G.lvl++;
      G.hp = this.maxHp(); G.mp = this.maxMp();
      sfx.levelup();
      this.toast(`레벨 업! Lv.${G.lvl} (HP+12 MP+6 공격+2)`);
      this.spawnRing(this.player.x,this.player.y,'guard',40);
    }
    this.syncHud();
  }

  breakPot(pot:Phaser.GameObjects.GameObject&{x:number;y:number}){
    if (!pot.active) return;
    sfx.hit();
    const px = pot.x, py = pot.y;
    pot.destroy();
    this.proxCbs = this.proxCbs.filter(c=>c.obj!==pot);
    for (let i=0;i<5;i++){
      const sh = this.add.rectangle(px,py,3,3,0xb8b0a8).setDepth(py+8);
      this.tweens.add({ targets:sh, x:px+(Math.random()*36-18), y:py+(Math.random()*24-18), alpha:0, duration:340, onComplete:()=>sh.destroy() });
    }
    const r = Math.random();
    if (r<0.4){ const g=5+Math.floor(Math.random()*12); G.gold+=g; sfx.gold(); this.floatText(px,py-14,`+${g}G`,'#ffd34d'); this.syncHud(); }
    else if (r<0.5){ G.potions++; this.toast('포션 획득!', 'icon_potion'); this.syncHud(); }
  }

  private loose: { spr:Phaser.GameObjects.Image; kind:'potion'|'potionBig' }[] = [];
  dropLoot(px:number,py:number){
    if (Math.random()<0.12){
      const big = Math.random()<0.15;
      const spr = this.add.image(px,py, big?'icon_potion_big':'icon_potion').setDepth(py);
      this.tweens.add({ targets:spr, y:py-4, duration:500, yoyo:true, repeat:-1 });
      this.loose.push({ spr, kind: big?'potionBig':'potion' });
    }
  }

  onMonsterDead(m:AtlMonster){
    this.addExp(m.def.exp);
    G.gold += m.def.gold;
    this.floatText(m.x, m.y-26, `+${m.def.gold}G`, '#ffd34d');
    this.dropLoot(m.x, m.y);
    this.syncHud();
    if (m.boss){
      setFlag('b_'+m.def.key);
      useAtl.getState().patch({ boss:null });
      this.cameras.main.shake(260, 0.008);
      sfx.boss();
      const giveGem=(g:GemId)=>{ if(!G.gems.includes(g)){ G.gems.push(g); sfx.gem(); const gd=GEMS.find(x=>x.id===g)!; this.toast(`${gd.name} 획득!`, gd.icon); } };
      const giveRelic=(r:RelicId)=>{ if(!G.relics.includes(r)){ G.relics.push(r); sfx.relic(); const rd=relicOf(r); this.toast(`${rd.name} 획득!`, rd.icon); } };
      switch(m.def.key){
        case 'nidhogg': giveGem('forest'); if (G.stage===4){ G.stage=5; this.toast('왕에게 보고하자!'); } break;
        case 'surtr': giveGem('flame'); if (G.stage===7){ G.stage=8; this.toast('니플헤임 포탈 개방!'); } break;
        case 'fenrir': giveGem('frost'); giveRelic('bow'); if (G.stage===8){ G.stage=9; this.toast('모든 성물의 조각이 모였다…'); } break;
        case 'trollking': giveRelic('shield'); giveGem('earth'); break;
        case 'jormungand': giveRelic('necklace'); break;
        case 'elfwarden': G.potionBig++; G.gold+=60; break;
        case 'abyss': G.potionBig++; G.gold+=80; break;
        case 'flamelord': G.potionBig+=2; G.gold+=100; break;
        case 'ragnarok':
          G.stage = 11; saveNow();
          useAtl.getState().patch({ boss:null, ending:'light' });
          break;
      }
      this.checkAsgardReady();
      saveNow();
    }
    this.syncHud(true);
  }

  // ── 프레임 루프 ──
  update(time:number, delta:number){
    if (this.dead) return;
    const k = this.keysObj;
    const st = useAtl.getState();
    const uiBlock = !!st.dialog || st.invOpen || st.shopOpen;
    // 이동
    let vx=0, vy=0;
    if (!uiBlock){
      if (k.A.isDown||k.LEFT.isDown) vx=-1;
      else if (k.D.isDown||k.RIGHT.isDown) vx=1;
      if (k.W.isDown||k.UP.isDown) vy=-1;
      else if (k.S.isDown||k.DOWN.isDown) vy=1;
      if (vx&&vy){ vx*=0.72; vy*=0.72; }
    }
    this.player.move(vx,vy);
    if (vx||vy) this.facing = Math.abs(vx)>Math.abs(vy) ? (vx>0?'right':'left') : (vy>0?'down':'up');

    // 근처 인터랙션
    let near: Interact|null = null; let best = 34*34;
    for (const it of this.interactables){
      const dx = it.obj.x-this.player.x, dy = (it.obj.y-this.player.y);
      const d = dx*dx+dy*dy*2.2;
      if (d<best){ best=d; near=it; }
    }
    if (near!==this.nearInteract){
      this.nearInteract = near;
      if (this.hintObj){ this.hintObj.destroy(); this.hintObj=null; }
      if (near){
        this.hintObj = this.add.text(near.obj.x, near.obj.y-30, `[Space] ${near.hint}`,
          { fontFamily:'sans-serif', fontSize:'9px', color:'#ffe9a0', stroke:'#000000aa', strokeThickness:3 })
          .setOrigin(0.5).setDepth(9400);
      }
    }

    // 몬스터 AI
    for (const m of this.monsters) m.update(delta, time, uiBlock);

    // 투사체 수명/피격
    this.pProjectiles.children.iterate((c)=>{
      const p = c as Phaser.Physics.Arcade.Image;
      if (!p.active) return true;
      if (time > (p.getData('life') as number)){ p.destroy(); return true; }
      for (const m of this.monsters){
        if (!m.active||m.dying) continue;
        const hitset = p.getData('hitset') as Set<string>;
        if (hitset.has(m.uid)) continue;
        if (Phaser.Math.Distance.Between(p.x,p.y,m.x,m.y) < 16){
          hitset.add(m.uid);
          this.damageMonster(m, p.getData('dmg') as number);
          if (!p.getData('pierce')){ p.destroy(); return true; }
        }
      }
      return true;
    });
    this.eProjectiles.children.iterate((c)=>{
      const p = c as Phaser.Physics.Arcade.Image;
      if (!p.active) return true;
      if (time > (p.getData('life') as number)){ p.destroy(); return true; }
      if (Phaser.Math.Distance.Between(p.x,p.y,this.player.x,this.player.y) < 12){
        this.damagePlayer(p.getData('dmg') as number, p.x, p.y);
        p.destroy();
      }
      return true;
    });

    // 접촉 콜백 (항아리/드롭)
    for (const c of this.proxCbs){
      if (!c.obj.active) continue;
      if (Phaser.Math.Distance.Between(c.obj.x,c.obj.y,this.player.x,this.player.y)<c.r) c.cb();
    }
    for (let i=this.loose.length-1;i>=0;i--){
      const l = this.loose[i];
      if (Phaser.Math.Distance.Between(l.spr.x,l.spr.y,this.player.x,this.player.y)<18){
        if (l.kind==='potionBig'){ G.potionBig++; this.toast('대형 포션 획득', 'icon_potion_big'); }
        else { G.potions++; this.toast('포션 획득', 'icon_potion'); }
        l.spr.destroy(); this.loose.splice(i,1);
        sfx.pickup(); this.syncHud();
      }
    }

    // 용암 틱뎀
    this.lavaTick += delta;
    if (this.lavaTick>500){
      this.lavaTick = 0;
      const tx = Math.floor(this.player.x/16), ty = Math.floor(this.player.y/16);
      if (this.grid[ty]?.[tx]==='L' && G.eq!=='trident'){
        G.hp -= 7; sfx.hurt(); this.cameras.main.flash(90, 200, 60, 20);
        this.floatText(this.player.x, this.player.y-20, '-7', '#ff9b3d');
        this.syncHud();
        if (G.hp<=0) this.playerDie();
      }
    }
    // 재생 (목걸이 +1/2초, MP +1/2초)
    this.regenTick += delta;
    if (this.regenTick>2000){
      this.regenTick = 0;
      let dirty=false;
      if (G.eq==='necklace' && G.hp<this.maxHp()){ G.hp=Math.min(this.maxHp(),G.hp+2); dirty=true; }
      if (G.mp<this.maxMp()){ G.mp=Math.min(this.maxMp(),G.mp+1); dirty=true; }
      if (dirty) this.syncHud();
    }

    // 라그나로크 속성 순환
    if (this.boss && this.boss.def.key==='ragnarok' && this.boss.aggro){
      this.ragnaCycle += delta;
      if (this.ragnaCycle>6500){
        this.ragnaCycle = 0;
        const order: ElementId[] = ['gluttony','wrath','greed','envy','sloth','pride','chaos'];
        this.ragnaIdx = (this.ragnaIdx+1)%order.length;
        this.boss.def.attr = order[this.ragnaIdx];
        this.boss.refreshAttrChip();
        this.toast(`라그나로크 속성 변화: ${ELEMENTS[this.boss.def.attr].name}!`);
        sfx.boss();
      }
    }
  }
}
// ─────────── 엔티티 ───────────
const QUEST = ()=> QUESTS[Math.min(G.stage, QUESTS.length-1)];

class AtlPlayer extends Phaser.Physics.Arcade.Sprite {
  private attackUntil = 0;
  private moving = false;
  constructor(scene:WorldScene, x:number, y:number){
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.8);
    this.setDepth(y);
    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setSize(14, 10);
    b.setOffset(17, 36);
    scene.physics.add.collider(this, scene.blockers);
    this.play('p_walk_down');
    this.anims.pause();
  }
  move(vx:number, vy:number){
    const spd = 96;
    this.setVelocity(vx*spd, vy*spd);
    this.moving = !!(vx||vy);
  }
  playAttack(facing:string){
    this.attackUntil = (this.scene as WorldScene).time.now + 290;
    this.anims.resume();
    this.play(`p_atk_${facing==='left'?'side':facing}`, true);
    this.setFlipX(facing==='left');
  }
  knockback(sx:number, sy:number){
    const dx = this.x-sx, dy = this.y-sy;
    const d = Math.max(1, Math.hypot(dx,dy));
    this.setVelocity(dx/d*150, dy/d*150);
  }
  setTintFlash(){
    this.setTint(0xff8888);
    this.scene.time.delayedCall(140, ()=>this.clearTint());
  }
  die(){ this.play('p_die', true); this.setVelocity(0,0); }
  preUpdate(t:number, dt:number){
    super.preUpdate(t, dt);
    this.setDepth(this.y);
    const scene = this.scene as WorldScene;
    const inAtk = t < this.attackUntil;
    if (!inAtk){
      this.anims.resume();
      if (this.moving){
        const v = this.body as Phaser.Physics.Arcade.Body;
        if (Math.abs(v.velocity.x) > Math.abs(v.velocity.y)){
          this.play('p_walk_side', true); this.setFlipX(v.velocity.x<0);
        } else if (v.velocity.y<0) this.play('p_walk_up', true);
        else this.play('p_walk_down', true);
      } else {
        this.anims.pause(); this.setFrame(this.flipX?6:0); // idle: row0 f0 (side면 flip)
      }
    }
  }
}

class AtlMonster extends Phaser.Physics.Arcade.Sprite {
  uid:string; def:MonsterDef; hp:number; boss:boolean;
  aggro=false; dying=false;
  private chip:Phaser.GameObjects.Image;
  private wanderT=0; private wvx=0; private wvy=0;
  private skillCd=0; private slamCd=2200;
  private sceneRef:WorldScene;
  constructor(scene:WorldScene, type:string, x:number, y:number, boss=false){
    const def = { ...MONSTERS[type] };
    super(scene, x, y, def.sprite);
    this.uid = `${type}_${Math.floor(Math.random()*1e9)}`;
    this.def = def; this.boss = boss; this.hp = def.hp; this.sceneRef = scene;
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.8);
    this.setDepth(y);
    const sc = boss ? (def.scale ?? 3) : 1.15;
    this.setScale(sc);
    const b = this.body as Phaser.Physics.Arcade.Body;
    b.setSize(Math.max(10, 18*(sc>2?1:1)), boss?16*sc/2:12);
    b.setOffset((this.width-b.width)/2, this.height-b.height-6);
    scene.physics.add.collider(this, scene.blockers);
    scene.monsters.push(this);
    this.chip = scene.add.image(x, y-18*sc, 'coin').setScale(0.62).setDepth(y+30);
    this.refreshAttrChip();
  }
  refreshAttrChip(){
    const a = this.def.attr;
    if (!a){ this.chip.setVisible(false); return; }
    this.chip.setVisible(true);
    const c = parseInt(ELEMENTS[a].color.slice(1), 16);
    this.chip.setTint(c);
  }
  hurt(dmg:number, fromX:number, fromY:number){
    if (this.dying) return;
    this.hp -= dmg;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(90, ()=>{ if(this.active) this.clearTint(); });
    const dx=this.x-fromX, dy=this.y-fromY;
    const d = Math.max(1, Math.hypot(dx,dy));
    const kb = this.boss?40:110;
    this.setVelocity(dx/d*kb, dy/d*kb);
    if (this.hp<=0) this.kill();
    else if (this.boss){
      const st = useAtl.getState();
      if (st.boss) st.patch({ boss:{ name:this.def.name, hp:Math.max(0,this.hp), maxHp:this.def.hp, attr:this.def.attr??'' } });
    }
  }
  kill(){
    this.dying = true;
    this.chip.destroy();
    if (this.body) this.body.enable = false;
    this.sceneRef.onMonsterDead(this);
    this.scene.tweens.add({ targets:this, alpha:0, scaleX:this.scaleX*0.6, scaleY:this.scaleY*0.6, angle:90,
      duration:420, onComplete:()=>this.destroy() });
  }
  update(dt:number, time:number, uiBlock:boolean){
    if (this.dying||!this.active) return;
    const scene = this.sceneRef;
    const p = scene.player;
    if (!p) return;
    const dist = Phaser.Math.Distance.Between(this.x,this.y,p.x,p.y);
    const aggroR = this.boss?240:130;
    if (dist<aggroR && !uiBlock) this.aggro = true;
    if (dist>(this.boss?420:340)) this.aggro = false;
    const spd = this.def.spd;
    if (this.aggro && !uiBlock){
      if (this.def.ranged){
        if (dist>90){ this.setVelocity((p.x-this.x)/dist*spd, (p.y-this.y)/dist*spd); }
        else this.setVelocity(0,0);
        if (time>this.skillCd && dist<210){
          this.skillCd = time+2300;
          scene.fireProjectile(this.x,this.y,p.x-this.x,p.y-this.y,'ebolt',130,this.def.atk,2200,false,true);
          sfx.shoot();
        }
      } else {
        this.setVelocity((p.x-this.x)/dist*spd, (p.y-this.y)/dist*spd);
      }
      if (this.boss){
        if (time>this.slamCd){
          this.slamCd = time+3600;
          const tx = p.x, ty = p.y;
          const warn = scene.add.circle(tx,ty,26,0xff4a3a,0.32).setDepth(8500);
          scene.tweens.add({ targets:warn, scale:1.35, alpha:0.7, duration:850 });
          sfx.boss();
          scene.time.delayedCall(860, ()=>{
            warn.destroy();
            scene.spawnRing(tx,ty,'guard',34);
            scene.cameras.main.shake(140, 0.005);
            if (scene.player && Phaser.Math.Distance.Between(tx,ty,scene.player.x,scene.player.y)<34)
              scene.damagePlayer(this.def.atk*1.5, tx, ty);
          });
        }
      }
      if (dist<16 && time>scene.iframes) scene.damagePlayer(this.def.atk, this.x, this.y);
    } else {
      // 배회
      this.wanderT -= dt;
      if (this.wanderT<=0){
        this.wanderT = 1400+Math.random()*2200;
        if (Math.random()<0.4){ this.wvx=0; this.wvy=0; }
        else { const a = Math.random()*Math.PI*2; this.wvx=Math.cos(a)*spd*0.35; this.wvy=Math.sin(a)*spd*0.35; }
      }
      this.setVelocity(this.wvx, this.wvy);
    }
    this.setDepth(this.y);
    this.chip.setPosition(this.x, this.y - 18*(this.boss?(this.def.scale??3):1.15) - 6);
    this.chip.setDepth(this.y+30);
  }
  destroy(fromScene?:boolean){
    if (this.chip && this.chip.active) this.chip.destroy();
    super.destroy(fromScene);
  }
}
