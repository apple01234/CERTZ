"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveServerUrl } from "@/game/net"; // v1.4.6 — APK 정적 export에서도 원격 서버 API 호출

/** v1.4.6 — API 베이스: 웹=same-origin(""), APK=저장된 https 서버(오프라인이면 "") */
const apiBase = () => {
  try { return resolveServerUrl() || ""; } catch { return ""; }
};

/**
 * v1.4.5 (#유저지원페이지 — 유저 지시 #7)
 *  서브컬처(오타쿠) 감성의 게임 지원 센터:
 *  · FAQ · 기기 데이터 즉시 삭제 · 계정 삭제 · 문의 폼(Play Console 계정 삭제 URL 용도)
 *  같은 오리진에서 동작하므로 "내 기기 데이터 즉시 삭제"가 게임 세이브에 그대로 적용된다.
 */

const CATS = ["일반 문의", "계정 문의", "데이터 삭제 요청", "버그 제보", "제안·피드백"] as const;

const FAQS: { q: string; a: string }[] = [
  {
    q: "첫 사냥터에 들어가려면 Lv.3가 필요한데 레벨을 못 찍어요",
    a: "마을에서 카이엔 교관(전직관 앞), 주민, 마을 아이 — 세 명과 대화를 모두 끝내면 자동으로 Lv.3가 됩니다. v1.4.4에서 추가된 공식 절차예요.",
  },
  {
    q: "게임이 계속 재부팅돼요 (무한 재부팅)",
    a: "v1.4.5에서 재부팅 루프를 원천 차단했습니다. 이전 버전에서는 ARG 웹페이지 등 외부 페이지에 다녀온 뒤 GPU 상태가 나빠져 반복 재시작될 수 있었어요. 최신 APK로 재설치해 주세요.",
  },
  {
    q: "등급업 큐브를 눌러도 아무 일도 없어요",
    a: "v1.4.3부터 가방의 기타 탭에서 등급업 큐브를 선택하면 '무기 등급업'/'방어구 등급업' 버튼이 바로 나옵니다. 이미 전설 등급이라면 더 이상 승급할 수 없어요.",
  },
  {
    q: "마을의 계단·유적 구조물이 사라졌어요",
    a: "v1.4.3에서 보물 상자만 남기고 구조물은 모두 정리했습니다 (유저 의견 반영). 보이지 않는 히트박스도 함께 사라졌어요.",
  },
  {
    q: "보스 유물 이미지가 깨져서 보여요",
    a: "v1.4.3에서 UI 아이콘 로드 실패 시 자동 재시도가 도입됐습니다. 그래도 깨진다면 패널을 닫았다 다시 열어 주세요.",
  },
  {
    q: "멀티는 어디서 하나요?",
    a: "게임 내 화면 오른쪽 위 '더보기 → 멀티' 버튼(또는 왼쪽의 파티 칩)에서 파티 창설/코드 참여를 할 수 있어요. 타이틀 화면에서 서버 연결이 필요합니다.",
  },
];

