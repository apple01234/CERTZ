"use client";

/**
 * v4.9.0 — 계정 클라이언트 (유저 지시 #4: 자체 회원가입/로그인 + SNS 연동 + 클라우드 세이브)
 *  서버: accounts/index.js (같은 오리진 /api/auth/*) — 쿠키 세션이라 credentials 필수는 아님
 *  (same-origin fetch는 기본으로 쿠키 전송) — APK 웹뷰/웹 공통.
 */

export type AuthUser = { id: string; name: string; provider: string; createdAt?: number };
export type SnsProviders = Record<string, { name: string; configured: boolean }>;

async function post(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "서버에 연결할 수 없어요" } };
  }
}

async function get(path: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { cache: "no-store" });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "서버에 연결할 수 없어요" } };
  }
}

export async function authMe(): Promise<AuthUser | null> {
  const r = await get("/api/auth/me");
  return (r.data.user as AuthUser) ?? null;
}

export async function authRegister(id: string, pw: string, name: string) {
  return post("/api/auth/register", { id, pw, name });
}

export async function authLogin(id: string, pw: string) {
  return post("/api/auth/login", { id, pw });
}

export async function authLogout() {
  return post("/api/auth/logout");
}

export async function fetchSnsProviders(): Promise<SnsProviders> {
  const r = await get("/api/auth/sns");
  return (r.data.providers as SnsProviders) ?? {};
}

/** 클라우드 세이브 백업 — 게임 세이브 객체를 그대로 저장 */
export async function cloudSaveUpload(data: unknown): Promise<{ ok: boolean; error?: string; updatedAt?: number }> {
  const r = await post("/api/auth/cloud-save", { data });
  if (!r.ok) return { ok: false, error: String(r.data.error ?? "백업 실패") };
  return { ok: true, updatedAt: r.data.updatedAt as number };
}

/** 클라우드 세이브 복원 — 저장된 세이브 객체 반환 (없으면 null) */
export async function cloudSaveDownload(): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const r = await get("/api/auth/cloud-save");
  if (!r.ok) return { ok: false, data: null, error: String(r.data.error ?? "복원 실패") };
  return { ok: true, data: r.data.data ?? null };
}
