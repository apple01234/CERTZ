// 멀티플레이 서버 전송량 실측: node scripts/qa/measure-multiplayer-load.mjs [서버모듈] [인원] [초]
// 한 구역에 N명이 접속해 0.1초마다 좌표를 보낼 때 서버→클라이언트 메시지 수·바이트를 센다.
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const mod = path.resolve(process.argv[2] || 'multiplayer/index.js'), N = Number(process.argv[3] || 60), SEC = Number(process.argv[4] || 3);
const { attachMultiplayer } = require(mod);
const { io: connect } = require('socket.io-client');
const server = http.createServer(); const mp = attachMultiplayer(server);
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}`;
let msgs = 0, bytes = 0, counting = false; const seen = [];
const socks = await Promise.all(Array.from({ length: N }, (_, i) => new Promise(res => {
  const s = connect(url, { transports: ['websocket'] });
  const roster = new Map(); seen[i] = roster;
  s.on('players', l => { if (counting) { msgs++; bytes += JSON.stringify(l).length; } roster.clear(); for (const p of l) roster.set(p.n ?? p.id, { ...p }); });
  s.on('pd', k => { if (counting) { msgs++; bytes += JSON.stringify(k).length; } for (const [n, x, y] of k.m ?? []) { const p = roster.get(n); if (p) { p.x = x; p.y = y; } } for (const n of k.l ?? []) roster.delete(n); });
  s.on('connect', () => { s.emit('join', { name: `u${i}`, lv: 10, cls: 'warrior', x: i, y: 0, stage: 'village' }); res(s); });
})));
await new Promise(r => setTimeout(r, 800));
counting = true; let t = 0;
const iv = setInterval(() => { t++; socks.forEach((s, i) => s.emit('state', { x: i * 10 + t, y: t, flip: false, moving: true, lv: 10, cls: 'warrior', stage: 'village' })); }, 100);
await new Promise(r => setTimeout(r, SEC * 1000));
clearInterval(iv); await new Promise(r => setTimeout(r, 400)); counting = false;
// 정합성: 0번 클라이언트가 보는 같은 방 사람들의 마지막 x 가 실제 보낸 값과 같은가
const view = [...seen[0].values()]; const ok = view.filter(p => { const i = Number(String(p.name).slice(1)); return p.x === i * 10 + t; }).length;
console.log(JSON.stringify({ module: path.basename(mod), clients: N, seconds: SEC, messagesPerSec: Math.round(msgs / SEC), kbPerSec: Math.round(bytes / SEC / 1024), client0Sees: view.length, client0PositionsCorrect: ok }));
socks.forEach(s => s.close()); clearInterval(mp.heartbeat); if (mp.tick) clearInterval(mp.tick); mp.io.close(); server.close(); process.exit(0);
