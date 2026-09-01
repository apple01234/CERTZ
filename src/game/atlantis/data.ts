// 아뜰란티스: 잠뜰의 인어 — 게임 데이터 (9세계 / 7성물 상성 / 7보석 / 스토리)
// 맵 레전드: #=경계/암벽(벽) .=풀 ,=풀변형 p=길 ~=물(벽) L=용암(통과·틱뎀) W=동굴벽 f=동굴바닥
// 짧은 행은 씬 빌더가 '#'로 자동 패딩한다.

export type ElementId = 'gluttony'|'wrath'|'greed'|'envy'|'sloth'|'pride'|'chaos';
export type RelicId = 'rust'|'sword'|'trident'|'ring'|'necklace'|'shield'|'staff'|'bow';
export type GemId = 'forest'|'flame'|'frost'|'light'|'dark'|'wave'|'earth';

export const ELEMENTS: Record<ElementId, {name:string; color:string}> = {
  gluttony: { name:'탐식', color:'#7ddb6f' },
  wrath:    { name:'분노', color:'#ff6b5a' },
  greed:    { name:'탐욕', color:'#ffc14d' },
  envy:     { name:'질투', color:'#c07ef5' },
  sloth:    { name:'나태', color:'#e8d99b' },
  pride:    { name:'오만', color:'#ffd700' },
  chaos:    { name:'혼돈', color:'#6fd8e8' },
};

export interface RelicDef {
  id: RelicId; name: string; icon: string; counters: ElementId | null;
  atk: number; type: 'melee'|'thrust'|'pulse'|'shot'; cd: number;
  desc: string; skill: { name:string; mp:number; desc:string };
}

export const RELICS: RelicDef[] = [
  { id:'rust',    name:'녹슨 검',       icon:'relic_sword',  counters:null,      atk:6,  type:'melee',  cd:380, desc:'할머니의 유품. 낡았다.', skill:{name:'전력 베기', mp:10, desc:'전방 강베기'} },
  { id:'sword',   name:'절제의 검',     icon:'relic_sword',  counters:'gluttony',atk:14, type:'melee',  cd:340, desc:'탐식을 베는 녹색 성검 (2.2배)', skill:{name:'회전참격', mp:14, desc:'주변 전체 참격'} },
  { id:'trident', name:'인내의 삼지창', icon:'relic_trident',counters:'wrath',   atk:17, type:'thrust', cd:420, desc:'분노를 꿰뚫는 성창 (2.2배) · 용암 면역', skill:{name:'돌진 꿰뚫기', mp:14, desc:'돌진 관통'} },
  { id:'ring',    name:'순결의 반지',   icon:'relic_ring',   counters:'chaos',   atk:11, type:'pulse',  cd:520, desc:'혼돈을 정화하는 은반지 (2.2배) · 불길 결계 통과', skill:{name:'정화 신성', mp:18, desc:'광역 정화 폭발'} },
  { id:'necklace',name:'자선의 목걸이', icon:'relic_necklace',counters:'envy',   atk:9,  type:'melee',  cd:360, desc:'질투를 녹이는 목걸이 (2.2배) · HP 재생, 어둠 결계 통과', skill:{name:'은총 치유', mp:20, desc:'HP 35% 회복'} },
  { id:'shield',  name:'겸손의 방패',   icon:'relic_shield', counters:'pride',   atk:10, type:'melee',  cd:400, desc:'오만을 받아내는 용골 방패 (2.2배) · 피해 25% 감소', skill:{name:'방어 태세', mp:12, desc:'3초 피해 75% 감소'} },
  { id:'staff',   name:'근면의 지팡이', icon:'relic_staff',  counters:'sloth',   atk:12, type:'shot',   cd:300, desc:'나태를 태우는 지팡이 (2.2배) · 원거리, 얼음 결계 해동', skill:{name:'유성 소환', mp:18, desc:'전방 유성 폭발'} },
  { id:'bow',     name:'희망의 활',     icon:'relic_bow',    counters:'greed',   atk:15, type:'shot',   cd:260, desc:'탐욕을 관통하는 얼음 활 (2.2배)', skill:{name:'관통 냉화살', mp:12, desc:'관통 화살'} },
];

export const relicOf = (id: RelicId): RelicDef => RELICS.find(r=>r.id===id)!;

export const GEMS: { id:GemId; name:string; icon:string; where:string }[] = [
  { id:'forest', name:'숲의 보석',  icon:'gem_forest', where:'쿠소디아 숲 — 니드호그' },
  { id:'flame',  name:'화염의 보석',icon:'gem_flame',  where:'네바다 — 수르트' },
  { id:'frost',  name:'서리의 보석',icon:'gem_frost',  where:'니플헤임 — 펜리르' },
  { id:'light',  name:'빛의 보석',  icon:'gem_light',  where:'알프헤임 — 룬의 비밀' },
  { id:'dark',   name:'어둠의 보석',icon:'gem_dark',   where:'스바르트알프헤임 — 금고' },
  { id:'wave',   name:'파도의 보석',icon:'gem_wave',   where:'요르문간드 — 뱃사람 뒤' },
  { id:'earth',  name:'대지의 보석',icon:'gem_earth',  where:'요툰헤임 — 돌거인 왕' },
];

