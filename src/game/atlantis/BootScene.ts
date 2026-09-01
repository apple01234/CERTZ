import Phaser from 'phaser';
import { WORLDS } from './data';

// 아뜰란티스 — 에셋 로딩 (public/atlantis/img + public/atlantis/maps)
const IMG = '/atlantis/img';
const MAPS = '/atlantis/maps';

const NPCS = ['npc_grandma','npc_king','npc_smith','npc_fairy','npc_guard','npc_ghost','npc_mermaid','npc_sage'];
const MOBS = ['slime','rat','bat','goblin','goblin_s','wolf_blue','treant','stag','ostrich','skeleton',
  'spider_red','imp_red','impstaff','vulture','zombie','ghost','pigorc','mammoth','bear_brown','croc',
  'snakeblade','demon','demonbat','wizard','ranger'];
const BOSSES = ['nidhogg','surtr','fenrir','elfwarden','abyss','trollking','jormungand','flamelord','ragnarok'];
const GROUNDS = ['midgard','cusodia','forest','alfheim','jotunheim','jormungand','nevada','niflheim','muspelheim','asgard','svartalf'];
const TREES = ['tree_maple','tree_teal','tree_gold','tree_pine','willow','stump_willow'];
const HOUSES = ['stree_2','stree_5','stree_13','stree_16','stree_7','stree_9','stree_11','stree_14'];
const RELIC_ICONS = ['relic_sword','relic_trident','relic_ring','relic_necklace','relic_shield','relic_staff','relic_bow'];
const GEM_ICONS = ['gem_forest','gem_flame','gem_frost','gem_light','gem_dark','gem_wave','gem_earth'];
const CURSED = ['cursed_bones','cursed_meatflower','cursed_rockeye','cursed_ruins','cursed_spike','cursed_rock'];

export default class BootScene extends Phaser.Scene {
  constructor(){ super('Boot'); }

