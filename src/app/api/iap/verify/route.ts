/**
 * vc205 (감사 #2) — POST /api/iap/verify
 *
 * 문제: 종전엔 `purchaseProduct` 가 돌려준 purchaseToken 을 **클라이언트가 받아 그 자리에서
 *  에메랄드를 지급**했다(WorldScene 의 `this.player.emerald += sku.gems`). 서버 검증이
 *  아예 없어서, 결제 우회 도구나 조작된 클라로 토큰을 위조하면 에메랄드가 무한 지급됐다.
 *
 * 해법: 지급을 서버로 옮긴다.
 *   ① 클라는 결제 후 `purchaseToken` 만 서버에 보낸다 (에메랄드는 보내지 않는다).
 *   ② 서버가 Google Play Developer API 로 토큰을 검증한다.
 *   ③ 검증 통과 시 서버가 SKU 표에서 에메랄드 수량을 결정해 세이브에 더한다.
 *   ④ 같은 토큰은 1회만 인정한다(db.iapUsed). 재전송은 이미 지급된 것으로 응답한다.
 *
 * Google API 자격증명이 없으면 **fail-closed**(503)한다. 클라 자체 지급으로 되돌아가면
 * 이 수정의 의미가 없기 때문이다. 필요 env 3종:
 *   GOOGLE_PLAY_SA_JSON      : 서비스 계정 JSON (문자열)
 *   GOOGLE_PLAY_PACKAGE_NAME : com.sertz.myapp (기본값)
 *   SERTZ_IAP_ENFORCE        : "0" 이면 검증 생략(개발용). 기본은 강제.
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, options, rateLimit, audit } from "@/lib/sapi";
import { GEM_SKUS } from "@/game/ads";

export function OPTIONS(req: NextRequest) { return options(req); }

const PKG = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.sertz.myapp";
const ENFORCE = (process.env.SERTZ_IAP_ENFORCE ?? "1") !== "0";

/** SKU → 에메랄드 수량 (클라 표를 단일 진실로 쓰되, 서버가 결정한다) */
function gemsFor(sku: string): number | null {
  const g = GEM_SKUS.find((s) => s.id === sku);
  return g ? g.gems : null;
}

type GoogleVerifyResult = { ok: true; purchaseState: number; orderId?: string } | { ok: false; reason: string; status: number };

/** Google Play Developer API — purchases.products.get */
async function verifyWithGoogle(sku: string, token: string): Promise<GoogleVerifyResult> {
  const sa = process.env.GOOGLE_PLAY_SA_JSON;
  if (!sa) return { ok: false, reason: "iap_not_configured", status: 503 };
  let jwt: string;
  try {
    const { createSign } = await import("node:crypto");
    const cred = JSON.parse(sa) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: cred.client_email,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url");
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    const sig = signer.sign(cred.private_key).toString("base64url");
    jwt = `${header}.${claim}.${sig}`;
  } catch (e) {
    console.error("[SERTZ-api] iap JWT 생성 실패", e);
    return { ok: false, reason: "iap_bad_credentials", status: 503 };
  }

  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tr.ok) return { ok: false, reason: "iap_token_failed", status: 502 };
    const { access_token } = (await tr.json()) as { access_token?: string };
    if (!access_token) return { ok: false, reason: "iap_no_token", status: 502 };

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PKG)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
    const vr = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!vr.ok) {
      const body = await vr.text().catch(() => "");
      console.warn("[SERTZ-api] iap verify 실패", vr.status, body.slice(0, 200));
      return { ok: false, reason: "iap_invalid", status: 402 };
    }
    const v = (await vr.json()) as { purchaseState?: number; orderId?: string };
    /* purchaseState: 0=구매됨, 1=취소, 2=대기 */
    if (v.purchaseState !== 0) return { ok: false, reason: "iap_not_purchased", status: 402 };
    return { ok: true, purchaseState: v.purchaseState, orderId: v.orderId };
  } catch (e) {
    console.error("[SERTZ-api] iap verify 오류", e);
    return { ok: false, reason: "iap_network", status: 502 };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "로그인이 필요해요" });
    if (!rateLimit(req, `iap:${user.id}`, 10, 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as { sku?: unknown; token?: unknown };
    const sku = String(b.sku || "").slice(0, 64);
    const token = String(b.token || "").slice(0, 512);
    if (!sku || !token) return json(req, 400, { error: "상품 정보가 올바르지 않아요" });

    const gems = gemsFor(sku);
    if (gems === null) return json(req, 400, { error: "알 수 없는 상품이에요" });

    /* 이미 지급된 토큰인지 먼저 확인 (재전송 멱등) */
    if (db.iapUsed?.[token]) {
      return json(req, 200, { ok: true, already: true, gems: 0, emerald: db.saves[user.id]?.data?.emerald ?? null });
    }

    let orderId: string | undefined;
    if (ENFORCE) {
      const v = await verifyWithGoogle(sku, token);
      if (!v.ok) {
        audit("iap_verify_fail", { ip: "serverless", uid: user.id, sku, reason: v.reason });
        return json(req, v.status, { error: "결제를 확인할 수 없어요", reason: v.reason });
      }
      orderId = v.orderId;
    }

    /* 지급도 DB 트랜잭션 안에서 — 토큰 1회성 표시와 에메랄드 증가를 원자적으로 */
    const r = await mutateDb((fdb) => {
      if (!fdb.users[user.id]) return { status: 401, body: { error: "로그인이 필요해요" } };
      fdb.iapUsed ||= {};
      if (fdb.iapUsed[token]) {
        return { resp: { status: 200, body: { ok: true, already: true, gems: 0 } } };
      }
      const rec = fdb.saves[user.id];
      if (!rec?.data) return { status: 409, body: { error: "클라우드 세이브를 먼저 동기화해 주세요" } };
      const cur = typeof rec.data.emerald === "number" && Number.isFinite(rec.data.emerald) ? rec.data.emerald : 0;
      rec.data.emerald = cur + gems;
      rec.updatedAt = Date.now();
      fdb.iapUsed[token] = { uid: user.id, sku, gems, at: Date.now(), orderId: orderId ?? "" };
      audit("iap_grant", { ip: "serverless", uid: user.id, sku, gems, orderId: orderId ?? "" });
      return { resp: { status: 200, body: { ok: true, gems, emerald: cur + gems } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] iap/verify 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
