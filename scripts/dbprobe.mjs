const gh = await import("../src/lib/ghdb.ts");
try {
  const r = await gh.loadDb(true);
  console.log("loadDb OK, users:", Object.keys(r.db.users || {}).length);
} catch (e) {
  console.log("loadDb FAIL:", e.message);
}
