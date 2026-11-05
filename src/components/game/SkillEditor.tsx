"use client";

/**
 * 스킬 메이커 (지시: "스킬 메이커").
 *
 * [설계 원칙 — 타일맵 에디터와 동일]
 *  ① **게임과 같은 로직** — 검증·판정·데미지·쿨다운을 `skillEditorCore` 에서 가져온다.
 *     여기서 공식을 다시 적지 않는다. 에디터가 보여주는 숫자가 게임과 다르면 의미가 없다.
 *  ② **의존성 0** — canvas 2D + React 만 쓴다. Phaser 를 띄우지 않으므로 편집 중
 *     게임 루프·물리가 끼어들지 않는다.
 *  ③ **검증 내장** — 저장 전에 `validateSkill`/`validateSkillSet` 으로 게임이 깨지는
 *     조건(ID 충돌, 슬롯≠메커니즘, 음수 MP, 판정 없음)을 잡는다.
 *  ④ **실행 취소** — 모든 편집은 히스토리에 쌓인다(최대 40). 숫자를 잘못 만졌을 때 되돌린다.
 *
 * [조작]
 *  좌: 스킬 목록(추가·복제·삭제) / 중앙: 판정 미리보기 + 필드 폼 / 우: 검증 + 데미지
 *  Ctrl+Z 실행취소, Ctrl+S 저장(JSON 내려받기)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLASS_OPTIONS, ELEMENT_OPTIONS, SLOT_KINDS, SLOT_RULES, SKILL_SLOTS, ZONE_SHAPES,
  createSkill, deserializeSkills, hitTest, maxMpAt, nextSkillId, previewCooldownMs,
  previewDamage, retargetSlot, serializeSkills, skillsFromGame, validateSkill, validateSkillSet,
  zoneFor,
  type SkillDef, type SkillSlot, type SkillZoneShape,
} from "@/game/skillEditorCore";

/* ─────────────────────────── 상수 ─────────────────────────── */

const HISTORY_MAX = 40;
/** 캔버스 판정 미리보기 배율 — 1px = 0.5 화면px (450px 판정도 225px 로 들어온다) */
const VIEW_SCALE = 0.42;
const VIEW_W = 470;
const VIEW_H = 300;

type Doc = { name: string; skills: SkillDef[] };

const clone = (d: Doc): Doc => ({ name: d.name, skills: d.skills.map((s) => ({ ...s, hit: { ...s.hit }, pulsesMs: [...s.pulsesMs] })) });

const TIPS = [
  "좌: 목록 · 중앙: 판정/필드 · 우: 검증",
  "Ctrl+Z 실행취소 · Ctrl+S 저장",
  "ID 는 저장 키 — 중복 불가",
];

/* ─────────────────────────── 페이지 ─────────────────────────── */