export interface MonsterDef {
  key:string; sprite:string; name:string; hp:number; atk:number; spd:number;
  attr: ElementId | null; exp:number; gold:number; scale?:number; ranged?:boolean; boss?:boolean;
}

export const MONSTERS: Record<string, MonsterDef> = {
  slime:    { key:'slime',    sprite:'m_slime',    name:'슬라임',        hp:22,  atk:5,  spd:38, attr:'chaos',    exp:6,  gold:3 },
  rat:      { key:'rat',      sprite:'m_rat',      name:'들쥐',          hp:16,  atk:4,  spd:55, attr:'gluttony', exp:5,  gold:2 },
  bat:      { key:'bat',      sprite:'m_bat',      name:'박쥐',          hp:18,  atk:5,  spd:70, attr:'chaos',    exp:6,  gold:3 },
  goblin:   { key:'goblin',   sprite:'m_goblin',   name:'고블린',        hp:34,  atk:8,  spd:52, attr:'gluttony', exp:10, gold:6 },
  goblin_s: { key:'goblin_s', sprite:'m_goblin_s', name:'고블린 꼬마',    hp:22,  atk:6,  spd:66, attr:'gluttony', exp:8,  gold:4 },
  wolf:     { key:'wolf',     sprite:'m_wolf_blue',name:'숲이리',        hp:40,  atk:10, spd:78, attr:'wrath',    exp:13, gold:7 },
  treant:   { key:'treant',   sprite:'m_treant',   name:'나무정령',      hp:55,  atk:11, spd:30, attr:'sloth',    exp:15, gold:9 },
  stag:     { key:'stag',     sprite:'m_stag',     name:'빛사슴',        hp:45,  atk:9,  spd:70, attr:'chaos',    exp:13, gold:8 },
  ostrich:  { key:'ostrich',  sprite:'m_ostrich',  name:'타조기사',      hp:50,  atk:11, spd:74, attr:'pride',    exp:14, gold:8 },
  skeleton: { key:'skeleton', sprite:'m_skeleton', name:'해골병사',      hp:48,  atk:11, spd:48, attr:'chaos',    exp:15, gold:9 },
  spider:   { key:'spider',   sprite:'m_spider_red',name:'굴거미',       hp:40,  atk:12, spd:62, attr:'envy',     exp:14, gold:8 },
  imp:      { key:'imp',      sprite:'m_imp_red',  name:'붉은 임프',     hp:52,  atk:13, spd:60, attr:'wrath',    exp:16, gold:10 },
  impstaff: { key:'impstaff', sprite:'m_impstaff', name:'임프 술사',     hp:44,  atk:14, spd:44, attr:'wrath',    exp:17, gold:11, ranged:true },
  vulture:  { key:'vulture',  sprite:'m_vulture',  name:'독수리',        hp:46,  atk:12, spd:72, attr:'sloth',    exp:15, gold:9 },
  zombie:   { key:'zombie',   sprite:'m_zombie',   name:'얼어붙은 좀비',  hp:70,  atk:15, spd:34, attr:'greed',    exp:20, gold:12 },
  ghost:    { key:'ghost',    sprite:'m_ghost',    name:'원한',          hp:55,  atk:16, spd:56, attr:'envy',     exp:20, gold:12 },
  pigorc:   { key:'pigorc',   sprite:'m_pigorc',   name:'돼지오크',      hp:90,  atk:17, spd:46, attr:'pride',    exp:24, gold:14 },
  mammoth:  { key:'mammoth',  sprite:'m_mammoth',  name:'맘모스',        hp:120, atk:19, spd:36, attr:'sloth',    exp:28, gold:16 },
  bear:     { key:'bear',     sprite:'m_bear_brown',name:'황금곰',       hp:100, atk:18, spd:52, attr:'gluttony', exp:25, gold:15 },
  croc:     { key:'croc',     sprite:'m_croc',     name:'바다악어',      hp:95,  atk:18, spd:50, attr:'envy',     exp:26, gold:15 },
  snake:    { key:'snake',    sprite:'m_snakeblade',name:'뱀전사',       hp:90,  atk:19, spd:58, attr:'envy',     exp:27, gold:16 },
  demon:    { key:'demon',    sprite:'m_demon',    name:'화염악마',      hp:110, atk:21, spd:60, attr:'wrath',    exp:32, gold:18 },
  demonbat: { key:'demonbat', sprite:'m_demonbat', name:'화염박쥐',      hp:85,  atk:20, spd:80, attr:'wrath',    exp:30, gold:16 },
  wizard:   { key:'wizard',   sprite:'m_wizard',   name:'아스가르드 술사',hp:120, atk:22, spd:48, attr:'pride',   exp:36, gold:20, ranged:true },
  ranger:   { key:'ranger',   sprite:'m_ranger',   name:'심연 순찰자',    hp:115, atk:22, spd:64, attr:'envy',     exp:35, gold:19 },
  // ---- 보스 ----
  nidhogg:   { key:'nidhogg',   sprite:'b_nidhogg',   name:'니드호그 [탐식]',     hp:260,  atk:14, spd:44, attr:'gluttony', exp:120, gold:80,  scale:3,   boss:true },
  surtr:     { key:'surtr',     sprite:'b_surtr',     name:'수르트 [분노]',       hp:520,  atk:22, spd:40, attr:'wrath',    exp:300, gold:160, scale:3.4, boss:true },
  fenrir:    { key:'fenrir',    sprite:'b_fenrir',    name:'펜리르 [탐욕]',       hp:760,  atk:27, spd:66, attr:'greed',    exp:520, gold:240, scale:3.4, boss:true },
  elfwarden: { key:'elfwarden', sprite:'b_elfwarden', name:'빛의 수호천사 [오만]', hp:300,  atk:15, spd:52, attr:'pride',    exp:130, gold:90,  scale:3,   boss:true },
  abyss:     { key:'abyss',     sprite:'b_abyss',     name:'심연의 기사 [혼돈]',   hp:340,  atk:17, spd:50, attr:'chaos',    exp:160, gold:110, scale:3,   boss:true },
  trollking: { key:'trollking', sprite:'b_trollking', name:'돌거인 왕 [오만]',    hp:480,  atk:22, spd:36, attr:'pride',    exp:280, gold:150, scale:3.6, boss:true },
  jormungand:{ key:'jormungand',sprite:'b_jormungand',name:'뱀신 요르문간드 [질투]',hp:560, atk:24, spd:48, attr:'envy',     exp:380, gold:190, scale:3.6, boss:true },
  flamelord: { key:'flamelord', sprite:'b_flamelord', name:'화염 군주 [분노]',    hp:640,  atk:28, spd:56, attr:'wrath',    exp:460, gold:220, scale:3.4, boss:true },
  ragnarok:  { key:'ragnarok',  sprite:'b_ragnarok',  name:'라그나로크의 그림자',  hp:1400, atk:32, spd:46, attr:'chaos',    exp:999, gold:500, scale:3.8, boss:true },
};

