"use client";

/**
 * v1.0.19 — 로비 (메이플스토리 캐릭터 선택·생성 화면 재현 — 지시서 A-1/B-1 반영)
 *
 *  [A-1 스크롤 수정] 루트를 overflow-y-auto 스크롤 컨테이너로 전환 —
 *    콘텐츠가 뷰포트보다 길면(모바일 세로 등) 전체가 스크롤된다. 데스크톱 lg+는 2컬럼 유지.
 *    게임 캔버스(game-root fixed)와 분리되어 인게임 중엔 페이지 스크롤이 없다.
 *
 *  [B-1 메이플식 캐릭터 선택창]
 *   · 슬롯 그리드 — 외형 미리보기(색조 틴트 캔버스)·레벨·직업·닉네임 표시, 빈 슬롯 [+]
 *   · 더블클릭(모바일: 탭 후 "이 캐릭터로 시작")으로 입장
 *   · 생성 플로우 3단계: ①닉네임 → ②직업 선택 → ③외형 선택(색조 팔레트)
 *   · 삭제 확인 모달 · 캐릭터별 개별 세이브(sertz_char_<id>) · 슬롯 확장(유니온 코인)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Trash2, UserPlus, Users, Coins, ChevronLeft, ChevronRight, X, Swords, Shield, Zap, Gauge, Clock, Lock } from "lucide-react";
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

/* v1.1.0 (#21/#22) — 성별 × 피부 6종. multiply 틴트(다 어두워지는 문제) 폐기 →
 *  실제 생성된 스프라이트 시트(chm/chf_*)를 그대로 미리보기 (백자~초콜릿 밝은 피부 포함) */
const SKIN_CHOICES: { idx: number; name: string }[] = [
  { idx: 0, name: "백자" },
  { idx: 1, name: "밝은" },
  { idx: 2, name: "기본" },
  { idx: 3, name: "밀색" },
  { idx: 4, name: "구릿빛" },
  { idx: 5, name: "초콜릿" },
];
const lookSprite = (g: "m" | "f", skin: number): string =>
  g === "f" || skin !== 2 ? `/assets/ch${g}${skin}_idle0.webp` : "/assets/hero_idle0.webp";

/** v1.1.0 (#21/#22) — 캐릭터 외형 미리보기: 실제 생성된 변형 스프라이트(chm/chf/hero)를 그대로 노출.
 *  미리보기 = 인게임 외형 100% 일치 (틴트 시뮬레이션 폐기) */
