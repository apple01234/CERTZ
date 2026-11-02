import { createHmac, timingSafeEqual } from "node:crypto";
export type OnlineIdentity = {
  uid: string;
  characterId: string;
  name: string;
  family: string;
  bosses: string[];
  exp: number;
};
export function signProof(value: object, secret: string) {
  if (secret.length < 32)
    throw new Error(
      "CAMPAIGN_SERVER_SECRET must contain at least 32 characters",
    );
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyProof<T extends { exp: number }>(
  raw: unknown,
  secret: string,
  now = Date.now(),
): T | null {
  if (secret.length < 32 || typeof raw !== "string" || raw.length > 16000)
    return null;
  const [payload, sig, ...rest] = raw.split(".");
  if (!payload || !sig || rest.length) return null;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(data.exp) && data.exp > now ? (data as T) : null;
  } catch {
    return null;
  }
}