export interface ZoneDef { x:number;y:number;w:number;h:number;types:string[];count:number }
export interface NpcDef { id:string;x:number;y:number;sprite:string;name:string }
export interface PortalDef { id:string;to:string;x:number;y:number;label:string;needMsg?:string;activeFlag?:string }
export interface ChestDef { id:string;x:number;y:number;loot:{gold?:number;potion?:number;potionBig?:number;key?:number;relic?:RelicId;gem?:GemId};hidden?:boolean }
export interface GateDef { id:string;x:number;y:number;kind:'fire'|'ice'|'dark';need:RelicId;msg:string }
export interface RuneDef { id:string;x:number;y:number;color:'b'|'g'|'r' }
export interface HouseDef { img:string;x:number;y:number }

export interface WorldDef {
  id:string; name:string; sub:string; ground:string; size:[number,number];
  tint:number; map:string[];
  spawn:{ x:number;y:number };
  npcs:NpcDef[]; portals:PortalDef[]; chests:ChestDef[];
  gates?:GateDef[]; runes?:RuneDef[]; houses?:HouseDef[];
  zones:ZoneDef[]; boss?:{ type:string;x:number;y:number };
  trees?:'fm'|'none'|'pine'; ambience?:string; dungeon?:boolean;
}

// 동굴 맵 생성기 (스바르트알프헤임)
function dungeonMap(w:number, h:number, rooms:[number,number,number,number][], corridors:[number,number,number,number][]): string[] {
  const g: string[][] = [];
  for (let y=0;y<h;y++){ const row:string[]=[]; for(let x=0;x<w;x++){
    const edge = x===0||y===0||x===w-1||y===h-1 || x===1||y===1||x===w-2||y===h-2;
    row.push(edge?'#':'W');
  } g.push(row); }
  const carve=(x:number,y:number)=>{ if(x>1&&y>1&&x<w-2&&y<h-2) g[y][x]='f'; };
  for (const [rx,ry,rw,rh] of rooms)
    for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) carve(x,y);
  for (const [x1,y1,x2,y2] of corridors){
    const dx = Math.sign(x2-x1), dy = Math.sign(y2-y1);
    let x=x1,y=y1;
    carve(x,y);carve(x+1,y);
    while(x!==x2||y!==y2){ if(x!==x2)x+=dx; else y+=dy; carve(x,y); carve(x+ (dx===0?1:0), y); }
  }
  return g.map(r=>r.join(''));
}

const SV_ROOMS: [number,number,number,number][] = [
  [3,3,12,5],[19,3,10,5],[33,3,8,5],
  [3,11,9,6],[16,10,12,6],[32,11,9,6],
  [3,19,12,4],[19,18,10,5],[33,19,8,4],
];
const SV_CORR: [number,number,number,number][] = [
  [8,7,8,11],[23,7,23,10],[37,7,37,11],
  [12,13,16,13],[28,13,32,13],
  [8,16,8,19],[23,15,23,18],[37,16,37,19],
];

const HUB_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##....,,,,,,,,....................,,,,....##',
  '##....,,,,,,,,....................,,,,....##',
  '##........................................##',
  '##..............ppppppppp................##',
  '##..............ppppppppp................##',
  '##....,,,,,,,,..ppppppppp......,,,,,,....##',
  '##....,,,,,,,,..ppppppppp......,,,,,,....##',
  '##..............ppppppppp................##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##........ppppppppppppppppppppp..........##',
  '##..............ppppppppp................##',
  '##....,,,,,,,,..ppppppppp......,,,,,,....##',
  '##....,,,,,,,,..ppppppppp......,,,,,,....##',
  '##..............ppppppppp................##',
  '##..............ppppppppp................##',
  '##..................ppp...................##',
  '##........................................##',
  '############################################',
];