export default function SkillEditor() {
  /* 처음 열면 게임 테이블에서 12개만 가져온다 — 112개 전체는 목록이 너무 길다.
   * 전체는 "게임에서 불러오기" 로 언제든 확보할 수 있다. */
  const initial = useMemo<Doc>(() => {
    const all = skillsFromGame();
    return { name: "certz-skills", skills: all.slice(0, 12) };
  }, []);

  const [doc, setDoc] = useState<Doc>(initial);
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState("");
  const [atkTotal, setAtkTotal] = useState(800);
  const [crit, setCrit] = useState(false);
  const [isFifth, setIsFifth] = useState(false);

  const history = useRef<Doc[]>([]);
  const lastPushAt = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * 히스토리 스냅샷.
   *
   * [왜 시간 병합(coalescing)인가]
   *  숫자 입력은 한 글자마다 onChange 가 온다. "1200" 을 치면 4개 스냅샷이 쌓여
   *  Ctrl+Z 를 4번 눌러야 원래 값으로 돌아간다 — 실행취소가 쓸모없어진다.
   *  500ms 안의 연속 편집을 **한 번의 편집**으로 묶으면 "방금 만진 값 되돌리기" 가 된다.
   *
   * [왜 setDoc 밖에서 부르는가]
   *  상태 업데이터는 React 가 두 번 호출할 수 있다(StrictMode 개발 모드).
   *  업데이터 안에서 ref 를 밀면 스냅샷이 중복으로 쌓인다. 호출부에서 미리 민다.
   */
  const pushHistory = useCallback((snap: Doc, force = false) => {
    const now = Date.now();
    if (!force && now - lastPushAt.current < 500) return;
    lastPushAt.current = now;
    history.current.push(clone(snap));
    if (history.current.length > HISTORY_MAX) history.current.shift();
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      lastPushAt.current = 0; /* 되돌린 직후의 편집은 새 스냅샷이어야 한다 */
      setDoc(prev);
      setSel((i) => Math.min(i, prev.skills.length - 1));
      setStatus("실행취소");
    } else setStatus("되돌릴 작업이 없습니다");
  }, []);

  const cur = doc.skills[Math.min(sel, doc.skills.length - 1)] ?? null;

  /* ── 편집 ── */
  const patch = useCallback((p: Partial<SkillDef>) => {
    pushHistory(doc);
    setDoc((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === sel ? { ...s, ...p, hit: p.hit ? { ...p.hit } : s.hit } : s)),
    }));
  }, [doc, sel, pushHistory]);

  const patchHit = useCallback((p: Partial<SkillDef["hit"]>) => {
    pushHistory(doc);
    setDoc((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === sel ? { ...s, hit: { ...s.hit, ...p } } : s)),
    }));
  }, [doc, sel, pushHistory]);

  const addSkill = useCallback(() => {
    pushHistory(doc, true);
    const s = createSkill({ id: nextSkillId(doc.skills), name: `새 스킬 ${doc.skills.length + 1}` });
    setDoc((prev) => ({ ...prev, skills: [...prev.skills, s] }));
    setSel(doc.skills.length);
    setStatus("스킬 추가");
  }, [doc, pushHistory]);

  const dupSkill = useCallback(() => {
    if (!cur) return;
    pushHistory(doc, true);
    /* 복제는 ID 를 반드시 새로 뗀다 — 같은 ID 두 개는 저장 키 충돌(validateSkillSet 이 잡는다). */
    const copy = { ...cur, id: nextSkillId(doc.skills), name: `${cur.name} 복사`, hit: { ...cur.hit }, pulsesMs: [...cur.pulsesMs] };
    const skills = [...doc.skills];
    skills.splice(sel + 1, 0, copy);
    setDoc({ ...doc, skills });
    setSel(sel + 1);
    setStatus("스킬 복제");
  }, [cur, doc, sel, pushHistory]);

  const delSkill = useCallback(() => {
    if (!cur) return;
    pushHistory(doc, true);
    setDoc({ ...doc, skills: doc.skills.filter((_, i) => i !== sel) });
    setSel((i) => Math.max(0, i - 1));
    setStatus(`삭제: ${cur.id}`);
  }, [cur, doc, sel, pushHistory]);

  const loadGame = useCallback(() => {
    pushHistory(doc, true);
    setDoc({ name: "certz-skills", skills: skillsFromGame() });
    setSel(0);
    setStatus("게임 테이블에서 불러옴");
  }, [doc, pushHistory]);

  /* ── 검증 ── */
  const curCheck = useMemo(
    () => (cur ? validateSkill(cur, { otherIds: doc.skills.filter((_, i) => i !== sel).map((s) => s.id) }) : null),
    [cur, doc.skills, sel],
  );
  const setCheck = useMemo(() => validateSkillSet(doc.skills), [doc.skills]);

  /* ── 데미지/쿨다운 미리보기 ── */
  const dmg = useMemo(
    () => (cur ? previewDamage(cur, { atkTotal, crit, isFifth }) : null),
    [cur, atkTotal, crit, isFifth],
  );
  const cd = useMemo(() => (cur ? previewCooldownMs(cur, { isFifth, cdMult: 1 }) : 0), [cur, isFifth]);
  const dps = dmg && cd > 0 ? Math.round((dmg.total / (cd / 1000)) * 10) / 10 : 0;

  /* ── 캔버스: 판정 미리보기 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cur) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    canvas.width = VIEW_W * dpr; canvas.height = VIEW_H * dpr;
    canvas.style.width = `${VIEW_W}px`; canvas.style.height = `${VIEW_H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    /* 배경 격자 — 64px 게임 격자를 시각 기준으로 */
    ctx.fillStyle = "#0e1016";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const step = 64 * VIEW_SCALE;
    ctx.strokeStyle = "#ffffff0d";
    ctx.lineWidth = 1;
    for (let x = 0; x < VIEW_W; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, VIEW_H); ctx.stroke(); }
    for (let y = VIEW_H / 2 % step; y < VIEW_H; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(VIEW_W, y + 0.5); ctx.stroke(); }

    const ox = 60, oy = VIEW_H / 2;
    /* 시전자 — 게임 좌표를 화면으로 옮기는 기준점 */
    ctx.fillStyle = "#e8c064";
    ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000000aa";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("YOU", ox, oy);

    /* 조준 방향 */
    ctx.strokeStyle = "#e8c06466";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(VIEW_W - 12, oy); ctx.stroke();
    ctx.setLineDash([]);

    /* 판정 도형 — 게임의 SignatureZone 을 그대로 그린다(좌표 변환만) */
    const z = zoneFor(cur, { x: 0, y: 0 }, 0);
    const sx = (v: number) => ox + v * VIEW_SCALE;
    const sy = (v: number) => oy + v * VIEW_SCALE;
    ctx.beginPath();
    if (z.kind === "circle") {
      ctx.arc(ox, oy, z.radius * VIEW_SCALE, 0, Math.PI * 2);
    } else if (z.kind === "box") {
      ctx.rect(ox - z.radius * VIEW_SCALE, oy - z.radius * VIEW_SCALE, z.radius * 2 * VIEW_SCALE, z.radius * 2 * VIEW_SCALE);
    } else if (z.kind === "sector") {
      const r = z.radius * VIEW_SCALE;
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, r, z.angle - z.halfAngle, z.angle + z.halfAngle);
      ctx.closePath();
    } else {
      const len = z.length * VIEW_SCALE, hw = (z.width / 2) * VIEW_SCALE;
      ctx.moveTo(ox, oy - hw); ctx.lineTo(ox + len, oy - hw);
      ctx.lineTo(ox + len, oy + hw); ctx.lineTo(ox, oy + hw);
      ctx.closePath();
    }
    ctx.fillStyle = "#ffb84a2e";
    ctx.fill();
    ctx.strokeStyle = "#ffb84acc";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* 표적 더미 — hitTest(게임 함수)로 명중/빗나감을 색으로 확인한다 */
    const dummies: { x: number; y: number; r: number }[] = [];
    for (let dx = 120; dx <= 520; dx += 130) for (const dy of [-110, 0, 110]) dummies.push({ x: dx, y: dy, r: 18 });
    for (const d of dummies) {
      const inside = hitTest(cur, { x: 0, y: 0 }, 0, { x: d.x, y: d.y }, d.r);
      ctx.fillStyle = inside ? "#7fe3a1" : "#5b6577";
      ctx.globalAlpha = inside ? 0.95 : 0.5;
      ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), d.r * VIEW_SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* 범위 라벨 */
    ctx.fillStyle = "#ffffff55";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    const reach = z.kind === "beam" ? z.length : z.radius;
    ctx.fillText(`${z.kind} · ${Math.round(reach)}px · ×${Math.round(VIEW_SCALE * 100)}%`, 8, 12);
  }, [cur]);

  /* ── 저장 / 불러오기 ── */
  const save = useCallback(() => {
    const json = serializeSkills({ name: doc.name, skills: doc.skills });
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `certz-skills-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`저장 완료 · 스킬 ${doc.skills.length}개 · 문제 ${setCheck.errors.length}건`);
  }, [doc, setCheck.errors.length]);

  const load = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = deserializeSkills(JSON.parse(String(rd.result)));
        if (!parsed) { setStatus("불러오기 실패 — 형식이 맞지 않습니다"); return; }
        /* 불러오기는 되돌릴 수 있어야 한다 — force 로 병합 창을 건너뛴다. */
        pushHistory(doc, true);
        setDoc({ name: parsed.name, skills: parsed.skills });
        setSel(0);
        setStatus(`불러옴: ${f.name} · ${parsed.skills.length}개`);
      } catch { setStatus("불러오기 실패 — JSON 오류"); }
    };
    rd.readAsText(f);
  };

  /* ── 단축키 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, save]);

  const rule = cur ? SLOT_RULES[cur.slot] : null;

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-[#0b0d12] text-[#cfd6e4]">
      {/* 상단 바 */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[13px] font-black tracking-wide text-amber-200">SERTZ 스킬 메이커</span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
          스킬 {doc.skills.length} · 문제 {setCheck.errors.length} · 경고 {setCheck.warnings.length}
        </span>
        <input
          value={doc.name}
          onChange={(e) => setDoc((p) => ({ ...p, name: e.target.value }))}
          className="w-[150px] rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[11px]"
          aria-label="문서 이름"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={loadGame} className="rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">게임에서 불러오기</button>
          <label className="cursor-pointer rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">
            불러오기<input type="file" accept=".json" onChange={load} className="hidden" />
          </label>
          <button onClick={save} className="rounded border border-amber-300/50 bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-100 hover:bg-amber-400/25">저장</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 좌: 스킬 목록 */}
        <aside className="flex w-[214px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/10 p-2">
          <Section title="스킬 목록">
            <div className="mb-1 grid grid-cols-3 gap-1">
              <button onClick={addSkill} className="rounded bg-amber-400/20 px-1 py-1 text-[10px] font-bold text-amber-100 ring-1 ring-amber-300/40 hover:bg-amber-400/30">추가</button>
              <button onClick={dupSkill} disabled={!cur} className="rounded bg-white/5 px-1 py-1 text-[10px] hover:bg-white/10 disabled:opacity-40">복제</button>
              <button onClick={delSkill} disabled={!cur} className="rounded bg-rose-500/15 px-1 py-1 text-[10px] text-rose-200 hover:bg-rose-500/25 disabled:opacity-40">삭제</button>
            </div>
            <div className="max-h-[calc(100dvh-190px)] space-y-0.5 overflow-y-auto">
              {doc.skills.map((s, i) => {
                const bad = validateSkill(s).errors.length > 0;
                return (
                  <button
                    key={`${s.id}-${i}`}
                    onClick={() => setSel(i)}
                    className={`flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[10px] ${i === sel ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40" : "bg-white/5 hover:bg-white/10"}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bad ? "bg-rose-400" : "bg-emerald-400"}`} />
                    <span className="w-[26px] shrink-0 font-mono text-[8px] text-white/40">{s.slot}</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
              {doc.skills.length === 0 && <p className="text-[10px] text-white/35">없음 — 추가를 누르세요</p>}
            </div>
          </Section>
          <button onClick={undo} className="mt-auto rounded border border-white/15 px-2 py-1.5 text-[11px] hover:bg-white/10">
            실행취소 <span className="text-white/40">Ctrl+Z</span>
          </button>
        </aside>

        {/* 중앙: 판정 + 폼 */}
        <main className="min-h-0 flex-1 overflow-y-auto p-3">
          {!cur && <p className="text-[11px] text-white/40">스킬을 선택하거나 추가하세요.</p>}
          {cur && (
            <>
              <canvas ref={canvasRef} className="rounded border border-white/10 shadow-2xl" />
              <p className="mt-1.5 text-[10px] text-white/35">
                초록 = 명중(게임의 signatureZoneContains 로 판정) · 회색 = 빗나감
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                <Field label="ID (저장 키)">
                  <input value={cur.id} onChange={(e) => patch({ id: e.target.value })} className={inputCls} />
                </Field>
                <Field label="이름">
                  <input value={cur.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="슬롯">
                  <select
                    value={cur.slot}
                    onChange={(e) => patch(retargetSlot(cur, e.target.value as SkillSlot))}
                    className={inputCls}
                  >
                    {SKILL_SLOTS.map((k) => <option key={k} value={k}>{SLOT_RULES[k].label}</option>)}
                  </select>
                </Field>
                <Field label="직업">
                  <select value={cur.cls} onChange={(e) => patch({ cls: e.target.value as SkillDef["cls"] })} className={inputCls}>
                    {CLASS_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="메커니즘 키">
                  <select value={cur.kind} onChange={(e) => patch({ kind: e.target.value as SkillDef["kind"] })} className={inputCls}>
                    {SLOT_KINDS[cur.slot].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="원소">
                  <select value={cur.element} onChange={(e) => patch({ element: e.target.value as SkillDef["element"] })} className={inputCls}>
                    {ELEMENT_OPTIONS.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
                  </select>
                </Field>

                <Num label={`MP (슬롯 기본 ${rule!.mp})`} value={cur.mp} onChange={(v) => patch({ mp: v })} />
                <Num label={`쿨다운 ms (슬롯 기본 ${rule!.cooldownMs})`} value={cur.cooldownMs} onChange={(v) => patch({ cooldownMs: v })} step={100} />
                <Num label="데미지 계수 (×100%)" value={cur.mult} onChange={(v) => patch({ mult: v })} step={0.05} />
                <Num label="차수 1~5" value={cur.sTier} onChange={(v) => patch({ sTier: v })} />
                <Field label="궁극기 슬롯">
                  <select value={cur.ultSlot} onChange={(e) => patch({ ultSlot: Number(e.target.value) as 0 | 1 | 2 })} className={inputCls}>
                    <option value={0}>0 · 일반</option>
                    <option value={1}>1 · 제1궁극기 ×3.0</option>
                    <option value={2}>2 · 제2궁극기 ×5.0</option>
                  </select>
                </Field>
                <Field label="해금 레벨 (읽기 전용)">
                  <div className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-[11px] text-white/60">Lv.{rule!.unlockLevel}</div>
                </Field>
              </div>

              <h3 className="mb-1 mt-3 text-[9px] font-black uppercase tracking-wider text-white/35">판정</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Field label="형태">
                  <select value={cur.hit.shape} onChange={(e) => patchHit({ shape: e.target.value as SkillZoneShape })} className={inputCls}>
                    {ZONE_SHAPES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </Field>
                {cur.hit.shape === "beam" ? (
                  <>
                    <Num label="길이 px" value={cur.hit.length} onChange={(v) => patchHit({ length: v })} step={10} />
                    <Num label="폭 px" value={cur.hit.width} onChange={(v) => patchHit({ width: v })} step={5} />
                  </>
                ) : (
                  <Num label="반지름 px" value={cur.hit.radius} onChange={(v) => patchHit({ radius: v })} step={10} />
                )}
                {cur.hit.shape === "sector" && (
                  <Num label="반각 rad (0.6 ≈ 34°)" value={cur.hit.halfAngle} onChange={(v) => patchHit({ halfAngle: v })} step={0.05} />
                )}
              </div>

              <h3 className="mb-1 mt-3 text-[9px] font-black uppercase tracking-wider text-white/35">시전 타이밍</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Num label="선딜 ms" value={cur.startupMs} onChange={(v) => patch({ startupMs: v })} step={10} />
                <Num label="후딜 ms" value={cur.recoveryMs} onChange={(v) => patch({ recoveryMs: v })} step={10} />
                <Field label="타격 시각 ms (쉼표)">
                  <input
                    value={cur.pulsesMs.join(", ")}
                    onChange={(e) => {
                      const parts = e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
                      patch({ pulsesMs: parts.length ? parts : [] });
                    }}
                    className={inputCls}
                  />
                </Field>
              </div>

              <p className="mt-2 text-[10px] text-white/35">{TIPS.join("　·　")}</p>
              {status && <p className="mt-1 text-[11px] text-amber-200/80">{status}</p>}
            </>
          )}
        </main>

        {/* 우: 검증 + 데미지 */}
        <aside className="w-[246px] shrink-0 overflow-y-auto border-l border-white/10 p-2">
          <Section title="이 스킬 검증">
            {!cur && <p className="text-[10px] text-white/35">선택 없음</p>}
            {cur && curCheck && (
              <>
                <div className={`rounded px-2 py-1.5 text-[11px] font-bold ${curCheck.ok ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>
                  {curCheck.ok ? "통과" : `문제 ${curCheck.errors.length}건`}
                </div>
                {curCheck.errors.map((e, i) => (
                  <p key={`e${i}`} className="mt-1 rounded bg-rose-500/10 px-1.5 py-1 text-[10px] leading-tight text-rose-200">{e}</p>
                ))}
                {curCheck.warnings.map((w, i) => (
                  <p key={`w${i}`} className="mt-1 rounded bg-amber-500/10 px-1.5 py-1 text-[10px] leading-tight text-amber-200">{w}</p>
                ))}
              </>
            )}
          </Section>

          <Section title="묶음 검증">
            <div className={`rounded px-2 py-1.5 text-[11px] font-bold ${setCheck.ok ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>
              {setCheck.ok ? `전체 ${doc.skills.length}개 통과` : `문제 ${setCheck.errors.length}건`}
            </div>
            {setCheck.errors.slice(0, 6).map((e, i) => (
              <p key={i} className="mt-1 rounded bg-rose-500/10 px-1.5 py-1 text-[9px] leading-tight text-rose-200/90">{e}</p>
            ))}
            {setCheck.errors.length > 6 && <p className="mt-1 text-[9px] text-white/40">…외 {setCheck.errors.length - 6}건</p>}
          </Section>

          <Section title="데미지 미리보기">
            <label className="flex items-center justify-between gap-1 text-[10px] text-white/60">
              공격력
              <input
                type="number" value={atkTotal} step={50}
                onChange={(e) => setAtkTotal(Math.max(1, Number(e.target.value) || 1))}
                className="w-[90px] rounded border border-white/15 bg-[#151922] px-1.5 py-0.5 text-right text-[10px]"
              />
            </label>
            <label className="mt-1 flex items-center gap-1.5 text-[10px]">
              <input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> 크리티컬 (×1.7)
            </label>
            <label className="mt-1 flex items-center gap-1.5 text-[10px]">
              <input type="checkbox" checked={isFifth} onChange={(e) => setIsFifth(e.target.checked)} /> 5차 각성
            </label>

            {dmg && (
              <div className="mt-2 space-y-0.5">
                <Row k="1회 피해" v={dmg.perHit.toLocaleString()} />
                <Row k="타수" v={String(dmg.hits)} />
                <Row k="최종 배율" v={`×${dmg.multiplier.toFixed(3)}`} />
                <Row k="총 피해" v={<span className="text-amber-200">{dmg.total.toLocaleString()}</span>} />
              </div>
            )}
            <p className="mt-2 text-[9px] leading-tight text-white/30">
              게임의 damageModel(calcDamage·damageMultiplier)을 직접 호출한 값입니다.
            </p>
          </Section>

          <Section title="쿨다운 실효">
            <Row k="기본" v={`${(cur?.cooldownMs ?? 0).toLocaleString()}ms`} />
            <Row k="차수 보정 후" v={`${cd.toLocaleString()}ms`} />
            <Row k="DPS (이론)" v={dps ? dps.toLocaleString() : "—"} />
            <p className="mt-1 text-[9px] leading-tight text-white/30">
              차수 계단 −8%/단, 하한 68% · 5차 −15% (Player.skill1MaxEff 와 같은 식). 직업 cdMult 는 1 로 계산합니다.
            </p>
          </Section>

          <Section title="슬롯 규칙 (게임 하드코딩)">
            {cur && (
              <>
                <Row k="MP" v={String(rule!.mp)} />
                <Row k="쿨다운" v={`${rule!.cooldownMs}ms`} />
                <Row k="궁극기 슬롯" v={String(rule!.ultSlot)} />
                <Row k="해금" v={`Lv.${rule!.unlockLevel}`} />
                <Row k="해금 시 최대 MP" v={String(maxMpAt(rule!.unlockLevel))} />
              </>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────────────────── 소품 ─────────────────────────── */

const inputCls = "w-full rounded border border-white/15 bg-[#151922] px-1.5 py-1 text-[11px]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/35">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[10px] text-white/60">
      <span>{k}</span><span className="font-bold text-white/85">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9px] text-white/40">{label}</span>
      {children}
    </label>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <Field label={label}>
      <input
        type="number" value={Number.isFinite(value) ? value : 0} step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={inputCls}
      />
    </Field>
  );
}
