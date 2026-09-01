'use client';
// 아뜰란티스 — React 셸: Phaser 마운트 + HUD/타이틀/인벤토리/상점/엔딩
import { useEffect, useRef } from 'react';
import { useAtl, bus, loadGame, hasSave } from '@/game/atlantis/state';
import { RELICS, GEMS, ELEMENTS, relicOf, type RelicId, type ElementId } from '@/game/atlantis/data';
import { sfx, setSfxEnabled } from '@/game/atlantis/sfx';

const ICON = (n:string)=> `/atlantis/img/icons/${n}.png`;

const SLOT: { key:string; ids:RelicId[] }[] = [
  { key:'1', ids:['sword','rust'] },
  { key:'2', ids:['trident'] },
  { key:'3', ids:['ring'] },
  { key:'4', ids:['necklace'] },
  { key:'5', ids:['shield'] },
  { key:'6', ids:['staff'] },
  { key:'7', ids:['bow'] },
];

export default function AtlantisRoot(){
  const mountRef = useRef<HTMLDivElement>(null);
  const atlMod = useRef<{ resetGameState:()=>void; getGameState:()=>{world:string}; importSave:(s:unknown)=>void }|null>(null);
  const gameRef = useRef<{ scene:{ getScene:(k:string)=>{ scene:{ restart:(d:unknown)=>void }|null } } }|null>(null);
  const s = useAtl();

  useEffect(()=>{
    let destroyed = false;
    let g: unknown = null;
    Promise.all([
      import('phaser'),
      import('@/game/atlantis/BootScene'),
      import('@/game/atlantis/WorldScene'),
    ]).then(([Ph, Boot, World])=>{
      if (destroyed || !mountRef.current) return;
      atlMod.current = World as unknown as typeof atlMod.current;
      const Phaser = Ph.default;
      g = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mountRef.current,
        pixelArt: true,
        backgroundColor:'#0a0e18',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER, width:'100%', height:'100%' },
        physics: { default:'arcade', arcade:{ debug:false } },
        scene: [Boot.default, World.default],
      });
      gameRef.current = g as typeof gameRef.current;
    });
    return ()=>{ destroyed = true; const gg = g as { destroy:(b:boolean)=>void }|null; gg?.destroy(true); };
  }, []);

  const restartScene = (world?:string)=>{
    const sc = (window as unknown as { __ATL__?:{ scene:()=>{ scene:{ restart:(d:unknown)=>void } } } }).__ATL__?.scene?.();
    if (sc) sc.scene.restart({ world: world ?? atlMod.current?.getGameState().world ?? 'midgard' });
  };

  const startGame = (cont:boolean)=>{
    const W = atlMod.current;
    if (!W) return;
    sfx.dialog();
    if (cont){
      const sv = loadGame();
      if (sv){ W.importSave(sv); }
      else { W.resetGameState(); }
    } else {
      W.resetGameState();
    }
    useAtl.setState({ screen:'play', ending:null, boss:null, dialog:null, invOpen:false, shopOpen:false });
    restartScene();
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#070b14] text-white" style={{ fontFamily:'"Pretendard","Noto Sans KR",system-ui,sans-serif' }}>
      {/* Phaser 캔버스 */}
      <div ref={mountRef} className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full" />

      {/* 어두운 비네트 */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow:'inset 0 0 140px rgba(0,0,0,.55)' }} />

      {s.screen==='play' && <>
        {/* 좌상단 스테이터스 */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 w-60 rounded-lg border border-cyan-200/20 bg-black/55 p-2.5 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-wide text-amber-200">
            <span>Lv.{s.lvl} 인어의 혈통</span>
            <span className="text-yellow-300">{s.gold} G</span>
          </div>
          <Bar label="HP" v={s.hp} max={s.maxHp} color="#ff5d6c" bg="#3a1520" />
          <Bar label="MP" v={s.mp} max={s.maxMp} color="#4db8ff" bg="#12283f" />
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-300 transition-all" style={{ width:`${Math.min(100, s.exp/s.expNext*100)}%` }} />
          </div>
          <div className="mt-0.5 text-right text-[9px] text-emerald-300/80">EXP {s.exp}/{s.expNext}</div>
        </div>

        {/* 우상단 퀘스트 */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 w-64 rounded-lg border border-amber-200/25 bg-black/55 p-2.5 backdrop-blur-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/90">{s.worldName}</div>
          <div className="text-[9px] text-white/50">{s.worldSub}</div>
          <div className="mt-1.5 flex items-start gap-1.5">
            <span className="rounded bg-amber-400/90 px-1 text-[9px] font-black text-black">퀘스트</span>
            <div>
              <div className="text-[11px] font-bold text-amber-100">{s.questTitle}</div>
              <div className="text-[9px] leading-snug text-white/60">{s.questHint}</div>
            </div>
          </div>
        </div>

        {/* 보스 바 */}
        {s.boss && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 w-80 -translate-x-1/2 rounded-lg border border-red-400/30 bg-black/60 p-2 backdrop-blur-sm">
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-red-200">
              <span>{s.boss.name}</span>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-black text-black"
                style={{ background: ELEMENTS[s.boss.attr as ElementId]?.color ?? '#888' }}>
                {ELEMENTS[s.boss.attr as ElementId]?.name ?? '?'}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded bg-black/70">
              <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all" style={{ width:`${Math.max(0, s.boss.hp/s.boss.maxHp*100)}%` }} />
            </div>
          </div>
        )}

        {/* 하단 성물 바 */}
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-end gap-1.5 rounded-xl border border-white/15 bg-black/60 p-2 backdrop-blur-sm">
            {SLOT.map(slot=>{
              const id = slot.ids.find(i=>s.relics.includes(i));
              const rd = id ? relicOf(id) : null;
              const eq = id && s.eqRelic===id;
              return (
                <button key={slot.key}
                  onClick={()=>{ if(id){ bus.emit('equipRelic', id); sfx.pickup(); } }}
                  className={`relative h-12 w-12 rounded-lg border-2 transition-all ${
                    eq ? 'border-amber-300 bg-amber-300/20 shadow-[0_0_12px_rgba(252,211,77,.5)]' : id ? 'border-white/25 bg-white/5 hover:border-white/50' : 'border-white/10 bg-black/40'}`}>
                  {rd ? <img src={ICON(rd.icon)} alt={rd.name} className="mx-auto h-7 w-7" style={{ imageRendering:'pixelated' }} />
                    : <span className="text-lg text-white/20">·</span>}
                  <span className={`absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded text-[9px] font-black ${eq?'bg-amber-300 text-black':'bg-black/80 text-white/70'}`}>{slot.key}</span>
                  {rd?.counters && (
                    <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-black/60"
                      style={{ background: ELEMENTS[rd.counters].color }} title={`${ELEMENTS[rd.counters].name} 상성`} />
                  )}
                </button>
              );
            })}
            <div className="mx-1 h-10 w-px bg-white/15" />
            {/* 보석 트레이 */}
            <div className="flex gap-1">
              {GEMS.map(g=>(
                <div key={g.id} title={`${g.name} — ${g.where}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${s.gems.includes(g.id)?'border-white/30 bg-white/10':'border-white/10 bg-black/40 opacity-30'}`}>
                  <img src={ICON(g.icon)} alt={g.name} className="h-5 w-5" style={{ imageRendering:'pixelated' }} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 text-center text-[9px] text-white/40">숫자키 1~7 성물 장착 · J/클릭 공격 · K 스킬 · Space 상호작용 · I 가방</div>
        </div>

        {/* 좌하단 버튼 */}
        <div className="absolute bottom-3 left-3 z-20 flex gap-1.5">
          <ChipBtn onClick={()=>useAtl.setState({ invOpen:!s.invOpen })}>가방 (I)</ChipBtn>
          <ChipBtn onClick={()=>useAtl.setState({ helpOpen:!s.helpOpen })}>조작</ChipBtn>
          <ChipBtn onClick={()=>{ const v=!s.sfxOn; setSfxEnabled(v); useAtl.setState({ sfxOn:v }); }}>{s.sfxOn?'🔊':'🔇'}</ChipBtn>
        </div>

        {/* 토스트 */}
        <div className="pointer-events-none absolute right-3 top-36 z-30 flex w-64 flex-col gap-1.5">
          {s.toasts.map(t=>(
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-amber-200/25 bg-black/75 px-2.5 py-1.5 text-[11px] text-amber-100 shadow-lg">
              {t.icon && <img src={ICON(t.icon)} alt="" className="h-4 w-4" style={{ imageRendering:'pixelated' }} />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        {/* 대화창 */}
        {s.dialog && (
          <div className="absolute bottom-24 left-1/2 z-30 w-[560px] max-w-[92vw] -translate-x-1/2 cursor-pointer"
            onClick={()=>useAtl.getState().advanceDialog()}>
            <div className="rounded-xl border-2 border-cyan-200/30 bg-[#0b1220ee] p-3.5 shadow-2xl">
              <div className="mb-1.5 inline-block rounded bg-cyan-400/90 px-2 py-0.5 text-[11px] font-black text-black">{s.dialog.name}</div>
              <p className="min-h-[40px] text-[13px] leading-relaxed text-white/90">{s.dialog.lines[s.dialog.idx]}</p>
              <div className="mt-1 text-right text-[10px] text-white/40">Space / 클릭 {(s.dialog.idx < s.dialog.lines.length-1)?'계속':'닫기'} ▸</div>
            </div>
          </div>
        )}

        {/* 가방 */}
        {s.invOpen && (
          <Overlay onClose={()=>useAtl.setState({ invOpen:false })}>
            <div className="w-[520px] max-w-[94vw] rounded-2xl border border-cyan-200/25 bg-[#0b1220f2] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-amber-200">가방</h2>
                <ChipBtn onClick={()=>useAtl.setState({ invOpen:false })}>닫기 (Esc)</ChipBtn>
              </div>
              <div className="mb-2 text-[11px] font-bold text-cyan-300">성물 ({s.relics.length}/7) — 상성에 맞춰 장착!</div>
              <div className="mb-3 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
                {RELICS.filter(r=>s.relics.includes(r.id)).map(r=>(
                  <div key={r.id} className={`flex items-center gap-2.5 rounded-lg border p-2 ${s.eqRelic===r.id?'border-amber-300/60 bg-amber-300/10':'border-white/10 bg-white/5'}`}>
                    <img src={ICON(r.icon)} alt={r.name} className="h-8 w-8" style={{ imageRendering:'pixelated' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold">
                        {r.name}
                        {r.counters && <span className="rounded px-1 text-[9px] font-black text-black" style={{ background:ELEMENTS[r.counters].color }}>{ELEMENTS[r.counters].name} ×2.2</span>}
                      </div>
                      <div className="truncate text-[10px] text-white/50">{r.desc} · 스킬: {r.skill.name}({r.skill.mp}MP)</div>
                    </div>
                    <button onClick={()=>{ bus.emit('equipRelic', r.id); sfx.pickup(); }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${s.eqRelic===r.id?'bg-amber-300 text-black':'bg-cyan-500/80 text-black hover:bg-cyan-400'}`}>
                      {s.eqRelic===r.id?'장착중':'장착'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mb-2 text-[11px] font-bold text-cyan-300">보석 ({s.gems.length}/7)</div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {GEMS.map(g=>(
                  <div key={g.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] ${s.gems.includes(g.id)?'border-white/25 bg-white/10':'border-white/10 opacity-30'}`}>
                    <img src={ICON(g.icon)} alt="" className="h-4 w-4" style={{ imageRendering:'pixelated' }} />
                    {s.gems.includes(g.id)? g.name : '???'}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded bg-white/10 px-2 py-1">열쇠 {s.keys}</span>
                <button onClick={()=>bus.emit('usePotion',0)} className="rounded bg-rose-500/80 px-2.5 py-1 font-bold text-black hover:bg-rose-400">포션 사용 ({s.potions})</button>
                <button onClick={()=>bus.emit('usePotion',1)} className="rounded bg-fuchsia-500/80 px-2.5 py-1 font-bold text-black hover:bg-fuchsia-400">대형 사용 ({s.potionBig})</button>
              </div>
            </div>
          </Overlay>
        )}

        {/* 상점 */}
        {s.shopOpen && (
          <Overlay onClose={()=>useAtl.setState({ shopOpen:false })}>
            <div className="w-[380px] max-w-[92vw] rounded-2xl border border-amber-200/25 bg-[#0b1220f2] p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-black text-amber-200">상인 두르바</h2>
                <ChipBtn onClick={()=>useAtl.setState({ shopOpen:false })}>닫기</ChipBtn>
              </div>
              <div className="mb-3 text-[11px] text-white/50">보유 골드: <b className="text-yellow-300">{s.gold}G</b></div>
              {[
                { id:'potion', name:'포션', desc:'HP 40 회복', price:25, icon:'icon_potion' },
                { id:'potionBig', name:'대형 포션', desc:'HP 100 + MP 40 회복', price:60, icon:'icon_potion_big' },
              ].map(it=>(
                <div key={it.id} className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2">
                  <img src={ICON(it.icon)} alt="" className="h-7 w-7" style={{ imageRendering:'pixelated' }} />
                  <div className="flex-1">
                    <div className="text-[12px] font-bold">{it.name} <span className="ml-1 text-[10px] text-white/40">보유 {it.id==='potion'?s.potions:s.potionBig}</span></div>
                    <div className="text-[10px] text-white/50">{it.desc}</div>
                  </div>
                  <button onClick={()=>{ bus.emit('buy', it.id); sfx.gold(); }}
                    className="rounded-md bg-amber-300 px-2.5 py-1 text-[11px] font-black text-black hover:bg-amber-200">{it.price}G</button>
                </div>
              ))}
            </div>
          </Overlay>
        )}

        {/* 조작 도움말 */}
        {s.helpOpen && (
          <Overlay onClose={()=>useAtl.setState({ helpOpen:false })}>
            <div className="w-[420px] max-w-[92vw] rounded-2xl border border-white/15 bg-[#0b1220f2] p-4 text-[12px] leading-relaxed">
              <h2 className="mb-2 text-lg font-black text-cyan-300">조작법</h2>
              <ul className="space-y-1 text-white/80">
                <li><Key>WASD</Key> / 방향키 — 이동</li>
                <li><Key>J</Key> / 마우스 클릭 — 성물 공격 (방향: 마우스)</li>
                <li><Key>K</Key> — 성물 스킬 (MP 소모)</li>
                <li><Key>Space</Key> — 대화·상자·포탈·결계·룬석 상호작용</li>
                <li><Key>1~7</Key> — 성물 장착 (적 속성 색과 맞추면 2.2배!)</li>
                <li><Key>I</Key> 가방 · <Key>Esc</Key> 창 닫기</li>
              </ul>
              <div className="mt-3 rounded-lg bg-white/5 p-2.5 text-[11px] text-white/60">
                7성물 ↔ 7속성: 절제의 검→탐식 · 인내의 삼지창→분노 · 희망의 활→탐욕 · 자선의 목걸이→질투 · 근면의 지팡이→나태 · 겸손의 방패→오만 · 순결의 반지→혼돈
              </div>
            </div>
          </Overlay>
        )}
      </>}

      {/* 타이틀 */}
      {s.screen==='title' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-[#06101eaa] via-[#06101ecc] to-[#06101eee] backdrop-blur-[2px]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.4em] text-cyan-300/80">잠뜰의 아뜰란티스</div>
          <h1 className="mb-1 text-center text-5xl font-black tracking-tight text-white drop-shadow-[0_0_18px_rgba(80,200,255,.45)]">
            아뜰란티스<span className="text-cyan-300">:</span> <span className="bg-gradient-to-r from-cyan-300 to-teal-200 bg-clip-text text-transparent">잠뜰의 인어</span>
          </h1>
          <p className="mb-8 text-[13px] text-white/60">7개의 성물과 7개의 보석으로 아홉 세계를 되살려라</p>
          <div className="flex flex-col items-center gap-2.5">
            <TitleBtn primary onClick={()=>startGame(false)}>새로운 모험</TitleBtn>
            {hasSave() && <TitleBtn onClick={()=>startGame(true)}>이어하기</TitleBtn>}
            <a href="/" className="mt-1 text-[11px] font-bold text-cyan-200/50 underline underline-offset-2 hover:text-cyan-200/90">← SERTZ 본편 (바다의 수호자) 으로</a>
            <button onClick={()=>{ const v=!s.sfxOn; setSfxEnabled(v); useAtl.setState({ sfxOn:v }); }}
              className="mt-2 text-[11px] text-white/40 hover:text-white/70">사운드 {s.sfxOn?'끄기':'켜기'} 🔈</button>
          </div>
          <div className="mt-10 max-w-md rounded-xl border border-white/10 bg-black/40 p-3 text-center text-[11px] leading-relaxed text-white/50">
            WASD 이동 · J/클릭 공격 · Space 상호작용 · 1~7 성물 장착<br/>
            적의 속성 색을 보고 상성에 맞는 성물로 싸우자 (2.2배)
          </div>
        </div>
      )}

      {/* 엔딩 */}
      {s.ending==='light' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1a2ecc] to-[#08111ecc] backdrop-blur-sm">
          <div className="mb-3 text-6xl">🌊</div>
          <h1 className="mb-2 text-4xl font-black text-cyan-200">세계는 다시 노래한다</h1>
          <p className="mb-1 max-w-lg text-center text-[13px] leading-relaxed text-white/75">
            라그나로크의 그림자가 사라지고, 아홉 세계에 아침이 찾아왔다.<br/>
            인어의 노래가 바다에 퍼지고, 할머니의 별이 하늘에서 빛났다.
          </p>
          <p className="mb-6 text-[12px] text-amber-200">Lv.{s.lvl} · 성물 {s.relics.length}/7 · 보석 {s.gems.length}/7 · {s.gold}G</p>
          <TitleBtn primary onClick={()=>startGame(false)}>처음부터 다시</TitleBtn>
        </div>
      )}
    </div>
  );
}

function Bar({ label, v, max, color, bg }:{ label:string; v:number; max:number; color:string; bg:string }){
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="w-6 text-[9px] font-black text-white/60">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded" style={{ background:bg }}>
        <div className="h-full transition-all" style={{ width:`${Math.max(0,Math.min(100, v/max*100))}%`, background:color }} />
      </div>
      <span className="w-14 text-right text-[9px] tabular-nums text-white/70">{Math.ceil(v)}/{max}</span>
    </div>
  );
}

function ChipBtn({ children, onClick }:{ children:React.ReactNode; onClick:()=>void }){
  return (
    <button onClick={onClick} className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm transition hover:border-white/40 hover:text-white">
      {children}
    </button>
  );
}

function TitleBtn({ children, onClick, primary }:{ children:React.ReactNode; onClick:()=>void; primary?:boolean }){
  return (
    <button onClick={onClick}
      className={`w-56 rounded-xl px-6 py-3 text-[15px] font-black tracking-wide transition-all ${
        primary ? 'bg-gradient-to-r from-cyan-400 to-teal-300 text-black shadow-[0_0_24px_rgba(70,210,230,.4)] hover:scale-[1.03] hover:shadow-[0_0_32px_rgba(70,210,230,.6)]'
                : 'border border-white/20 bg-white/5 text-white/85 hover:border-white/50 hover:bg-white/10'}`}>
      {children}
    </button>
  );
}

function Overlay({ children, onClose }:{ children:React.ReactNode; onClose:()=>void }){
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Key({ children }:{ children:React.ReactNode }){
  return <kbd className="mx-0.5 rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">{children}</kbd>;
}