const MIDGARD_MAP = [
  '########################################',
  '########################################',
  '##....................................##',
  '##..,,,,........................,,....##',
  '##..,,,,........................,,....##',
  '##................pppp.................##',
  '##................pppp.................##',
  '##....,,,,......pppppppp......,,,,.....##',
  '##....,,,,......pppppppp......,,,,.....##',
  '##................pppp.................##',
  '##....,,,,,,,,..pppppppp..,,,,,,,,.....##',
  '##....,,,,,,,,..pppppppp..,,,,,,,,.....##',
  '##................pppp.................##',
  '##........pppppppppppppppp.............##',
  '##........pppppppppppppppp.............##',
  '##....,,,,pppppppppppppppp,,,,,,,,.....##',
  '##....,,,,pppppppppppppppp,,,,,,,,.....##',
  '##........pppppppppppppppp.............##',
  '##........pppppppppppppppp~~~~........##',
  '##........pppppppppppppppp~~~~........##',
  '##....,,,,,,,,,,pppppp,,,,~~~~.........##',
  '##....,,,,,,,,,,pppppp,,,,~~~~.........##',
  '##................pppp....~~~~.........##',
  '##................pppp....~~~~.........##',
  '##....................................##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '########################################',
];

const FOREST_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##....,,,,,,,,....ppp....,,,,,,,,,,,,,,,,##',
  '##....,,,,,,,,....ppp....,,,,,,,,,,,,,,,,##',
  '##................ppp....,,,,,,,,,,,,,,,,##',
  '##................ppp....,,,,,,,,,,,,,,,,##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##................ppp.....................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '############################################',
  '############################################',
  '############################################',
];

const ALFHEIM_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##........,,,,............................##',
  '##........,,,,............................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........pppppppppppppppppp..............##',
  '##........pppppppppppppppppp..............##',
  '##........pp..............pp..............##',
  '##........pp..............pp..............##',
  '##........pp....,,,,,.....pp..............##',
  '##........pp....,,,,,.....pp..............##',
  '##........pp..............pp..............##',
  '##........pp..............pp..............##',
  '##........pppppp....pppppppp..............##',
  '##........pppppp....pppppppp..............##',
  '##........................................##',
  '##........................................##',
  '##...,,,,..........................,,,,..##',
  '##...,,,,..........................,,,,..##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '############################################',
  '############################################',
];

const NEVADA_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##...LLL..........................LLL....##',
  '##...LLL..........................LLL....##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##....LL........pppppppp........LL.......##',
  '##....LL........pppppppp........LL.......##',
  '##................pppp....................##',
  '##..,,,,,,,,....pppppppp....,,,,,,,,.....##',
  '##..,,,,,,,,....pppppppp....,,,,,,,,.....##',
  '##................pppp....................##',
  '##........pppppppppppppppppp.............##',
  '##........pppppppppppppppppp.............##',
  '########################ppppp##############',
  '########################ppppp##############',
  '##........pppppppppppppppppp.............##',
  '##........pppppppppppppppppp.............##',
  '##..LLL....pppppppppppppppppp......LLL...##',
  '##..LLL....pppppppppppppppppp......LLL...##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##........................................##',
  '##...LLLL.........................LLLL...##',
  '##...LLLL.........................LLLL...##',
  '##........................................##',
  '############################################',
  '############################################',
];

const NIFLHEIM_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##~~~............................~~~~....##',
  '##~~~............................~~~~....##',
  '##~~~~........pppp..............~~~~~~...##',
  '##~~~~........pppp..............~~~~~~...##',
  '##............pppp....................~~~~##',
  '##....,,,,....pppp....,,,,,,,,........~~~~##',
  '##....,,,,....pppp....,,,,,,,,........~~~~##',
  '##............pppp....................~~~~##',
  '##....pppppppppppppppppp................##',
  '##....pppppppppppppppppp................##',
  '####################pppp####################',
  '####################pppp####################',
  '##........pppppppppppppppppp............##',
  '##........pppppppppppppppppp............##',
  '##~~~~....pppppppppppppppppp......~~~~..##',
  '##~~~~....pppppppppppppppppp......~~~~..##',
  '##............pppp......................##',
  '##............pppp......................##',
  '##~~~~~~~~....pppp............~~~~~~~~..##',
  '##~~~~~~~~....pppp............~~~~~~~~..##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '############################################',
  '############################################',
  '############################################',
];

const JOTUNHEIM_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##....,,,,....pppppppppp....,,,,.........##',
  '##....,,,,....pppppppppp....,,,,.........##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##....,,,,,,,,pppppppppppp,,,,,,,,.......##',
  '##....,,,,,,,,pppppppppppp,,,,,,,,.......##',
  '##............pppppppppppp...............##',
  '##............pppppppppppp...............##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....pppp,,,,,,pppppp,,,,,,pppp.........##',
  '##....pppp,,,,,,pppppp,,,,,,pppp.........##',
  '##............pppppppppppp...............##',
  '##............pppppppppppp...............##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '############################################',
  '############################################',
];

