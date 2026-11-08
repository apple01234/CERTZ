/**
 * v1.0.13 피드백#8 — POST /api/auth/claimname (serverless 이행 — accounts/index.js 응답 형태 그대로)
 *  캐릭터 이름 등록(claim): 로그인 유저만, 전역 레지스트리(db.charNames)에 소유 기록.
 *  · 이미 다른 uid가 claim한 이름 → 409 (내 것이면 200 멱등 — node와 동일)
 *  · 내 계정 이름과 동일한 이름 → 409 (node와 동일)
 *  · 이름 정규화: 제어문자/제로폭 제거 → trim → 8자 절단 → 소문자 키 (+2자 하한 가드)
 *  · mutateDb 낙관 잠금 원자적 쓰기 — node persistDb와 동일한 파일을 두 서버가 공유한다.
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";
/* vc272 — 클라이언트와 **같은** 검증 모듈을 쓴다. 종전엔 이 파일이 규칙을 따로 들고 있어
 *  (제어문자 제거 · trim · 8자 절단 · 2자 하한) 클라 규칙과 갈라질 수 있었다.
 *  이제 한 곳(playerName.ts)만 고치면 양쪽이 함께 바뀐다. */
import { validateName } from "@/game/playerName";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "claimname", 30, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    if (!me) return json(req, 401, { error: "로그인이 필요해요 (미로그인은 기기 내 중복만 검사됩니다)" });
    const b = (await req.json().catch(() => ({}))) as { name?: unknown; kind?: unknown };
    /* vc272 — 공용 검증(정화 + 길이 + 공백-only). 클라가 이미 같은 함수로 걸러내므로
     *  여기 도달하는 요청은 정상이지만, 서버는 신뢰 경계이므로 반드시 다시 검사한다. */
    const check = validateName(b.name);
    if (!check.ok) return json(req, 400, { error: check.message });
    const name = check.name;
    const key = name.toLowerCase();
    const kind = String(b.kind || "char").slice(0, 16);
    const r = await mutateDb((fdb) => {
      if (!fdb.users[me.id]) return { status: 401, body: { error: "로그인이 필요해요" } };
      fdb.charNames ||= {};
      const reg = fdb.charNames[key];
      if (reg && reg.by !== me.id) return { status: 409, body: { error: "이미 다른 모험가가 사용 중인 이름이에요" } };
      /* 내 계정 이름과도 중복 금지 (캐릭터≠계정 이름 구분 유지 — node와 동일) */
      if (String(me.name || "").trim().toLowerCase() === key) {
        return { status: 409, body: { error: "계정 이름과 같은 이름은 쓸 수 없어요" } };
      }
      fdb.charNames[key] = { by: me.id, at: Date.now(), kind };
      return { resp: { status: 200, body: { ok: true, name } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] claimname 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
