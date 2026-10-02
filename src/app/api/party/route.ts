/**
 * v1.4.26 — GET/POST /api/party (serverless 릴레이 파티 — ②안 소켓 대체)
 *
 *  GET ?code= : 파티 스냅샷 (온라인 판정 = seenAt 5분 내). 엣지 캐시 4초.
 *  POST { action: create|join|leave|beat, cid, name?, lv?, cls?, code? }
 *   - create: 코드 4자리 발급 (혼동 문자 제외) · 파티당 최대 4인 · 1인 1파티 강제
 *   - join:   코드로 참여 (인원 여유 시)
 *   - leave:  탈퇴 — 빈 파티 삭제, 리더 탈퇴 시 최장 입장자 승계
 *   - beat:   90초 하트비트 (seenAt 갱신 — 온라인 표시용)
 *  파일: relay-parties.json (relaydb 참조 — 계정 DB와 잠금 분리)
 */
import { NextRequest } from "next/server";
import {
  mutateRelay, loadRelay, emptyParties, audit, json, options, rateLimit,
  PARTY_PATH, PARTY_STALE_MS, PARTY_ONLINE_MS, PARTY_MAX,
  type RelayPartyFile, type RelayParty, type RelayPartyMember,
} from "@/lib/relaydb";

export function OPTIONS(req: NextRequest) { return options(req); }

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 문자(I,O,0,1) 제외

function clean(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "")
    .trim()
    .slice(0, max);
}