const JORMUNGAND_MAP = [
  '############################################',
  '############################################',
  '##~~~~~,,,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,##',
  '##~~~~~,,,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,##',
  '##~~~~~,,,,,,,,,,,,,,,,,,BBBBB,,,,,,,,,,,,##',
  '##~~~~~,,,,,,,,,,,,,,,,,,BBBBB,,,,,,,,,,,,##',
  '##~~~~~,,,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,##',
  '##~~~~~,,,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~BB~~~~~~~~~~~~~~~~##',
  '##,,,,,,,,,,,,,,,,,,,,,BB,,,,,,,,,,,,,,,,##',
  '##,,,,,,,,,,,,,,,,,,,,,BB,,,,,,,,,,,,,,,,##',
  '##,,,,,,,,,~~~~~,,,,,,BB,,,,,,~~~~~,,,,,,##',
  '##,,,,,,,,~~~~~~~,,,,,,,,,,,~~~~~~~,,,,,,##',
  '##,,,,,,,,~~~~~~~,,,,,,,,,,,~~~~~~~,,,,,,##',
  '##,,,,,,,,,~~~~~,,,,,,,,,,,,~~~~~,,,,,,,,##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
  '############################################',
];

const MUSPELHEIM_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##..LLLL..........................LLLL...##',
  '##..LLLL..........................LLLL...##',
  '##..LLLL..........................LLLL...##',
  '###################ppppp###################',
  '###################ppppp###################',
  '##....LLLL....pppppppppp....LLLL.........##',
  '##....LLLL....pppppppppp....LLLL.........##',
  '##....LLLL....pppppppppp....LLLL.........##',
  '##................pppp....................##',
  '##..,,,,,,,,....pppppppp....,,,,,,,,.....##',
  '##..,,,,,,,,....pppppppp....,,,,,,,,.....##',
  '##................pppp....................##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....ppppLLLLLLLLLLppppp,,,,,,,.........##',
  '##....ppppLLLLLLLLLLppppp,,,,,,,.........##',
  '##........LLLLLLLLLL.....................##',
  '##........LLLLLLLLLL.....................##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##........................................##',
  '##..LLLL.........................LLLL....##',
  '##..LLLL.........................LLLL....##',
  '############################################',
  '############################################',
  '############################################',
];

const ASGARD_MAP = [
  '############################################',
  '############################################',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##..............pppppppp..................##',
  '##..............pppppppp..................##',
  '##................pppp....................##',
  '##....,,,,,,,,pppppppppppp,,,,,,,,.......##',
  '##....,,,,,,,,pppppppppppp,,,,,,,,.......##',
  '##............pppppppppppp...............##',
  '##............pppppppppppp...............##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....ppppppppppppppppppppppppp..........##',
  '##....pppp,,,,,,pppppp,,,,,,pppp.........##',
  '##....pppp,,,,,,pppppp,,,,,,pppp.........##',
  '##............pppppppppppp...............##',
  '##............pppppppppppp...............##',
  '##................pppp....................##',
  '##................pppp....................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '##........................................##',
  '############################################',
  '############################################',
];