export default function SupportPage() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("일반 문의");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [wipeMsg, setWipeMsg] = useState<string | null>(null);
  const [delMsg, setDelMsg] = useState<string | null>(null);

  /* 기기 데이터 즉시 삭제 — 같은 오리진이라 게임 세이브에 바로 적용된다 */
  const wipeDeviceData = () => {
    if (!confirm("정말 삭제할까요?\n\n· 캐릭터 세이브(모든 슬롯)\n· 이스터에그/비밀수첩 기록\n· 방문 기록·무릉도장 최고기록\n\n설정(음량·키배치·서버주소)은 유지됩니다. 이 되돌릴 수 없어요!")) return;
    try {
      const removed: string[] = [];
      const kill = (k: string) => {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k);
          removed.push(k);
        }
      };
      kill("sertz_save_v2");
      kill("sertz_slots_v1");
      kill("sertz.eggs");
      kill("sertz.visits");
      kill("sertz.autoResume");
      kill("sertz.dojang.best");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("sertz_char_") || k.startsWith("sertz.keep.chest."))) {
          localStorage.removeItem(k);
          removed.push(k);
        }
      }
      setWipeMsg(`삭제 완료 — ${removed.length}개 기록 정리됨. 게임 페이지를 새로 고침하면 초기 상태로 시작됩니다.`);
    } catch {
      setWipeMsg("삭제에 실패했어요 — 브라우저 설정에서 사이트 데이터를 직접 지워 주세요.");
    }
  };

  const deleteAccount = async () => {
    if (!confirm("계정을 정말 삭제할까요?\n\n· 클라우드 세이브\n· 랭킹 기록\n· 거래소 등록 물건\n\n삭제된 계정은 복구할 수 없습니다!")) return;
    setDelMsg(null);
    try {
      const r = await fetch(`${apiBase()}/api/auth/delete`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ confirm: "DELETE" }),
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setDelMsg("계정이 삭제되었습니다. 그동안 모험해 주셔서 감사했어요… 🌱");
      else setDelMsg(j.error || `삭제 실패 (${r.status}) — 게임에서 로그인한 뒤 시도해 주세요.`);
    } catch {
      setDelMsg("서버에 연결할 수 없어요 — 잠시 후 다시 시도해 주세요.");
    }
  };

  const submit = async () => {
    setErr("");
    setSent(null);
    if (!message.trim()) {
      setErr("내용을 입력해 주세요");
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`${apiBase()}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ category: cat, name, contact, message }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setSent("접수 완료! 모험자의 목소리는 반드시 확인합니다. ⚔️");
        setMessage("");
      } else {
        setErr(j.error || `접수 실패 (${r.status})`);
      }
    } catch {
      setErr("서버에 연결할 수 없어요 — 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[radial-gradient(1200px_600px_at_50%_-100px,#2a1f4d_0%,#0a0e18_55%)] px-4 pb-16 pt-10 sm:px-6">
      {/* ── 히어로 ── */}
      <header className="text-center">
        <p className="mb-2 text-[11px] font-black tracking-[0.35em] text-fuchsia-300/80">SERTZ SUPPORT CREW</p>
        <h1 className="bg-gradient-to-b from-[#ffe49a] via-[#f0b64a] to-[#c8871f] bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl">
          SERTZ 모험자 지원센터
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-violet-200/80">
          이그드라실의 아홉 왕국 어디에서도, 모험자의 목소리는 사라지지 않는다.<br />
          <span className="text-fuchsia-300">(&gt;^ω^)&lt;</span> 문의·계정·데이터 삭제까지 — 전부 여기서!
        </p>
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href="/" className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-[12px] font-black text-amber-200 hover:bg-amber-400/20">
            ▶ 게임 플레이
          </Link>
          <Link href="/privacy" className="rounded-lg border border-violet-300/40 bg-violet-400/10 px-3 py-1.5 text-[12px] font-black text-violet-200 hover:bg-violet-400/20">
            개인정보처리방침
          </Link>
        </nav>
      </header>

      {/* ── FAQ ── */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-black text-violet-100">📜 자주 묻는 질문</h2>
        <div className="flex flex-col gap-1.5">
          {FAQS.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-violet-300/20 bg-black/40">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
              >
                <span className="text-[13px] font-black text-violet-100">Q. {f.q}</span>
                <span className="shrink-0 text-fuchsia-300">{openFaq === i ? "▲" : "▼"}</span>
              </button>
              {openFaq === i && (
                <p className="border-t border-violet-300/10 bg-violet-500/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-violet-200/90">
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 기기 데이터 삭제 ── */}
      <section className="mt-8 rounded-xl border-2 border-rose-300/30 bg-rose-500/[0.06] p-4">
        <h2 className="text-base font-black text-rose-100">🧹 내 기기 데이터 즉시 삭제</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-rose-200/80">
          이 기기·이 브라우저에 저장된 <b>캐릭터 세이브, 비밀수첩(이스터에그), 방문 기록</b>을 지웁니다.
          계정(회원가입) 데이터는 이 버튼으로 지워지지 않아요 — 아래 계정 삭제를 이용해 주세요.
          서버 연동 없이 <b>즉시</b> 적용됩니다.
        </p>
        <button
          onClick={wipeDeviceData}
          className="mt-3 w-full rounded-lg border-2 border-rose-300/70 bg-gradient-to-b from-rose-400 to-red-500 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_3px_0_#7f1d1d] hover:brightness-110 active:translate-y-[2px] active:shadow-none"
        >
          기기 데이터 전체 삭제 (되돌릴 수 없음)
        </button>
        {wipeMsg && <p className="mt-2 text-[12px] font-bold text-rose-200">{wipeMsg}</p>}
      </section>

      {/* ── 계정 삭제 ── */}
      <section className="mt-6 rounded-xl border-2 border-amber-300/30 bg-amber-500/[0.06] p-4">
        <h2 className="text-base font-black text-amber-100">🗑️ 계정 삭제 (회원가입 유저)</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-amber-200/80">
          게임에서 <b>계정 패널로 로그인한 뒤</b> 이 페이지에서 삭제하면, 계정·클라우드 세이브·랭킹·거래소 등록분이
          서버에서 즉시 삭제됩니다. 앱(로컬 세이브만 사용) 유저는 위 &quot;기기 데이터 삭제&quot;로 충분해요.
        </p>
        <button
          onClick={deleteAccount}
          className="mt-3 w-full rounded-lg border-2 border-amber-300/70 bg-gradient-to-b from-amber-300 to-orange-500 px-4 py-2.5 text-[13px] font-black text-[#3a2508] shadow-[0_3px_0_#92400e] hover:brightness-110 active:translate-y-[2px] active:shadow-none"
        >
          로그인된 계정 삭제 요청 실행
        </button>
        {delMsg && <p className="mt-2 text-[12px] font-bold text-amber-200">{delMsg}</p>}
      </section>

      {/* ── 문의 폼 ── */}
      <section className="mt-8 rounded-xl border-2 border-fuchsia-300/30 bg-fuchsia-500/[0.05] p-4">
        <h2 className="text-base font-black text-fuchsia-100">✉️ 모험자 문의함</h2>
        <p className="mt-1.5 text-[12px] text-fuchsia-200/80">
          계정 복구, 결제, 데이터 삭제 요청 등 모든 문의를 받습니다. 답변은 입력해 주신 연락처로 드려요.
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-black transition-colors ${
                  cat === c
                    ? "border-fuchsia-300/70 bg-fuchsia-500/25 text-fuchsia-100"
                    : "border-white/10 bg-black/40 text-white/55 hover:text-white/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="게임 닉네임 (선택)"
            maxLength={24}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-[13px] font-bold text-white placeholder:text-white/30"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="답변 받을 이메일 (선택)"
            maxLength={80}
            type="email"
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-[13px] font-bold text-white placeholder:text-white/30"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="무슨 일이 있었나요? 최대한 자세히 적어주세요 (필수)"
            rows={5}
            maxLength={2000}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-[13px] font-bold text-white placeholder:text-white/30"
          />
          {err && <p className="text-[12px] font-bold text-rose-300">{err}</p>}
          {sent && <p className="text-[12px] font-bold text-emerald-300">{sent}</p>}
          <button
            onClick={submit}
            disabled={sending}
            className="rounded-lg border-2 border-fuchsia-300/70 bg-gradient-to-b from-fuchsia-400 to-purple-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_3px_0_#701a75] hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {sending ? "전송 중…" : "문의 보내기 ✉️"}
          </button>
        </div>
      </section>

      <footer className="mt-10 text-center text-[10px] leading-relaxed text-white/35">
        SERTZ — 이그드라실: 아홉 왕국 · v1.4.5<br />
        이 페이지는 게임과 같은 서버에서 동작합니다. 문의 데이터는 서버에만 저장되며 전송은 HTTPS로 암호화됩니다.
      </footer>
    </main>
  );
}
