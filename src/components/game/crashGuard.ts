/**
 * v1.0.20 — 크래시 가드 (유저 지시: "검은화면 뜨는 버그 없애")
 *
 *  렌더 루프 프리즈·WebGL 컨텍스트 유실은 이미 자가치유(안전 새로고침)가 있지만,
 *  "React 트리/게임 부팅 중 미처리 예외"는 화면에 아무것도 못 그린 채
 *  게임 루트 배경색(#05070d — 사실상 검은 화면)만 남긴다. 유저에게는 검은 화면 버그.
 *
 *  → 전역 error/unhandledrejection 훅으로 치명 오류를 포착해
 *    "게임형 복구 오버레이(오류 안내 + 다시 시작 버튼)"를 DOM 직접 주입한다.
 *    React가 죽어도 동작하도록 의도적으로 React 밖 순수 DOM으로 구현.
 */

let installed = false;
let overlayEl: HTMLDivElement | null = null;
let errorCount = 0;
let firstErrorAt = 0;

/** v1.4.3 (#무한재부팅) — 치명 상태 공용 복구 오버레이 (크래시 가드·재부팅 루프 차단 공용).
 *  React 밖 순수 DOM — 게임/React가 죽어도 동작한다. */
export function showRecoveryOverlay(title: string, detail: string, sub = "세이브는 주기적으로 저장되어 대부분 보존된다") {
  if (overlayEl) return; // 이미 표시 중
  const el = document.createElement("div");
  el.setAttribute("data-sertz-crash", "1");
  el.style.cssText =
    "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
    "background:linear-gradient(180deg,#1c2643 0%,#151e36 48%,#0e1526 100%);" +
    "font-family:Galmuri11,'Noto Sans KR',sans-serif;user-select:none;";
  el.innerHTML = `
    <div style="width:min(92vw,420px);background:linear-gradient(180deg,#1c2643,#101827);border:2px solid #7a5a2e;border-radius:8px;box-shadow:inset 0 0 0 1px #e8c06466,0 10px 0 rgba(0,0,0,.35),0 22px 44px rgba(0,0,0,.55);padding:22px 20px;text-align:center;">
      <p style="color:#ffd98a;font-weight:900;font-size:16px;margin:0 0 4px;text-shadow:0 2px 0 rgba(0,0,0,.65);">⚠ 모험에 잠시 문제가 생겼다</p>
      <p style="color:#cbb88a;font-size:11px;margin:0 0 14px;">${title}</p>
      <p style="color:#6f7d9c;font-size:9px;margin:0 0 16px;word-break:break-all;max-height:52px;overflow:hidden;">${detail}</p>
      <button id="sertz-crash-reload" style="display:block;width:100%;padding:12px 0;font-family:inherit;font-weight:900;font-size:14px;color:#3a2508;cursor:pointer;border-radius:7px;border:2px solid #6b4a1c;background:linear-gradient(180deg,#ffe49a 0%,#f0b64a 45%,#c8871f 100%);box-shadow:inset 0 1px 0 #fff3c9,0 3px 0 #4a3210;">다시 시작</button>
      <p style="color:#8a97b8;font-size:9px;margin:10px 0 0;">${sub}</p>
    </div>`;
  document.body.appendChild(el);
  overlayEl = el;
  el.querySelector("#sertz-crash-reload")?.addEventListener("click", () => {
    /* v1.4.3 (#무한재부팅) — 수동 재시작은 재부팅 예산을 리셋해 다음 자가치유를 허용한다 */
    try { sessionStorage.removeItem("sertz.reboots"); } catch { /* 무시 */ }
    window.location.reload();
  });
}

/** 치명 오류 판정: 콘솔 스팸 방지를 위해 "짧은 창(10초)에 3회 이상"이면 크래시로 본다.
 *  단, pageerror(미처리 예외)는 1회라도 즉시 표시 — 게임 루프가 이미 깨졌을 가능성. */
export function installCrashGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    // 리소스 로드 실패(img/audio 404 등)는 크래시가 아님 — 무시
    if (e.message) {
      errorCount++;
      const now = Date.now();
      if (now - firstErrorAt > 10000) {
        firstErrorAt = now;
        errorCount = 1;
      }
      if (errorCount >= 3) showRecoveryOverlay("반복되는 오류로 게임이 불안정하다", String(e.message).slice(0, 160));
    }
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason instanceof Error ? e.reason.message : String(e?.reason ?? "");
    // 세이브 업로드/네트워크 실패 등은 조용히 스킵 (게임은 계속 동작)
    if (/network|fetch|timeout|aborted|auth|cloud/i.test(msg)) return;
    showRecoveryOverlay("예상치 못한 오류가 발생했다", msg.slice(0, 160));
  });
}