export const WORLDS: Record<string, WorldDef> = {
  hub: {
    id:'hub', name:'쿠소디아 왕국', sub:'9개 세계로 통하는 포탈의 도시',
    ground:'cusodia', size:[44,30], tint:0x88ccaa, map:HUB_MAP, spawn:{x:22,y:20},
    trees:'fm', ambience:'#a5e8c0',
    npcs:[
      { id:'king',     x:22, y:7,  sprite:'npc_king',   name:'쿠소디아 왕' },
      { id:'merchant', x:16, y:15, sprite:'npc_smith',  name:'상인 두르바' },
      { id:'fairy',    x:26, y:15, sprite:'npc_fairy',  name:'요정 리란' },
      { id:'guard1',   x:18, y:11, sprite:'npc_guard',  name:'왕국 근위병' },
      { id:'guard2',   x:26, y:11, sprite:'npc_guard',  name:'왕국 근위병' },
    ],
    portals:[
      { id:'p_midgard', to:'midgard',   x:15, y:14, label:'미드가르드' },
      { id:'p_alfheim', to:'alfheim',   x:19, y:14, label:'알프헤임' },
      { id:'p_svartalf',to:'svartalf',  x:23, y:14, label:'스바르트알프헤임' },
      { id:'p_nevada',  to:'nevada',    x:27, y:14, label:'네바다' },
      { id:'p_niflheim',to:'niflheim',  x:29, y:19, label:'니플헤임', activeFlag:'nevada_done', needMsg:'니플헤임의 추위가 뼈를 파고든다… (네바다의 수르트 격파 후 열린다)' },
      { id:'p_jotun',   to:'jotunheim', x:25, y:21, label:'요툰헤임' },
      { id:'p_jormun',  to:'jormungand',x:21, y:21, label:'요르문간드' },
      { id:'p_muspel',  to:'muspelheim',x:17, y:21, label:'무스펠하임' },
      { id:'p_asgard',  to:'asgard',    x:13, y:19, label:'아스가르드', activeFlag:'asgard_open', needMsg:'성물 7개와 보석 7개가 필요하다' },
      { id:'p_forest',  to:'forest',    x:22, y:27, label:'쿠소디아 숲' },
    ],
    chests:[ { id:'hub_c1', x:10, y:24, loot:{gold:30, potion:1} }, { id:'hub_c2', x:33, y:9, loot:{potion:1} } ],
    houses:[
      { img:'stree_2',  x:7,  y:5 }, { img:'stree_5',  x:33, y:5 },
      { img:'stree_13', x:5,  y:22 }, { img:'stree_16', x:35, y:22 },
    ],
    zones:[],
  },
  midgard: {
    id:'midgard', name:'미드가르드', sub:'인간들의 세상 — 당신의 고향',
    ground:'midgard', size:[40,28], tint:0xa8e0a0, map:MIDGARD_MAP, spawn:{x:20,y:12},
    trees:'fm', ambience:'#b8ecae',
    npcs:[
      { id:'grandma', x:16, y:8,  sprite:'npc_grandma', name:'할머니' },
      { id:'grave',   x:24, y:8,  sprite:'altar',       name:'할머니의 묘비' },
      { id:'mermaid', x:24, y:22, sprite:'npc_mermaid', name:'인어 소녀' },
    ],
    portals:[ { id:'back', to:'hub', x:20, y:4, label:'쿠소디아' } ],
    chests:[ { id:'mg_c1', x:8,  y:22, loot:{potion:1} }, { id:'mg_c2', x:33, y:5, loot:{gold:20} } ],
    zones:[
      { x:5, y:18, w:8, h:5, types:['slime','rat'], count:4 },
      { x:27, y:13, w:8, h:5, types:['slime','bat'], count:3 },
    ],
  },
  forest: {
    id:'forest', name:'쿠소디아 숲', sub:'니드호그가 삼킨 숲',
    ground:'forest', size:[44,30], tint:0x7ab86a, map:FOREST_MAP, spawn:{x:20,y:26},
    trees:'fm', ambience:'#8fc98a',
    npcs:[ { id:'forestfairy', x:20, y:23, sprite:'npc_fairy', name:'숲의 요정' } ],
    portals:[ { id:'back', to:'hub', x:20, y:25, label:'쿠소디아' } ],
    chests:[ { id:'fo_c1', x:8, y:6, loot:{potion:2, gold:40} }, { id:'fo_c2', x:36, y:24, loot:{key:1} } ],
    zones:[
      { x:6, y:10, w:12, h:10, types:['goblin','goblin_s'], count:5 },
      { x:26, y:10, w:12, h:10, types:['wolf','goblin'], count:4 },
    ],
    boss:{ type:'nidhogg', x:20, y:8 },
  },
  alfheim: {
    id:'alfheim', name:'알프헤임', sub:'빛의 숲 — 룬의 비밀',
    ground:'alfheim', size:[44,30], tint:0xd8f0a8, map:ALFHEIM_MAP, spawn:{x:21,y:26},
    trees:'fm', ambience:'#e8f5b8',
    npcs:[ { id:'elfelder', x:26, y:20, sprite:'npc_fairy', name:'엘프 장로' } ],
    portals:[ { id:'back', to:'hub', x:21, y:27, label:'쿠소디아' } ],
    chests:[
      { id:'al_c1', x:8, y:8,  loot:{potion:1, gold:50} },
      { id:'al_ring', x:21, y:13, loot:{relic:'ring'} },
      { id:'al_gem', x:21, y:15, loot:{gem:'light'}, hidden:true },
    ],
    runes:[
      { id:'rune1', x:17, y:14, color:'b' },
      { id:'rune2', x:21, y:17, color:'g' },
      { id:'rune3', x:25, y:14, color:'r' },
    ],
    zones:[
      { x:5, y:5, w:12, h:8, types:['treant','stag'], count:5 },
      { x:28, y:5, w:12, h:8, types:['stag','ostrich'], count:4 },
    ],
    boss:{ type:'elfwarden', x:21, y:6 },
  },
  svartalf: {
    id:'svartalf', name:'스바르트알프헤임', sub:'어둠의 동굴 — 드워프의 금고',
    ground:'svartalf', size:[44,26], tint:0x6a5a8a, map:dungeonMap(44,26,SV_ROOMS,SV_CORR), spawn:{x:23,y:21},
    trees:'none', ambience:'#8a7ab0', dungeon:true,
    npcs:[ { id:'smith', x:26, y:20, sprite:'npc_smith', name:'대장장이 브록' } ],
    portals:[ { id:'back', to:'hub', x:23, y:22, label:'쿠소디아' } ],
    chests:[
      { id:'sv_k1', x:5, y:4,  loot:{key:1, gold:30} },
      { id:'sv_k2', x:38, y:4, loot:{key:1, potion:1} },
      { id:'sv_vault', x:23, y:5, loot:{relic:'staff', gem:'dark'} },
      { id:'sv_c1', x:38, y:21, loot:{potionBig:1} },
    ],
    zones:[
      { x:4, y:11, w:8, h:5, types:['skeleton','bat'], count:4 },
      { x:17, y:11, w:10, h:4, types:['spider','skeleton'], count:4 },
      { x:33, y:12, w:8, h:4, types:['bat','spider'], count:3 },
    ],
    boss:{ type:'abyss', x:22, y:12 },
  },
  nevada: {
    id:'nevada', name:'네바다', sub:'불타는 사막 — 수르트의 화산',
    ground:'nevada', size:[44,30], tint:0xe8c890, map:NEVADA_MAP, spawn:{x:21,y:26},
    trees:'none', ambience:'#f0d8a8',
    npcs:[ { id:'sage', x:19, y:25, sprite:'npc_sage', name:'잿빛 현자' } ],
    portals:[ { id:'back', to:'hub', x:21, y:28, label:'쿠소디아' } ],
    chests:[ { id:'nv_c1', x:7, y:6, loot:{potion:2} }, { id:'nv_c2', x:36, y:26, loot:{gold:80} } ],
    gates:[
      { id:'gate1', x:24, y:16, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate2', x:25, y:16, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate3', x:26, y:16, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate4', x:27, y:16, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate5', x:28, y:16, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate6', x:24, y:17, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate7', x:25, y:17, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate8', x:26, y:17, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate9', x:27, y:17, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
      { id:'gate10', x:28, y:17, kind:'fire', need:'ring', msg:'불길의 결계 — 순결의 반지를 장착하면 정화된다' },
    ],
    zones:[
      { x:5, y:20, w:12, h:6, types:['imp','vulture'], count:5 },
      { x:27, y:20, w:12, h:6, types:['impstaff','imp'], count:5 },
      { x:6, y:5, w:12, h:7, types:['imp','impstaff'], count:3 },
      { x:27, y:5, w:12, h:7, types:['vulture','imp'], count:3 },
    ],
    boss:{ type:'surtr', x:22, y:9 },
  },
  niflheim: {
    id:'niflheim', name:'니플헤임', sub:'얼어붙은 죽음의 땅 — 펜리르',
    ground:'niflheim', size:[44,30], tint:0xb8d8f0, map:NIFLHEIM_MAP, spawn:{x:21,y:25},
    trees:'pine', ambience:'#c8e4f8',
    npcs:[ { id:'ghostgirl', x:25, y:24, sprite:'npc_ghost', name:'얼어붙은 소녀' } ],
    portals:[ { id:'back', to:'hub', x:20, y:24, label:'쿠소디아' } ],
    chests:[ { id:'nf_c1', x:8, y:6, loot:{potionBig:1} }, { id:'nf_c2', x:34, y:4, loot:{gold:100} } ],
    gates:[
      { id:'gate1', x:20, y:15, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate2', x:21, y:15, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate3', x:22, y:15, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate4', x:23, y:15, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate5', x:20, y:16, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate6', x:21, y:16, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate7', x:22, y:16, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
      { id:'gate8', x:23, y:16, kind:'ice', need:'staff', msg:'얼음 결계 — 근면의 지팡이의 열기로 녹일 수 있다' },
    ],
    zones:[
      { x:6, y:18, w:12, h:5, types:['zombie','ghost'], count:5 },
      { x:27, y:18, w:12, h:5, types:['ghost','zombie'], count:4 },
      { x:6, y:5, w:12, h:6, types:['zombie'], count:3 },
      { x:27, y:5, w:12, h:6, types:['ghost'], count:3 },
    ],
    boss:{ type:'fenrir', x:21, y:9 },
  },
  jotunheim: {
    id:'jotunheim', name:'요툰헤임', sub:'거인의 황금 평원',
    ground:'jotunheim', size:[44,30], tint:0xe8d88a, map:JOTUNHEIM_MAP, spawn:{x:21,y:26},
    trees:'fm', ambience:'#f0e0a0',
    npcs:[ { id:'giant', x:25, y:24, sprite:'npc_guard', name:'거인족 전사' } ],
    portals:[ { id:'back', to:'hub', x:21, y:27, label:'쿠소디아' } ],
    chests:[ { id:'jt_c1', x:8, y:6, loot:{potion:2, gold:60} }, { id:'jt_c2', x:35, y:22, loot:{potionBig:1} } ],
    zones:[
      { x:5, y:20, w:12, h:6, types:['pigorc','bear'], count:5 },
      { x:27, y:20, w:12, h:6, types:['mammoth','pigorc'], count:4 },
      { x:6, y:11, w:12, h:6, types:['bear','mammoth'], count:3 },
      { x:27, y:11, w:12, h:6, types:['pigorc'], count:3 },
    ],
    boss:{ type:'trollking', x:21, y:7 },
  },
  jormungand: {
    id:'jormungand', name:'요르문간드', sub:'뱀신이 도는 바다',
    ground:'jormungand', size:[44,30], tint:0x88c8d8, map:JORMUNGAND_MAP, spawn:{x:21,y:15},
    trees:'none', ambience:'#a0d8e8',
    npcs:[ { id:'sailor', x:24, y:16, sprite:'npc_mermaid', name:'떠돌이 뱃사람' } ],
    portals:[ { id:'back', to:'hub', x:19, y:16, label:'쿠소디아' } ],
    chests:[ { id:'jo_c1', x:11, y:15, loot:{potion:2} }, { id:'jo_gem', x:38, y:4, loot:{gem:'wave'} } ],
    zones:[
      { x:5, y:15, w:10, h:5, types:['croc','snake'], count:4 },
      { x:29, y:15, w:10, h:5, types:['snake','croc'], count:4 },
    ],
    boss:{ type:'jormungand', x:24, y:4 },
  },
  muspelheim: {
    id:'muspelheim', name:'무스펠하임', sub:'용암의 지옥 — 화염 군주',
    ground:'muspelheim', size:[44,30], tint:0xd88860, map:MUSPELHEIM_MAP, spawn:{x:21,y:26},
    trees:'none', ambience:'#e8a080',
    npcs:[],
    portals:[ { id:'back', to:'hub', x:21, y:27, label:'쿠소디아' } ],
    chests:[
      { id:'mu_treasure', x:21, y:4, loot:{gold:200, potionBig:2} },
      { id:'mu_c1', x:8, y:9, loot:{potion:2} },
      { id:'mu_c2', x:36, y:24, loot:{potionBig:1, gold:60} },
    ],
    gates:[
      { id:'gate1', x:19, y:6, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate2', x:20, y:6, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate3', x:21, y:6, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate4', x:22, y:6, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate5', x:23, y:6, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate6', x:19, y:7, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate7', x:20, y:7, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate8', x:21, y:7, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate9', x:22, y:7, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
      { id:'gate10', x:23, y:7, kind:'dark', need:'necklace', msg:'어둠의 결계 — 자선의 목걸이의 빛이 길을 밝힌다' },
    ],
    zones:[
      { x:5, y:9, w:12, h:6, types:['demon','demonbat'], count:5 },
      { x:27, y:9, w:12, h:6, types:['demonbat','demon'], count:4 },
      { x:6, y:22, w:12, h:4, types:['demonbat'], count:3 },
    ],
    boss:{ type:'flamelord', x:21, y:14 },
  },
  asgard: {
    id:'asgard', name:'아스가르드', sub:'신들의 세계 — 라그나로크의 그림자',
    ground:'asgard', size:[44,30], tint:0xf0e8d8, map:ASGARD_MAP, spawn:{x:21,y:26},
    trees:'none', ambience:'#f8f0e0',
    npcs:[ { id:'odin', x:21, y:22, sprite:'npc_king', name:'신비한 노인' } ],
    portals:[ { id:'back', to:'hub', x:21, y:27, label:'쿠소디아' } ],
    chests:[ { id:'as_c1', x:8, y:6, loot:{potionBig:2} } ],
    zones:[
      { x:6, y:8, w:12, h:9, types:['wizard','ranger'], count:5 },
      { x:26, y:8, w:12, h:9, types:['ranger','wizard'], count:5 },
    ],
    boss:{ type:'ragnarok', x:21, y:8 },
  },
};

// ───────────────────────── 스토리 단계 ─────────────────────────
export const QUESTS: { stage:number; title:string; hint:string }[] = [
  { stage:0,  title:'할머니를 찾아가자',   hint:'미드가르드 마을에서 할머니에게 다가가 Space로 말을 걸자.' },
  { stage:1,  title:'할머니의 유언',       hint:'묘비 앞에서 Space — 유언이 새겨져 있다.' },
  { stage:2,  title:'인어의 각성 → 쿠소디아로', hint:'마을 북쪽 포탈로 쿠소디아 왕국에 입장하자.' },
  { stage:3,  title:'왕 알현',             hint:'쿠소디아 왕에게 말을 걸어 절제의 검을 받자.' },
  { stage:4,  title:'니드호그 사냥',        hint:'남문 밖 쿠소디아 숲에서 니드호그[탐식] 처치 — 절제의 검(1번) 장착!' },
  { stage:5,  title:'왕에게 보고',          hint:'쿠소디아로 돌아가 왕에게 보고하자.' },
  { stage:6,  title:'네 성물을 모아라',     hint:'알프헤임(반지)·스바르트알프헤임(지팡이)·요툰헤임(방패)·요르문간드(목걸이)' },
  { stage:7,  title:'네바다의 수르트',      hint:'순결의 반지 장착 → 네바다 불길 결계 통과 → 잿빛 현자에게 삼지창 → 수르트[분노]' },
  { stage:8,  title:'니플헤임의 펜리르',    hint:'근면의 지팡이 장착 → 얼음 결계 해동 → 펜리르[탐욕]' },
  { stage:9,  title:'아스가르드의 문',      hint:'성물 7·보석 7을 모아 아스가르드 포탈을 열자.' },
  { stage:10, title:'라그나로크의 그림자',  hint:'보스의 속성이 계속 바뀐다 — 맞는 성물로 응수하자!' },
  { stage:11, title:'…',                   hint:'' },
];

export const FLAGS = {
  metGrandma:'f_met_grandma', graveDone:'f_grave', portalOpen:'f_portal',
  metKing:'f_king', gotSword:'f_sword', nidhoggDown:'b_nidhogg', ch1Report:'f_ch1',
  runesDone:'f_runes', surtrDown:'nevada_done', fenrirDown:'b_fenrir',
  asgardOpen:'asgard_open', ragnarokDown:'b_ragnarok',
};
