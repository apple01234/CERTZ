#!/usr/bin/env node
/* 커밋의 GitHub status로 Vercel 배포 성공 여부 확인 (토큰: git remote URL 폴백) */
const { execSync } = require("child_process");
const SHA = process.argv[2] || "HEAD";
const url = execSync("git remote get-url origin", { cwd: "/home/z/my-project" }).toString().trim();
const T = url.replace(/^https?:\/\//, "").replace(/@github\.com[\s\S]*$/, "").replace(/^[^:]+:/, "").trim();
fetch(`https://api.github.com/repos/apple01234/CERTZ/commits/${SHA}/status`, {
  headers: { Authorization: `Bearer ${T}`, Accept: "application/vnd.github+json", "User-Agent": "certz" },
})
  .then(r => r.json())
  .then(s => {
    console.log("commit:", SHA, "state:", s.state);
    for (const x of s.statuses || []) {
      console.log("-", x.context, "|", x.state, "|", x.description || "");
    }
  })
  .catch(e => { console.error("ERR", e.message); process.exit(1); });
