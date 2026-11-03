# Project skills

Ponytail skills were restored from DietrichGebert/ponytail, commit
`96608e078b2d5ea607c5c3b8b5a54d1c1fba6846` (MIT, see LICENSE.ponytail).
The repository's AGENTS.md references `ponytail/SKILL.md`; the review, audit,
debt, gain, and help skills are also available here.

The pixel VFX skill and runtime are already vendored under
`vendor/pixelfx/skills/pixelfx/SKILL.md` (MIT).

Browser MCP configuration is `.mcp.json`; it launches pinned Playwright MCP
0.0.84 through the project's installed browser. Run
`npx playwright install chromium` after installing dependencies.

REA 6.8.0 (morluto/rea, MIT) and its bundled `reverse-engineer-anything`
workflow are installed for this task. The exact installed skill and references
are copied to `reverse-engineer-anything/`; retain `LICENSE.rea`.
The project MCP launcher is `scripts/rea-mcp.mjs`, pinned to REA 6.8.0 and
its supported Node 24.22.1 runtime. They are development tools, not game runtime
dependencies. MCP initialize/tools-list was verified against the installed server.
