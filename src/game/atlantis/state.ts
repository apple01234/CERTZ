'use client';
// 아뜰란티스 — 전역 상태 (zustand) + Phaser↔React 버스 + 세이브
import { create } from 'zustand';
import type { RelicId, GemId } from './data';

export interface DialogState {
  name: string; lines: string[]; idx: number;
  onDone?: () => void;
}
export interface Toast { id:number; text:string; icon?:string }

export interface AtlSave {
  world:string; x:number; y:number;
  lvl:number; exp:number; hp:number; mp:number; gold:number;
  relics:RelicId[]; eqRelic:RelicId|null; gems:GemId[];
  keys:number; potions:number; potionBig:number;
  flags:string[]; stage:number; dead_bosses:string[];
}

export interface AtlState {
  screen:'title'|'play';
  world:string; worldName:string; worldSub:string;
  hp:number; maxHp:number; mp:number; maxMp:number;
  lvl:number; exp:number; expNext:number; gold:number;
  relics:RelicId[]; eqRelic:RelicId|null; gems:GemId[];
  keys:number; potions:number; potionBig:number;
  stage:number;
  questTitle:string; questHint:string;
  dialog:DialogState|null;
  toasts:Toast[];
  boss:{ name:string; hp:number; maxHp:number; attr:string }|null;
  invOpen:boolean; helpOpen:boolean; shopOpen:boolean;
  sfxOn:boolean;
  ending:string|null;
  loaded:boolean;
}

export interface AtlActions {
  patch:(p:Partial<AtlState>)=>void;
  say:(name:string, lines:string[], onDone?:()=>void)=>void;
  advanceDialog:()=>void;
  toast:(text:string, icon?:string)=>void;
  start:(cont:boolean)=>void;
  toTitle:()=>void;
}

let toastId = 1;
export const useAtl = create<AtlState & AtlActions>((set,get)=>({
  screen:'title',
  world:'midgard', worldName:'미드가르드', worldSub:'인간들의 세상',
  hp:60, maxHp:60, mp:30, maxMp:30, lvl:1, exp:0, expNext:40, gold:0,
  relics:[], eqRelic:null, gems:[], keys:0, potions:1, potionBig:0,
  stage:0,
  questTitle:'할머니를 찾아가자', questHint:'미드가르드 마을에서 할머니에게 다가가 Space로 말을 걸자.',
  dialog:null, toasts:[], boss:null,
  invOpen:false, helpOpen:false, shopOpen:false,
  sfxOn:true,
  ending:null, loaded:false,

  patch:(p)=>set(p),
  say:(name,lines,onDone)=>set({ dialog:{ name, lines, idx:0, onDone } }),
  advanceDialog:()=>{
    const d = get().dialog; if(!d) return;
    if (d.idx < d.lines.length-1) set({ dialog:{...d, idx:d.idx+1} });
    else { set({ dialog:null }); d.onDone?.(); }
  },
  toast:(text,icon)=>{
    const t = { id:toastId++, text, icon };
    set({ toasts:[...get().toasts.slice(-4), t] });
    setTimeout(()=>set({ toasts:get().toasts.filter(x=>x.id!==t.id) }), 3200);
  },
  start:(cont)=>set({ screen:'play', loaded:false, ending:null }),
  toTitle:()=>set({ screen:'title' }),
}));

// ── Phaser ↔ React 커맨드 버스 ──
type Handler = (payload?:unknown)=>void;
const handlers = new Map<string, Set<Handler>>();
export const bus = {
  on(ev:string, fn:Handler){ 
    if(!handlers.has(ev)) handlers.set(ev,new Set());
    handlers.get(ev)!.add(fn);
    return ()=>handlers.get(ev)?.delete(fn);
  },
  emit(ev:string, payload?:unknown){ handlers.get(ev)?.forEach(fn=>fn(payload)); },
};

// ── 세이브 ──
const KEY = 'sertz_atlantis_save_v1';
export function saveGame(s:AtlSave){ 
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch{}
}
export function loadGame():AtlSave|null{
  try { 
    const raw = localStorage.getItem(KEY); 
    if(!raw) return null;
    return JSON.parse(raw) as AtlSave;
  } catch { return null; }
}
export function hasSave():boolean{ return !!loadGame(); }
export function clearSave(){ try{ localStorage.removeItem(KEY); }catch{} }
