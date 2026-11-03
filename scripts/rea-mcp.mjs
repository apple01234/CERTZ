/** REA development tooling uses its own supported runtime, outside game dependencies. */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  [
    "exec",
    "--yes",
    "--omit=optional",
    "--package=node@24.22.1",
    "--package=rea-agents@6.8.0",
    "--",
    "rea",
    "mcp",
  ],
  { stdio: "inherit", cwd: homedir(), shell: process.platform === "win32" },
);
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
