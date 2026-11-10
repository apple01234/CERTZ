#!/usr/bin/env node
// Compare the live game with main. Never extract credentials from a Git remote.
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { setTimeout: sleep } = require('node:timers/promises');
const SHA = /^[a-f0-9]{40}$/i;

async function verifyDeployment({ readMain, readVersion, attempts = 1, wait = async () => {}, log = () => {} }) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const expectedSha = await readMain();
      if (!SHA.test(expectedSha ?? '')) throw new Error('main SHA is missing or invalid');
      const version = await readVersion();
      const actualSha = version.commitSha;
      // main may advance while the deployment response is in flight.
      const stillCurrent = actualSha === expectedSha && await readMain() === expectedSha;
      result = { ok: stillCurrent, expectedSha, actualSha: actualSha ?? null, version: version.latest, code: version.code, attempt };
      if (stillCurrent) return result;
      result.reason = SHA.test(actualSha ?? '') ? 'Production is behind main or main advanced during verification' : 'Production did not report a valid commitSha';
    } catch (error) {
      result = { ok: false, attempt, reason: error.message };
    }
    log(result);
    if (attempt < attempts) await wait();
  }
  return result;
}

async function readJson(url, headers = {}) {
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Verification request failed: HTTP ${response.status} (${new URL(url).hostname})`);
  return response.json();
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { attempts: { type: 'string', default: '1' }, 'interval-ms': { type: 'string', default: '20000' } } });
  const attempts = Number(values.attempts), interval = Number(values['interval-ms']);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60 || !Number.isInteger(interval) || interval < 0 || interval > 60000) throw new Error('Invalid attempts or interval-ms');
  const pinned = positionals[0] === 'HEAD' ? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : positionals[0];
  if (pinned && !SHA.test(pinned)) throw new Error('Expected a full commit SHA or HEAD');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const readMain = pinned ? async () => pinned : async () => {
    const result = await readJson('https://api.github.com/repos/apple01234/CERTZ/commits/main', {
      Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
    return result.sha;
  };
  const result = await verifyDeployment({ readMain, readVersion: () => readJson(`https://sertz.vercel.app/api/version?verify=${Date.now()}`), attempts,
    wait: () => sleep(interval), log: event => console.log(JSON.stringify(event)) });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
module.exports = { verifyDeployment };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
