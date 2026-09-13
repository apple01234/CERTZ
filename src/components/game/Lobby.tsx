"use client";

/**
 * v1.0.18 — 로비 (메이플스토리 캐릭터 선택·생성 화면 재현)
 *  · 캐릭터 카드 리스트 (이름/직업/레벨/마지막 접속) — 선택 시 정보 패널 + 직업 프리뷰
 *  · 캐릭터 생성: 직업 카드 → 프리뷰(대표 스킬·주 스탯·난이도·소개) → 이름 입력 → 생성
 *  · 캐릭터 삭제(확인 모달) · 슬롯 확장(유니온 코인) · 계정 공유 재화(유니온 코인) 표시
 *  · 캐릭터별 레벨/장비/진행도는 sertz_char_<id>에 개별 저장 (slots.ts)
 */
import { useEffect, useMemo, useState } from "react";
import { Play, Trash2, UserPlus, Users, Coins, ChevronLeft, X, Swords, Shield, Zap, Gauge, Clock, Lock } from "lucide-react";
import { EventBus } from "./EventBus";
import { loadUnion, buySlotExpand } from "@/game/union";
import { loadSlots, writeSlots, createCharacter, deleteCharacter, readCharSave, setActiveChar, getActiveCharId, BASE_SLOTS, type CharMeta } from "@/game/slots";
import { loadSave, writeSave } from "@/game/config";
import { classDef, isClassKey, classLabel, familyOf, type ClassKey } from "@/game/classes";
import type { SaveData } from "@/game/config";

const CLASS_PREVIEWS: { key: ClassKey; main: string; diff: number; skills: { name: string; icon: string }[]; intro: string }[] = [
  {
    key: "warrior", main: "STR (힘)", diff: 1,
    skills: [{ name: "참격", icon: "/assets/skillicon/warrior_s1.webp" }, { name: "회전베기", icon: "/assets/skillicon/warrior_s2.webp" }, { name: "강화 참격", icon: "/assets/skillicon/base_s1.webp" }],
    intro: "가장 두텁고 단순한 시작. 강한 한 방으로 전진하는 계열 — 초보자에게 가장 쉽다.",
  },
  {
    key: "ranger", main: "DEX (민첩)", diff: 3,
    skills: [{ name: "활쏘기", icon: "/assets/skillicon/ranger_s1.webp" }, { name: "관통 화살", icon: "/assets/skillicon/ranger_s2.webp" }, { name: "질풍 사격", icon: "/assets/skillicon/base_s2.webp" }],
    intro: "치명타와 기동성의 대가. 거리를 두고 정밀하게 쏘아 넘기는 계열 — 숙련이 필요하다.",
  },
  {
    key: "mage", main: "INT (지력)", diff: 2,
    skills: [{ name: "마법탄", icon: "/assets/skillicon/mage_s1.webp" }, { name: "매직 볼트", icon: "/assets/skillicon/mage_s2.webp" }, { name: "점멸", icon: "/assets/skillicon/base_s1.webp" }],
    intro: "가장 강한 화력, 가장 얇은 생명. 마나 관리가 관건인 계열 — 화끈하게 크게 친다.",
  },
  {
    key: "thief", main: "LUK (행운)", diff: 4,
    skills: [{ name: "단검 베기", icon: "/assets/skillicon/thief_s1.webp" }, { name: "암습", icon: "/assets/skillicon/thief_s2.webp" }, { name: "그림자 연타", icon: "/assets/skillicon/base_s2.webp" }],
    intro: "빠른 연타와 최고의 크리티컬. 유리 대포보다 칼날처럼 — 가장 화려한 플레이.",
  },
];

