const PKG = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.sertz.myapp";

type GoogleVerifyResult =
  | { ok: true; purchaseState: number; orderId?: string; accountId?: string }
  | { ok: false; reason: string; status: number };

/** Google Play Developer API — purchases.products.get */
export async function verifyWithGoogle(
  sku: string,
  token: string,
): Promise<GoogleVerifyResult> {
  const sa = process.env.GOOGLE_PLAY_SA_JSON;
  if (!sa) return { ok: false, reason: "iap_not_configured", status: 503 };
  let jwt: string;
  try {
    const { createSign } = await import("node:crypto");
    const cred = JSON.parse(sa) as {
      client_email: string;
      private_key: string;
    };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
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
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tr.ok) return { ok: false, reason: "iap_token_failed", status: 502 };
    const { access_token } = (await tr.json()) as { access_token?: string };
    if (!access_token)
      return { ok: false, reason: "iap_no_token", status: 502 };

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PKG)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
    const vr = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!vr.ok) {
      const body = await vr.text().catch(() => "");
      console.warn(
        "[SERTZ-api] iap verify 실패",
        vr.status,
        body.slice(0, 200),
      );
      return { ok: false, reason: "iap_invalid", status: 402 };
    }
    const v = (await vr.json()) as {
      purchaseState?: number;
      orderId?: string;
      obfuscatedExternalAccountId?: string;
    };
    /* purchaseState: 0=구매됨, 1=취소, 2=대기 */
    if (v.purchaseState !== 0)
      return { ok: false, reason: "iap_not_purchased", status: 402 };
    return {
      ok: true,
      purchaseState: v.purchaseState,
      orderId: v.orderId,
      accountId: v.obfuscatedExternalAccountId,
    };
  } catch (e) {
    console.error("[SERTZ-api] iap verify 오류", e);
    return { ok: false, reason: "iap_network", status: 502 };
  }
}