function snapshot(p: RelayParty, now: number) {
  const members = Object.entries(p.members)
    .filter(([, m]) => now - m.seenAt < PARTY_ONLINE_MS * 3) // 15분 초과 무활동 명단 비표시
    .map(([cid, m]) => ({ id: cid, name: m.name, lv: m.lv, cls: m.cls, online: now - m.seenAt < PARTY_ONLINE_MS, joinedAt: m.joinedAt }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  return { id: p.code, leader: p.leader, max: PARTY_MAX, members };
}

/** 파티 청소 — 전 멤버 24시간 무활동 파티 제거 */
function prune(db: RelayPartyFile, now: number) {
  for (const code of Object.keys(db.parties)) {
    const p = db.parties[code];
    const members = Object.values(p.members);
    const stale = members.length === 0 || members.every((m) => now - m.seenAt > PARTY_STALE_MS);
    if (stale) delete db.parties[code];
  }
  /* 파티 상한 200 — 초과 시 최오래된 것부터 제거 */
  const keys = Object.keys(db.parties);
  if (keys.length > 200) {
    keys.sort((a, b) => (db.parties[a]?.createdAt || 0) - (db.parties[b]?.createdAt || 0));
    for (const k of keys.slice(0, keys.length - 200)) delete db.parties[k];
  }
}

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase().slice(0, 8);
    if (!code) return json(req, 200, { party: null });
    const { data } = await loadRelay<RelayPartyFile>(PARTY_PATH);
    const db = data || emptyParties();
    const p = db.parties?.[code];
    return json(req, 200, { party: p ? snapshot(p, Date.now()) : null },
      { "Cache-Control": "public, s-maxage=4, stale-while-revalidate=15" });
  } catch (e) {
    console.error("[SERTZ-api] party GET 실패", e);
    return json(req, 200, { party: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = clean(b.action, 10);
    const cid = clean(b.cid, 64);
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(cid)) return json(req, 400, { error: "잘못된 요청이에요" });
    const name = clean(b.name, 8) || "이름없음";
    const lv = Math.max(1, Math.min(9999, Number(b.lv) || 1));
    const cls = clean(b.cls, 16);
    const code = clean(b.code, 8).toUpperCase();
    const now = Date.now();

    if (action === "beat") {
      if (!rateLimit(req, "party-beat", 3, 60 * 1000)) return json(req, 429, { error: "busy" });
      const r = await mutateRelay<RelayPartyFile>(PARTY_PATH, (db) => {
        if (!db?.parties) return null;
        prune(db, now);
        if (!code) return { status: 400, body: { error: "코드 없음" } };
        const p = db.parties[code];
        const m = p?.members[cid];
        if (!p || !m) return { status: 404, body: { error: "파티가 없어요" } };
        m.seenAt = now;
        m.name = name || m.name;
        m.lv = lv || m.lv;
        return null;
      });
      return json(req, r.status, r.status === 200 ? { ok: true } : r.body);
    }

    if (action === "create") {
      if (!rateLimit(req, "party-create", 3, 60 * 1000)) return json(req, 429, { error: "요청이 너무 많아요" });
      let newCode = "";
      const r = await mutateRelay<RelayPartyFile>(PARTY_PATH, (db) => {
        const d = db?.parties ? db : emptyParties();
        d.parties ||= {};
        prune(d, now);
        /* 1인 1파티 — 기존 파티에서 탈퇴 */
        for (const [c, p] of Object.entries(d.parties)) {
          if (p.members[cid]) { delete p.members[cid]; if (Object.keys(p.members).length === 0) delete d.parties[c]; }
        }
        const member: RelayPartyMember = { name, lv, cls, seenAt: now, joinedAt: now };
        for (let i = 0; i < 8; i++) {
          let c = "";
          for (let j = 0; j < 4; j++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
          if (!d.parties[c]) { newCode = c; break; }
        }
        if (!newCode) return { status: 503, body: { error: "파티 코드 발급 실패 — 다시 시도" } };
        d.parties[newCode] = { code: newCode, leader: cid, members: { [cid]: member }, createdAt: now };
        return null;
      });
      if (r.status === 200) audit("party:create", { uid: cid.slice(0, 8), code: newCode });
      return json(req, r.status, r.status === 200 ? { ok: true, code: newCode } : r.body);
    }

    if (action === "join") {
      if (!rateLimit(req, "party-join", 6, 60 * 1000)) return json(req, 429, { error: "요청이 너무 많아요" });
      if (!/^[A-Z0-9]{4,8}$/.test(code)) return json(req, 400, { error: "코드 형식이 틀렸어요" });
      const r = await mutateRelay<RelayPartyFile>(PARTY_PATH, (db) => {
        const d = db?.parties ? db : emptyParties();
        d.parties ||= {};
        prune(d, now);
        const p = d.parties[code];
        if (!p) return { status: 404, body: { error: "없는 파티 코드예요" } };
        if (!p.members[cid] && Object.keys(p.members).length >= PARTY_MAX) {
          return { status: 409, body: { error: "파티가 가득 찼어요 (최대 4인)" } };
        }
        /* 1인 1파티 — 기존 파티에서 탈퇴 */
        for (const [c, op] of Object.entries(d.parties)) {
          if (c !== code && op.members[cid]) {
            delete op.members[cid];
            if (Object.keys(op.members).length === 0) delete d.parties[c];
          }
        }
        p.members[cid] = { name, lv, cls, seenAt: now, joinedAt: p.members[cid]?.joinedAt || now };
        return null;
      });
      if (r.status === 200) audit("party:join", { uid: cid.slice(0, 8), code });
      return json(req, r.status, r.status === 200 ? { ok: true, code } : r.body);
    }

    if (action === "leave") {
      const r = await mutateRelay<RelayPartyFile>(PARTY_PATH, (db) => {
        if (!db?.parties) return { status: 404, body: { error: "파티가 없어요" } };
        for (const [c, p] of Object.entries(db.parties)) {
          if (!p.members[cid]) continue;
          delete p.members[cid];
          if (Object.keys(p.members).length === 0) { delete db.parties[c]; break; }
          if (p.leader === cid) {
            /* 최장 입장자 승계 */
            const next = Object.entries(p.members).sort((a, z) => a[1].joinedAt - z[1].joinedAt)[0];
            if (next) p.leader = next[0];
          }
          break;
        }
        return null;
      });
      return json(req, r.status, r.status === 200 ? { ok: true } : r.body);
    }

    return json(req, 400, { error: "알 수 없는 요청이에요" });
  } catch (e) {
    console.error("[SERTZ-api] party POST 실패", e);
    return json(req, 500, { error: "서버 오류 — 잠시 후 다시 시도해 주세요" });
  }
}