function relTime(ts: number): string {
  if (!ts) return "기록 없음";
  const diff = Date.now() - ts;
  if (diff < 60000) return "방금 전";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${Math.floor(diff / 86400000)}일 전`;
}

export function Lobby({ onExit }: { onExit: () => void }) {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickCls, setPickCls] = useState<ClassKey>("warrior");
  const [nameInput, setNameInput] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const store = useMemo(() => loadSlots(), [selId, creating, delId, msg]); // eslint-disable-line react-hooks/exhaustive-deps
  const coins = loadUnion().coins;
  const chars = Object.values(store.chars).sort((a, b) => b.lastSeen - a.lastSeen);
  const used = chars.length;
  const sel = selId ? store.chars[selId] : chars[0] ?? null;
  const selSave = sel ? readCharSave(sel.id) : null;

  /* 로비 진입 시 활성 캐릭터 해제 — 세이브 쓰기 차단 (계정 화면 보호) */
  useEffect(() => {
    setActiveChar(null);
  }, []);

  /* 캐릭터 생성 직후 세이브에 없는 기본 키 채우기 (loadSave 정규화 재사용) */
  const startChar = (meta: CharMeta) => {
    let save = readCharSave(meta.id);
    if (!save) {
      save = { stage: "village", lv: 1, exp: 0, maxHp: 100, atk: 10, cleared: false, maxMp: 60, playerName: meta.name, cls: meta.cls, startCls: meta.cls, gold: 30 } as SaveData;
      writeSave(save);
    }
    setActiveChar(meta.id);
    EventBus.emit("game:continue", save);
  };

  const doCreate = () => {
    const r = createCharacter(nameInput, pickCls);
    if (!r.ok) {
      setMsg(r.reason);
      return;
    }
    setCreating(false);
    setNameInput("");
    setSelId(r.id);
    setMsg(null);
    refresh();
  };

  const expand = () => {
    const u = loadUnion();
    if (used >= 16) {
      setMsg("최대 슬롯(16개)에 도달했다");
      return;
    }
    if (u.coins < 60) {
      setMsg(`유니온 코인이 부족하다 (60 필요 — 현재 ${u.coins})`);
      return;
    }
    /* 코인 차감 + 확장은 buySlotExpand 한 번에 처리 */
    if (buySlotExpand()) {
      setMsg(null);
      refresh();
      EventBus.emit("banner:show", { text: "캐릭터 슬롯이 1개 늘었다!" });
    } else {
      setMsg("슬롯 확장에 실패했다 (코인 부족 또는 최대 도달)");
    }
  };

  const account = useMemo(() => {
    try {
      const raw = window.localStorage.getItem("sertz.auth.user");
      return raw ? (JSON.parse(raw) as { id?: string; name?: string; email?: string }) : null;
    } catch {
      return null;
    }
  }, []);

  const clsColor = (c: string | null) => {
    const d = c ? classDef(c) : null;
    return d?.color ?? "#9fb3d9";
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-b from-[#0a0e22] via-[#0c1230] to-[#05070d] px-3 pb-3 pt-2.5 sm:px-5">
      {/* 헤더 */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-amber-300" />
          <div>
            <p className="text-sm font-black tracking-wide text-amber-200">캐릭터 선택</p>
            <p className="text-[9px] font-bold text-white/40">캐릭터마다 레벨·장비·진행도가 개별 저장된다 · 여러 캐릭터를 키워 유니온을 만들자</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-md border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-200 sm:inline-flex sm:items-center sm:gap-1">
            <Coins size={11} />
            유니온 코인 {coins}
          </span>
          {account && (
            <span className="hidden rounded-md border border-sky-300/40 bg-sky-400/10 px-2 py-1 text-[10px] font-black text-sky-200 md:inline">
              {account.name || account.email || "계정"} 로그인 중
            </span>
          )}
          <button onClick={onExit} aria-label="타이틀로" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/70 hover:bg-black/70">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        {/* 캐릭터 카드 그리드 */}
        <div className="sertz-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {chars.map((m) => {
              const active = sel?.id === m.id;
              const color = clsColor(m.cls);
              return (
                <button
                  key={m.id}
                  onClick={() => { setSelId(m.id); setMsg(null); }}
                  className={`rounded-lg border-2 p-2 text-left transition-all ${active ? "scale-[1.02] shadow-[0_0_18px_rgba(255,215,106,0.25)]" : "hover:scale-[1.01]"}`}
                  style={{ borderColor: active ? "#ffd76a" : `${color}44`, background: active ? `${color}1c` : "#ffffff08" }}
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[12px] font-black text-white">{m.name}</p>
                    <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-black" style={{ color, background: `${color}22` }}>
                      {classLabel(m.cls as ClassKey) || "무직"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-black text-amber-200">Lv. {m.lv}{m.rebirths > 0 ? ` · 환생 ${m.rebirths}회` : ""}</p>
                  <p className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold text-white/40">
                    <Clock size={8} />
                    {relTime(m.lastSeen)}
                  </p>
                  {m.cleared && <p className="mt-0.5 text-[8px] font-black text-emerald-300">세계수 구원 완료</p>}
                </button>
              );
            })}
            {/* 생성 카드 / 잠긴 슬롯 */}
            {used < store.slots ? (
              <button
                onClick={() => { setCreating(true); setMsg(null); }}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/20 bg-white/[0.03] text-white/50 transition-colors hover:border-amber-300/50 hover:text-amber-200"
              >
                <UserPlus size={18} />
                <p className="text-[10px] font-black">캐릭터 생성</p>
              </button>
            ) : (
              <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/10 bg-white/[0.02] text-white/25">
                <Lock size={16} />
                <p className="text-[9px] font-bold">슬롯 확장 필요</p>
              </div>
            )}
          </div>
          <button onClick={expand} className="mx-auto mt-2 flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-black text-white/60 active:scale-95">
            <Coins size={11} className="text-amber-300" />
            슬롯 확장 (유니온 코인 60) — {used}/{store.slots}
          </button>
        </div>

        {/* 정보 패널 */}
        <div className="w-full shrink-0 rounded-lg border border-white/12 bg-black/40 p-3 lg:w-[320px]">
          {creating ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-black text-amber-200">캐릭터 생성</p>
                <button onClick={() => setCreating(false)} className="flex h-6 w-6 items-center justify-center rounded border border-white/15 text-white/50">
                  <ChevronLeft size={13} />
                </button>
              </div>
              {/* 직업 카드 */}
              <div className="grid grid-cols-2 gap-1.5">
                {CLASS_PREVIEWS.map((p) => {
                  const d = classDef(p.key)!;
                  const on = pickCls === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPickCls(p.key)}
                      className={`rounded-lg border-2 px-2 py-2 text-left transition-transform active:scale-95 ${on ? "" : "border-white/10 bg-white/[0.03]"}`}
                      style={on ? { borderColor: d.color, background: `${d.color}18` } : undefined}
                    >
                      <p className="text-[12px] font-black" style={{ color: d.color }}>{d.name}</p>
                      <p className="text-[8px] font-bold text-white/40">{d.title}</p>
                    </button>
                  );
                })}
              </div>
              {/* 프리뷰 */}
              {(() => {
                const p = CLASS_PREVIEWS.find((x) => x.key === pickCls)!;
                const d = classDef(p.key)!;
                return (
                  <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: `${d.color}55`, background: `${d.color}0d` }}>
                    <p className="text-[11px] font-black" style={{ color: d.color }}>{d.name} — {d.title}</p>
                    <p className="mt-1 text-[9px] font-bold leading-relaxed text-white/60">{p.intro}</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
                      <div className="rounded border border-white/10 bg-black/30 py-1">
                        <p className="text-[7px] font-bold text-white/40">주 스탯</p>
                        <p className="text-[9px] font-black text-amber-200">{p.main}</p>
                      </div>
                      <div className="rounded border border-white/10 bg-black/30 py-1">
                        <p className="text-[7px] font-bold text-white/40">난이도</p>
                        <p className="text-[9px] font-black text-amber-200">{"★".repeat(p.diff)}{"☆".repeat(4 - p.diff)}</p>
                      </div>
                      <div className="rounded border border-white/10 bg-black/30 py-1">
                        <p className="text-[7px] font-bold text-white/40">공격력</p>
                        <p className="text-[9px] font-black text-amber-200">+{d.atkPct}%</p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[9px] font-black text-white/50">대표 스킬</p>
                    <div className="mt-0.5 flex gap-1.5">
                      {p.skills.map((s) => (
                        <div key={s.name} className="flex flex-col items-center gap-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.icon} alt={s.name} width={34} height={34} className="rounded border border-white/15 bg-black/40" />
                          <span className="text-[7px] font-bold text-white/55">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={8}
                placeholder="캐릭터 이름 (최대 8자)"
                className="mt-2 w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-[12px] font-bold text-white placeholder:text-white/25 focus:border-amber-300/60 focus:outline-none"
              />
              <button
                onClick={doCreate}
                className="mt-1.5 w-full rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-2.5 text-[12px] font-black text-slate-900 transition-transform active:scale-95"
              >
                {classDef(pickCls)!.name}로 생성
              </button>
              {msg && <p className="mt-1 text-[10px] font-black text-rose-300">{msg}</p>}
            </div>
          ) : sel ? (
            <div>
              <p className="text-[12px] font-black text-white">{sel.name}</p>
              <p className="mt-0.5 text-[10px] font-bold" style={{ color: clsColor(sel.cls) }}>
                {classLabel(sel.cls as ClassKey) || "무직"} · Lv. {sel.lv} · 환생 {sel.rebirths}회
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-center">
                <div className="rounded border border-white/10 bg-white/[0.04] py-1.5">
                  <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Swords size={8} />공격력</p>
                  <p className="text-[11px] font-black text-amber-200">{selSave?.atk ?? "?"}</p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.04] py-1.5">
                  <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Shield size={8} />최대 HP</p>
                  <p className="text-[11px] font-black text-rose-200">{selSave?.maxHp ?? "?"}</p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.04] py-1.5">
                  <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Zap size={8} />골드</p>
                  <p className="text-[11px] font-black text-yellow-200">{(selSave?.gold ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.04] py-1.5">
                  <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Gauge size={8} />마지막 구역</p>
                  <p className="truncate text-[11px] font-black text-sky-200">{sel.stage}</p>
                </div>
              </div>
              {(() => {
                const sc = (selSave as { startCls?: string | null } | null)?.startCls ?? sel.cls;
                const fam = familyOf(sc || undefined);
                return fam ? (
                  <p className="mt-2 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[9px] font-bold leading-relaxed text-white/50">
                    환생 시 <b style={{ color: clsColor(sel.cls) }}>{classLabel(sc as ClassKey)}</b>(으)로 돌아온다 · 시작 캐릭터가 기록되어 있다
                  </p>
                ) : (
                  <p className="mt-2 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[9px] font-bold leading-relaxed text-white/50">
                    아직 시작 직업이 없다 — 1차 전직 시련을 통과하면 환생 시에도 그 직업으로 시작한다
                  </p>
                );
              })()}
              <button
                onClick={() => startChar(sel)}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-2.5 text-[13px] font-black text-slate-900 transition-transform active:scale-95"
              >
                <Play size={15} />
                이 캐릭터로 시작
              </button>
              <button
                onClick={() => setDelId(sel.id)}
                className="mx-auto mt-1.5 flex items-center gap-1 text-[10px] font-bold text-white/35 underline underline-offset-2 hover:text-rose-300"
              >
                <Trash2 size={11} />
                캐릭터 삭제
              </button>
              {msg && <p className="mt-1 text-[10px] font-black text-rose-300">{msg}</p>}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
              <UserPlus size={26} className="text-white/25" />
              <p className="text-[11px] font-black text-white/50">첫 캐릭터를 만들어 모험을 시작하자</p>
              <button onClick={() => setCreating(true)} className="rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-[11px] font-black text-slate-900">
                캐릭터 생성
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {delId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70" onPointerDown={() => setDelId(null)}>
          <div className="w-[min(92vw,340px)] rounded-xl border-2 border-rose-300/50 bg-slate-950 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-black text-rose-200">정말 삭제하시겠습니까?</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/60">
              <b className="text-white">{store.chars[delId]?.name}</b>의 레벨·장비·진행도가 영구히 사라진다. (유니온 코인·아티팩트는 계정에 유지)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button onClick={() => setDelId(null)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-black text-white/70">
                취소
              </button>
              <button
                onClick={() => {
                  deleteCharacter(delId);
                  setDelId(null);
                  setSelId(null);
                  refresh();
                }}
                className="rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 px-3 py-2 text-[11px] font-black text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

void writeSlots;
void getActiveCharId;
void BASE_SLOTS;
