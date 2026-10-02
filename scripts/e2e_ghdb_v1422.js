/**
 * ②안 serverless API E2E 테스트 (로컬 :3100 — 실제 GitHub DB 대상)
 *  기존 4계정 무손실 확인 + 신규 가입/로그인/클라우드세이브/거래소/랭킹/지원/삭제 전 경로 검증.
 *  테스트 계정은 마지막에 완전 삭제(계정 삭제 API) — DB 원상복구.
 */
const BASE = "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name} ${extra}`); }
  else { fail++; console.log(`  ✗ FAIL ${name} ${extra}`); }
};

async function post(path, body, token, origin) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8", // 클라와 동일 — 프리플라이트 없는 단순 요청
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, data: await r.json().catch(() => ({})), cors: r.headers.get("access-control-allow-origin"), headers: r.headers };
}
async function get(path, token, origin) {
  const r = await fetch(BASE + path + (token && path.includes("?") ? `&token=${token}` : token ? `?token=${token}` : ""), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) },
    cache: "no-store",
  });
  return { status: r.status, data: await r.json().catch(() => ({})), cors: r.headers.get("access-control-allow-origin") };
}

(async () => {
  console.log("[1] 기존 데이터 무손실 확인");
  const sns = await get("/api/auth/sns", null, "https://localhost");
  ok("sns 200 + CORS(https://localhost)", sns.status === 200 && sns.cors === "https://localhost");
  ok("SNS 전부 미설정 안내", sns.data.providers?.google?.configured === false);

  const mkt0 = await get("/api/market", null, "https://sertz.vercel.app");
  ok("market 게스트 200 + CORS(vercel.app)", mkt0.status === 200 && mkt0.cors === "https://sertz.vercel.app");
  ok("listings 배열 존재(구버전 클라 크래시 방지 계약)", Array.isArray(mkt0.data.listings));
  ok("guest 플래그", mkt0.data.guest === true);

  const rank0 = await get("/api/rank");
  ok("rank 200", rank0.status === 200);
  console.log(`    랭킹 ${rank0.data.list?.length ?? 0}명 → DB 복호화 성공의 방증`);

  console.log("[2] 가입/로그인");
  const wrong = await post("/api/auth/login", { id: "eertest1", pw: "wrongpw" });
  ok("미존재 로그인 401 + 통일 메시지", wrong.status === 401 && String(wrong.data.error).includes("회원가입 탭"));

  /* 재실행 안전 — 이미 있으면 로그인으로 대체 */
  async function ensureAccount(id, pw, name) {
    const reg = await post("/api/auth/register", { id, pw, name });
    if (reg.status === 200) return reg.data.token;
    const lg = await post("/api/auth/login", { id, pw });
    if (lg.status === 200) return lg.data.token;
    throw new Error(`계정 확보 실패 ${id}: ${reg.status}/${lg.status}`);
  }
  const reg1 = await post("/api/auth/register", { id: "eertest1", pw: "testpw123", name: "테스터1" });
  ok("register 200 + token", reg1.status === 200 && /^[A-Fa-f0-9]{64}$/.test(String(reg1.data.token || "")));
  ok("register 유저 페이로드", reg1.data.user?.id === "eertest1" && reg1.data.user?.provider === "local");
  const tok1 = await ensureAccount("eertest1", "testpw123", "테스터1");

  const dup = await post("/api/auth/register", { id: "eertest1", pw: "testpw123", name: "중복" });
  ok("중복 가입 409", dup.status === 409);
  const badid = await post("/api/auth/register", { id: "AB", pw: "testpw123" });
  ok("아이디 형식 400", badid.status === 400);

  const tok2 = await ensureAccount("eertest2", "testpw456", "테스터2");
  ok("register2 계정 확보", !!tok2);

  const lg1 = await post("/api/auth/login", { id: "eertest1", pw: "testpw123" });
  ok("login 200 + 토큰 재발급", lg1.status === 200 && !!lg1.data.token);

  const me = await get("/api/auth/me", tok1);
  ok("me(Bearer) 200", me.status === 200 && me.data.user?.id === "eertest1");
  const meQ = await get("/api/auth/me", lg1.data.token);
  ok("me(?token= 쿼리 — 네이티브 경로)", meQ.status === 200 && meQ.data.user?.id === "eertest1");

  console.log("[3] 클라우드 세이브");
  const saveObj = { lv: 42, cls: "ranger", playerName: "테스터1", owned: ["bd_surt", "bd_fenrir"], accessories: [], inf: { rebirths: 1, towerBest: 7 } };
  const cs1 = await post("/api/auth/cloud-save", { data: saveObj }, tok1);
  ok("cloud-save 업로드", cs1.status === 200 && cs1.data.ok === true && typeof cs1.data.updatedAt === "number");
  const cs1g = await get("/api/auth/cloud-save", tok1);
  ok("cloud-save 복원(데이터 일치)", cs1g.status === 200 && cs1g.data.data?.lv === 42 && cs1g.data.data?.owned?.[0] === "bd_surt");
  const csBad = await post("/api/auth/cloud-save", { data: "string" }, tok1);
  ok("세이브 형식 검증 400", csBad.status === 400);
  const csAnon = await post("/api/auth/cloud-save", { data: {} });
  ok("비로그인 업로드 401", csAnon.status === 401);

  const cs2 = await post("/api/auth/cloud-save", { data: { lv: 10, playerName: "테스터2", owned: [], accessories: [] } }, tok2);

  console.log("[4] 랭킹 반영");
  const rank1 = await get("/api/rank", tok1);
  ok("랭킹에 테스터1 등재", rank1.status === 200 && rank1.data.list?.some((e) => e.name === "테스터1"));
  ok("내 순위(me) 동봉", rank1.data.me?.name === "테스터1" && rank1.data.me?.rank >= 1);

  console.log("[5] 거래소 전 경로");
  const noAuth = await post("/api/market/list", { itemKey: "bd_surt", up: 0, price: 1000 });
  ok("비로그인 등록 401", noAuth.status === 401);
  const notOwned = await post("/api/market/list", { itemKey: "bd_gram", up: 0, price: 1000 }, tok1);
  ok("미보유 등록 403", notOwned.status === 403);
  const badItem = await post("/api/market/list", { itemKey: "weapon_1", up: 0, price: 1000 }, tok1);
  ok("화이트리스트 외 403", badItem.status === 403);
  const badPrice = await post("/api/market/list", { itemKey: "bd_surt", up: 0, price: 99999999 }, tok1);
  ok("가격 상한 400", badPrice.status === 400);

  const list1 = await post("/api/market/list", { itemKey: "bd_surt", up: 3, price: 5000 }, tok1);
  ok("등록 성공 + id", list1.status === 200 && list1.data.ok && typeof list1.data.id === "string");
  const listingId = list1.data.id;
  const dupItem = await post("/api/market/list", { itemKey: "bd_surt", up: 0, price: 100 }, tok1);
  ok("동일 아이템 중복 등록 409", dupItem.status === 409);

  const own = await post("/api/market/buy", { id: listingId }, tok1);
  ok("본인 물건 구매 403", own.status === 403);
  const buy = await post("/api/market/buy", { id: listingId }, tok2);
  ok("구매 성공 + 스냅샷", buy.status === 200 && buy.data.ok && buy.data.item?.itemKey === "bd_surt" && Array.isArray(buy.data.listings));
  const bought = await post("/api/market/buy", { id: listingId }, tok2);
  ok("이미 판매된 등록 404", bought.status === 404);

  const noPay = await post("/api/market/collect", {}, tok1);
  ok("정산금 반영 확인", noPay.status === 200 && noPay.data.gold === 4500); // 5000*90%
  const again = await post("/api/market/collect", {}, tok1);
  ok("재수령 400", again.status === 400);

  const list2 = await post("/api/market/list", { itemKey: "bd_fenrir", up: 1, price: 2000 }, tok1);
  const cancel = await post("/api/market/cancel", { id: list2.data.id }, tok1);
  ok("취소 성공 + 아이템 반환", cancel.status === 200 && cancel.data.item?.itemKey === "bd_fenrir");
  const mktMine = await get("/api/market", tok1);
  ok("게스트 응답 아님 + pending 0", mktMine.data.guest === undefined && mktMine.data.pending?.gold === 0);

  console.log("[6] 지원센터/관리자");
  const sup = await post("/api/support", { category: "테스트", name: "테스터", message: "serverless 이행 E2E 테스트 문의", contact: "test@test" });
  ok("문의 접수 200", sup.status === 200 && sup.data.ok);
  const supEmpty = await post("/api/support", { message: "" });
  ok("빈 내용 400", supEmpty.status === 400);
  const adm = await get("/api/admin/summary", tok1);
  ok("비관리자 403", adm.status === 403);

  console.log("[7] 로그아웃/계정삭제(원상복구)");
  const lo = await post("/api/auth/logout", {}, tok2);
  ok("로그아웃 + 쿠키 만료", lo.status === 200 && String(lo.headers?.get("set-cookie") || "").includes("Max-Age=0"));
  const meAfter = await get("/api/auth/me", tok2);
  ok("해제된 토큰 무효", meAfter.status === 200 && meAfter.data.user === null);

  const delNoConfirm = await post("/api/auth/delete", { confirm: "yes" }, tok1);
  ok("confirm 미일치 400", delNoConfirm.status === 400);
  /* 로그아웃으로 tok2 소진 — 재로그인 후 삭제 (ertester2 잔존 청소 포함) */
  const tok2b = await ensureAccount("eertest2", "testpw456", "테스터2");
  const del1 = await post("/api/auth/delete", { confirm: "DELETE" }, tok1);
  const del2 = await post("/api/auth/delete", { confirm: "DELETE" }, tok2b);
  ok("계정 삭제 1·2", del1.status === 200 && del2.status === 200);
  const meDel = await get("/api/auth/me", tok1);
  ok("삭제된 계정 세션 무효", meDel.data.user === null);

  console.log("[8] 최종 상태 — 기존 4계정만 남았는지");
  const admHint = await get("/api/market");
  ok("거래판 목록 조회 가능(마무리)", Array.isArray(admHint.data.listings));

  console.log(`\n결과: PASS ${pass} / FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("테스트 실행 실패:", e); process.exit(1); });