  preload(){
    (window as unknown as Record<string, unknown>).__ATL_P = 0;
    this.load.on('progress', (p:number)=>{ (window as unknown as Record<string, unknown>).__ATL_P = p; });
    this.load.on('loaderror', (f:Phaser.Loader.File)=>{ console.warn('[ATL] load fail:', f.key, f.url); });
    // JSON 타일맵 (scripts/gen_atlantis_maps.mjs 생성 — WorldScene.parseGrid 가 JSON 우선 파싱)
    for (const id of Object.keys(WORLDS)) this.load.json(`atlmap_${id}`, `${MAPS}/${id}.json`);
    // 캐릭터
    this.load.spritesheet('player', `${IMG}/characters/player.png`, { frameWidth:48, frameHeight:48 });
    for (const n of NPCS) this.load.spritesheet(n, `${IMG}/characters/${n}.png`, { frameWidth:48, frameHeight:48 });
    this.load.spritesheet('chicken', `${IMG}/characters/chicken.png`, { frameWidth:16, frameHeight:16 });
    // 몬스터/보스 (32x32 단일 이미지)
    for (const n of MOBS) this.load.image(`m_${n}`, `${IMG}/mobs/${n}.png`);
    for (const n of BOSSES) this.load.image(`b_${n}`, `${IMG}/bosses/boss_${n}.png`);
    // 타일
    for (const g of GROUNDS){
      this.load.image(`ground_${g}`, `${IMG}/tiles/ground_${g}.png`);
      this.load.spritesheet(`water_${g}`, `${IMG}/tiles/water_${g}.png`, { frameWidth:16, frameHeight:16 });
      this.load.image(`path_${g}`, `${IMG}/tiles/path_${g}.png`);
      this.load.image(`rim_${g}`, `${IMG}/tiles/rim_${g}.png`);
    }
    this.load.image('dun_floor', `${IMG}/tiles/dun_floor.png`);
    this.load.image('dun_floor2', `${IMG}/tiles/dun_floor2.png`);
    this.load.image('dun_wall', `${IMG}/tiles/dun_wall.png`);
    this.load.image('dun_wallcap', `${IMG}/tiles/dun_wallcap.png`);
    // 프롭
    for (const t of TREES) this.load.image(t, `${IMG}/props/${t}.png`);
    for (const h of HOUSES) this.load.image(h, `${IMG}/props/${h}.png`);
    this.load.spritesheet('chest', `${IMG}/props/chest.png`, { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('campfire', `${IMG}/props/campfire.png`, { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('portal', `${IMG}/props/portal.png`, { frameWidth:96, frameHeight:56 });
    this.load.image('altar', `${IMG}/props/altar.png`);
    this.load.image('fountain', `${IMG}/props/fountain.png`);
    this.load.image('pot0', `${IMG}/props/pot0.png`);
    for (const c of CURSED) this.load.image(c, `${IMG}/props/${c}.png`);
    this.load.spritesheet('decor', `${IMG}/props/decor.png`, { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('lillies', `${IMG}/props/lillies.png`, { frameWidth:16, frameHeight:16 });
    this.load.spritesheet('biome', `${IMG}/props/biome.png`, { frameWidth:16, frameHeight:16 });
    // 아이콘
    for (const r of RELIC_ICONS) this.load.image(r, `${IMG}/icons/${r}.png`);
    for (const g of GEM_ICONS) this.load.image(g, `${IMG}/icons/${g}.png`);
    for (const c of ['b','g','r']) this.load.image(`rune_${c}`, `${IMG}/icons/rune_${c}.png`);
    for (const g of ['fire','ice','dark']) this.load.image(`gate_${g}`, `${IMG}/icons/gate_${g}.png`);
    this.load.image('key', `${IMG}/icons/key.png`);
    this.load.image('exclaim', `${IMG}/icons/exclaim.png`);
    this.load.image('qmark', `${IMG}/icons/qmark.png`);
    this.load.image('icon_potion', `${IMG}/icons/potion.png`);
    this.load.image('icon_potion_big', `${IMG}/icons/potion_big.png`);
  }

  create(){
    // 플레이어 애니메이션 (48x48 시트: 행0 걷기DOWN / 행1 SIDE / 행2 UP / 행3-5 달리기 / 행6-8 공격 / 행9 사망)
    const a = this.anims;
    const mk = (key:string, row:number, cols:number[], fps:number, repeat=-1)=>{
      if (a.exists(key)) return;
      a.create({ key, frames: a.generateFrameNumbers('player', { frames: cols.map(c=>row*6+c) }), frameRate: fps, repeat });
    };
    mk('p_walk_down', 0, [0,1,2,3], 8);
    mk('p_walk_side', 1, [0,1,2,3], 8);
    mk('p_walk_up',   2, [0,1,2,3], 8);
    mk('p_run_down',  3, [0,1,2,3,4,5], 12);
    mk('p_run_side',  4, [0,1,2,3,4,5], 12);
    mk('p_run_up',    5, [0,1,2,3,4,5], 12);
    mk('p_atk_down',  6, [0,1,2,3], 14, 0);
    mk('p_atk_side',  7, [0,1,2,3], 14, 0);
    mk('p_atk_up',    8, [0,1,2,3], 14, 0);
    mk('p_die',       9, [0,1,2], 6, 0);
    // NPC idle (row0 2프레임)
    for (const n of NPCS){
      if (a.exists(`${n}_idle`)) continue;
      a.create({ key:`${n}_idle`, frames: a.generateFrameNumbers(n, { frames:[0,1] }), frameRate:2, repeat:-1 });
    }
    if (!a.exists('portal_spin'))
      a.create({ key:'portal_spin', frames: a.generateFrameNumbers('portal', { frames:[0,1,2,3,4,5,6,7] }), frameRate:10, repeat:-1 });
    if (!a.exists('campfire_burn'))
      a.create({ key:'campfire_burn', frames: a.generateFrameNumbers('campfire', { frames:[0,1,2,3] }), frameRate:8, repeat:-1 });
    if (!a.exists('chest_open'))
      a.create({ key:'chest_open', frames: a.generateFrameNumbers('chest', { frames:[0,1,2,3] }), frameRate:10, repeat:0 });

    this.scene.start('World', { world:'midgard', entry:'new' });
  }
}