function CharAvatar({ gender, skinIdx, size = 44 }: { gender?: "m" | "f" | null; skinIdx?: number | null; size?: number }) {
  const g = gender ?? "m";
  const s = skinIdx ?? 2;
  return (
    <img
      src={lookSprite(g, s)}
      alt="캐릭터 외형 미리보기"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      className="shrink-0 rounded border border-white/15 bg-black/40 object-cover object-[35%_78%]"
      draggable={false}
    />
  );
}

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
  /* v1.0.19 (B-1) — 생성 플로우 3단계: ①이름 → ②직업 → ③외형 */
  const [step, setStep] = useState(0);
  const [pickCls, setPickCls] = useState<ClassKey>("warrior");
  const [nameInput, setNameInput] = useState("");
  const [lookGender, setLookGender] = useState<"m" | "f">("m");
  const [lookSkin, setLookSkin] = useState<number>(2);
  const [delId, setDelId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null); // v1.1.0 — 구문 오류 복구 (v1.0.20 커밋분)

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
      save = { stage: "village", lv: 1, exp: 0, maxHp: 100, atk: 10, cleared: false, maxMp: 60, playerName: meta.name, cls: meta.cls, startCls: meta.cls, gold: 30, lookTint: meta.lookTint ?? null, gender: meta.gender ?? "m", skinIdx: meta.skinIdx ?? 2 } as SaveData;
      writeSave(save);
    }
    setActiveChar(meta.id);
    EventBus.emit("game:continue", save);
  };

  const openCreate = () => {
    setCreating(true);
    setStep(0);
    setNameInput("");
    setLookGender("m");
    setLookSkin(2);
    setPickCls("warrior");
    setMsg(null);
  };

  const doCreate = () => {
    const r = createCharacter(nameInput, pickCls, null, { gender: lookGender, skinIdx: lookSkin });
    if (!r.ok) {
      setMsg(r.reason);
      setStep(0); // 이름 문제일 수 있으니 1단계로
      return;
    }
    setCreating(false);
    setNameInput("");
    setLookGender("m");
    setLookSkin(2);
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

  /* v1.0.19 (B-1) — 생성 플로우 단계 검증 */
  const nameOk = nameInput.trim().length >= 1;
  const STEP_LABELS = ["이름", "직업", "외형"];

  return (
    /* [A-1 v1.0.19] 루트가 스크롤 컨테이너 — 모바일 세로에서 카드 그리드+정보 패널이 세로로 쌓여도 전체 스크롤된다
     *  v1.0.20 — 게임형 로비: 밤하늘 → 왕가 네이비+우드 톤 */
    <div className="sertz-scroll absolute inset-0 z-40 overflow-y-auto bg-gradient-to-b from-[#0d1424] via-[#101a30] to-[#080d18]">
      <div className="flex min-h-full flex-col px-3 pb-6 pt-2.5 sm:px-5">
        {/* 헤더 — 금색 네임플레이트 */}
        <div className="game-chip mb-2 flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#ffd98a]" />
            <div>
              <p className="text-sm font-black tracking-wide text-[#ffd98a]">캐릭터 선택</p>
              <p className="text-[9px] font-bold text-white/40">더블클릭으로 바로 입장 · 캐릭터마다 레벨·장비·진행도가 개별 저장된다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-[#8a6a34]/70 bg-black/40 px-2 py-1 text-[10px] font-black text-[#ffd98a] sm:inline-flex sm:items-center sm:gap-1">
              <Coins size={11} />
              유니온 코인 {coins}
            </span>
            {account && (
              <span className="hidden rounded-md border border-[#8a6a34]/70 bg-black/40 px-2 py-1 text-[10px] font-black text-[#cbb88a] md:inline">
                {account.name || account.email || "계정"} 로그인 중
              </span>
            )}
            <button onClick={onExit} aria-label="타이틀로" className="game-chip flex h-9 w-9 items-center justify-center text-white/70">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
          {/* 캐릭터 카드 그리드 — [A-1] 내부 독자 스크롤 제거(루트 스크롤로 통합) */}
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {chars.map((m) => {
                const active = sel?.id === m.id;
                const color = clsColor(m.cls);
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelId(m.id); setMsg(null); }}
                    onDoubleClick={() => startChar(m)}
                    className={`game-chip min-h-[92px] p-2 text-left transition-all ${active ? "scale-[1.02] shadow-[0_0_18px_rgba(232,192,100,0.3),inset_0_0_0_1px_#e8c06440]" : ""}`}
                    style={{ borderColor: active ? "#e8c064" : "#7a5a2e" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {/* v1.1.0 (#21/#22) — 외형 미리보기 (성별+피부 변형 스프라이트) */}
                      <CharAvatar gender={m.gender} skinIdx={m.skinIdx} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-[12px] font-black text-white">{m.name}</p>
                          <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-black" style={{ color, background: `${color}22` }}>
                            {classLabel(m.cls as ClassKey) || "무직"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-black text-amber-200">Lv. {m.lv}{m.rebirths > 0 ? ` · 환생 ${m.rebirths}회` : ""}</p>
                        <p className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold text-white/40">
                          <Clock size={8} />
                          {relTime(m.lastSeen)}
                        </p>
                      </div>
                    </div>
                    {m.cleared && <p className="mt-1 text-[8px] font-black text-emerald-300">세계수 구원 완료</p>}
                  </button>
                );
              })}
              {/* 생성 카드 / 잠긴 슬롯 */}
              {used < store.slots ? (
                <button
                  onClick={openCreate}
                  className="game-chip flex min-h-[92px] flex-col items-center justify-center gap-1 border-dashed text-white/50 transition-colors hover:border-[#e8c064] hover:text-[#ffd98a]"
                >
                  <UserPlus size={18} />
                  <p className="text-[10px] font-black">캐릭터 생성</p>
                </button>
              ) : (
                <div className="game-chip flex min-h-[92px] flex-col items-center justify-center gap-1 border-dashed text-white/25">
                  <Lock size={16} />
                  <p className="text-[9px] font-bold">슬롯 확장 필요</p>
                </div>
              )}
            </div>
            <button onClick={expand} className="game-btn-ghost mx-auto mt-2 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-[#f0e2c0] active:scale-95">
              <Coins size={11} className="text-[#ffd98a]" />
              슬롯 확장 (유니온 코인 60) — {used}/{store.slots}
            </button>
          </div>

          {/* 정보 패널 — 게임형 프레임 */}
          <div className="game-panel w-full shrink-0 p-3 lg:w-[340px]">
            {creating ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-black text-[#ffd98a]">캐릭터 생성</p>
                  <button onClick={() => setCreating(false)} className="game-chip flex h-7 w-7 items-center justify-center text-white/50">
                    <ChevronLeft size={13} />
                  </button>
                </div>
                {/* v1.0.19 (B-1) — 3단계 인디케이터: ①이름 → ②직업 → ③외형 */}
                <div className="mb-2 flex items-center gap-1">
                  {STEP_LABELS.map((lb, i) => (
                    <div key={lb} className="flex flex-1 items-center gap-1">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${i === step ? "bg-amber-400 text-slate-900" : i < step ? "bg-emerald-400/80 text-slate-900" : "border border-white/20 bg-black/40 text-white/40"}`}>
                        {i < step ? "✓" : i + 1}
                      </span>
                      <span className={`text-[9px] font-black ${i === step ? "text-amber-200" : "text-white/40"}`}>{lb}</span>
                      {i < STEP_LABELS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-emerald-400/60" : "bg-white/15"}`} />}
                    </div>
                  ))}
                </div>

                {/* ── 1단계: 닉네임 ── */}
                {step === 0 && (
                  <div>
                    <p className="text-[10px] font-bold leading-relaxed text-white/55">모험가의 이름을 정해라. (최대 8자 — 게임 내 모든 캐릭터에서 이 이름으로 불린다)</p>
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      maxLength={8}
                      placeholder="캐릭터 이름 (최대 8자)"
                      className="game-input mt-2 w-full px-3 py-2.5 text-[13px] font-bold placeholder:text-white/25"
                    />
                    {msg && <p className="mt-1 text-[10px] font-black text-[#ff9a8a]">{msg}</p>}
                    <button
                      onClick={() => { if (nameOk) { setMsg(null); setStep(1); } }}
                      disabled={!nameOk}
                      className="game-btn mt-2 flex w-full items-center justify-center gap-1 px-3 py-2.5 text-[12px] font-black active:scale-95"
                    >
                      다음 — 직업 선택
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* ── 2단계: 직업 선택 ── */}
                {step === 1 && (
                  <div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CLASS_PREVIEWS.map((p) => {
                        const d = classDef(p.key)!;
                        const on = pickCls === p.key;
                        return (
                          <button
                            key={p.key}
                            onClick={() => setPickCls(p.key)}
                            className={`game-tab min-h-[52px] px-2 py-2 text-left transition-transform active:scale-95 ${on ? "game-tab-on" : ""}`}
                            style={on ? undefined : undefined}
                          >
                            <p className="text-[12px] font-black" style={{ color: on ? "#3a2508" : d.color }}>{d.name}</p>
                            <p className="text-[8px] font-bold" style={{ color: on ? "#6b4a1c" : "rgba(255,255,255,0.4)" }}>{d.title}</p>
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
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button onClick={() => setStep(0)} className="game-btn-ghost flex items-center justify-center gap-1 px-3 py-2.5 text-[11px] font-black active:scale-95">
                        <ChevronLeft size={13} />
                        이름
                      </button>
                      <button onClick={() => setStep(2)} className="game-btn flex items-center justify-center gap-1 px-3 py-2.5 text-[11px] font-black active:scale-95">
                        다음 — 외형 선택
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── 3단계: 외형 선택 (v1.1.0 — 성별 + 피부 6종, 실제 스프라이트 미리보기) ── */}
                {step === 2 && (
                  <div>
                    <p className="text-[10px] font-bold leading-relaxed text-white/55">성별과 피부를 골라 외형을 꾸며라. 언제든 로비에서 다른 캐릭터를 만들 수 있다.</p>
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/12 bg-black/40 p-2.5">
                      <CharAvatar gender={lookGender} skinIdx={lookSkin} size={64} />
                      <div>
                        <p className="text-[11px] font-black text-white">{nameInput.trim() || "이름 미정"}</p>
                        <p className="text-[9px] font-bold" style={{ color: clsColor(pickCls) }}>{classLabel(pickCls)} · Lv.1</p>
                        <p className="mt-0.5 text-[9px] font-black text-amber-200">{lookGender === "f" ? "여캐" : "남캐"} · {SKIN_CHOICES.find((x) => x.idx === lookSkin)?.name ?? "기본"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[9px] font-black text-white/50">성별</p>
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      {([["m", "남캐", "hero"], ["f", "여캐", "chf2"]] as const).map(([g, label, spr]) => {
                        const on = lookGender === g;
                        return (
                          <button
                            key={g}
                            onClick={() => setLookGender(g)}
                            className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 transition-transform active:scale-95 ${on ? "border-amber-300 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"}`}
                          >
                            <img src={`/assets/${spr}_idle0.webp`} alt="" style={{ width: 30, height: 30, imageRendering: "pixelated", objectFit: "cover", objectPosition: "35% 78%" }} draggable={false} />
                            <span className={`text-[10px] font-black ${on ? "text-amber-200" : "text-white/60"}`}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[9px] font-black text-white/50">피부</p>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      {SKIN_CHOICES.map((s) => {
                        const on = lookSkin === s.idx;
                        return (
                          <button
                            key={s.idx}
                            onClick={() => setLookSkin(s.idx)}
                            className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1 transition-transform active:scale-95 ${on ? "border-amber-300 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"}`}
                          >
                            <img src={lookSprite(lookGender, s.idx)} alt={s.name} style={{ width: 32, height: 32, imageRendering: "pixelated", objectFit: "cover", objectPosition: "35% 78%" }} draggable={false} />
                            <span className={`text-[8px] font-black ${on ? "text-amber-200" : "text-white/45"}`}>{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {msg && <p className="mt-1 text-[10px] font-black text-[#ff9a8a]">{msg}</p>}
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button onClick={() => setStep(1)} className="game-btn-ghost flex items-center justify-center gap-1 px-3 py-2.5 text-[11px] font-black active:scale-95">
                        <ChevronLeft size={13} />
                        직업
                      </button>
                      <button
                        onClick={doCreate}
                        className="game-btn px-3 py-2.5 text-[12px] font-black active:scale-95"
                      >
                        {classDef(pickCls)!.name}로 생성!
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : sel ? (
              <div>
                <div className="flex items-center gap-2.5">
                  <CharAvatar gender={sel.gender} skinIdx={sel.skinIdx} size={52} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-white">{sel.name}</p>
                    <p className="text-[10px] font-bold" style={{ color: clsColor(sel.cls) }}>
                      {classLabel(sel.cls as ClassKey) || "무직"} · Lv. {sel.lv} · 환생 {sel.rebirths}회
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-center">
                  <div className="game-chip py-1.5">
                    <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Swords size={8} />공격력</p>
                    <p className="text-[11px] font-black text-[#ffd98a]">{selSave?.atk ?? "?"}</p>
                  </div>
                  <div className="game-chip py-1.5">
                    <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Shield size={8} />최대 HP</p>
                    <p className="text-[11px] font-black text-[#ffb0b0]">{selSave?.maxHp ?? "?"}</p>
                  </div>
                  <div className="game-chip py-1.5">
                    <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Zap size={8} />골드</p>
                    <p className="text-[11px] font-black text-[#ffe49a]">{(selSave?.gold ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="game-chip py-1.5">
                    <p className="flex items-center justify-center gap-0.5 text-[8px] font-bold text-white/40"><Gauge size={8} />마지막 구역</p>
                    <p className="truncate text-[11px] font-black text-[#cbb88a]">{sel.stage}</p>
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
                  className="game-btn mt-2.5 flex w-full items-center justify-center gap-1.5 px-3 py-3 text-[13px] font-black active:scale-95"
                >
                  <Play size={15} />
                  이 캐릭터로 시작
                </button>
                <p className="mt-1 text-center text-[8px] font-bold text-white/30">카드를 더블클릭해도 바로 시작된다</p>
                <button
                  onClick={() => setDelId(sel.id)}
                  className="mx-auto mt-1 flex items-center gap-1 text-[10px] font-bold text-white/35 underline underline-offset-2 hover:text-[#ff9a8a]"
                >
                  <Trash2 size={11} />
                  캐릭터 삭제
                </button>
                {msg && <p className="mt-1 text-[10px] font-black text-[#ff9a8a]">{msg}</p>}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <UserPlus size={26} className="text-white/25" />
                <p className="text-[11px] font-black text-white/50">첫 캐릭터를 만들어 모험을 시작하자</p>
                <button onClick={openCreate} className="game-btn px-4 py-2.5 text-[11px] font-black">
                  캐릭터 생성
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {delId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70" onPointerDown={() => setDelId(null)}>
          <div className="game-panel w-[min(92vw,340px)] p-4" onPointerDown={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-black text-[#ff9a8a]">정말 삭제하시겠습니까?</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/60">
              <b className="text-white">{store.chars[delId]?.name}</b>의 레벨·장비·진행도가 영구히 사라진다. (유니온 코인·아티팩트는 계정에 유지)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button onClick={() => setDelId(null)} className="game-btn-ghost px-3 py-2.5 text-[11px] font-black active:scale-95">
                취소
              </button>
              <button
                onClick={() => {
                  deleteCharacter(delId);
                  setDelId(null);
                  setSelId(null);
                  refresh();
                }}
                className="game-btn-danger px-3 py-2.5 text-[11px] font-black active:scale-95"
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
void isClassKey;
