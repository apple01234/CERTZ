/** Authoritative campaign encounters. Node 24; no per-frame database writes. */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import {
  createBattle,
  stepBattle,
  STEP,
} from "../../src/game/campaign/battle.ts";
import { CHAPTER_BY_ID, FAMILIES } from "../../src/game/campaign/catalog.ts";
import { verifyProof, signProof } from "../../src/game/campaign/receipts.ts";
export function createCampaignServer({
  secret = process.env.CAMPAIGN_SERVER_SECRET ?? "",
  origins = (process.env.CAMPAIGN_ORIGINS ?? "http://localhost:3000").split(
    ",",
  ),
  now = () => Date.now(),
} = {}) {
  if (secret.length < 32)
    throw new Error(
      "CAMPAIGN_SERVER_SECRET must contain at least 32 characters",
    );
  const http = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        service: "memory-oath-realtime",
        rooms: rooms.size,
      }),
    );
  });
  const io = new Server(http, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 8192,
  });
  const rooms = new Map(),
    sessions = new Map();
  io.use((socket, next) => {
    const identity = verifyProof(socket.handshake.auth?.ticket, secret, now());
    if (
      !identity ||
      !Object.hasOwn(FAMILIES, identity.family) ||
      !Array.isArray(identity.bosses)
    )
      return next(new Error("로그인 증명이 만료되었습니다. 다시 연결하세요."));
    socket.data.identity = identity;
    next();
  });
  function emitRoom(r) {
    io.to(r.code).emit("campaign:room", {
      code: r.code,
      chapterId: r.chapterId,
      mode: r.mode,
      started: !!r.battle,
      members: [...r.members.values()].map((m) => ({
        id: m.key,
        name: m.identity.name,
        online: m.online,
      })),
      leader: r.leader,
    });
  }
  function leave(socket) {
    const code = socket.data.room,
      r = rooms.get(code);
    if (!r) return;
    const key = socket.data.key,
      m = r.members.get(key);
    if (m) {
      m.online = false;
      m.disconnectedAt = now();
    }
    socket.leave(code);
    emitRoom(r);
    socket.data.room = null;
  }
  io.on("connection", (socket) => {
    const id = socket.data.identity,
      key = `${id.uid}:${id.characterId}`;
    socket.data.key = key;
    const old = sessions.get(key);
    if (old && old !== socket.id) io.sockets.sockets.get(old)?.disconnect(true);
    sessions.set(key, socket.id);
    socket.on("campaign:create", (p = {}) => {
      if (socket.data.room)
        return socket.emit("campaign:error", "먼저 현재 파티에서 나가세요.");
      if (!id.bosses.includes(p.chapterId) || !CHAPTER_BY_ID[p.chapterId]?.boss)
        return socket.emit(
          "campaign:error",
          "본편에서 완료한 보스만 도전할 수 있습니다.",
        );
      if (rooms.size >= 200)
        return socket.emit(
          "campaign:error",
          "서버가 가득 찼습니다. 잠시 뒤 다시 시도하세요.",
        );
      const code = randomUUID().slice(0, 8).toUpperCase(),
        r = {
          code,
          chapterId: p.chapterId,
          mode: p.mode === "coop" ? "coop" : "solo",
          leader: key,
          members: new Map(),
          battle: null,
          inputs: {},
          createdAt: now(),
          receipt: null,
        };
      rooms.set(code, r);
      join(socket, r);
    });
    function join(s, r) {
      const identity = s.data.identity,
        k = s.data.key;
      let m = r.members.get(k);
      if (m && !m.online && now() - m.disconnectedAt > 60000)
        return s.emit(
          "campaign:error",
          "재접속 대기 시간이 지났습니다. 새로 도전하세요.",
        );
      if (!m) {
        if (r.battle || r.members.size >= (r.mode === "coop" ? 3 : 1))
          return s.emit(
            "campaign:error",
            "이미 시작했거나 가득 찬 파티입니다.",
          );
        if (!identity.bosses.includes(r.chapterId))
          return s.emit(
            "campaign:error",
            "이 보스를 본편에서 먼저 완료하세요.",
          );
        m = { key: k, identity, online: true, disconnectedAt: 0 };
        r.members.set(k, m);
      }
      m.online = true;
      m.identity = identity;
      s.data.room = r.code;
      s.join(r.code);
      emitRoom(r);
      if (r.battle) s.emit("campaign:state", r.battle);
      if (r.receipt) s.emit("campaign:receipt", r.receipt);
    }
    socket.on("campaign:join", (p = {}) => {
      const r = rooms.get(String(p.code ?? "").toUpperCase());
      if (!r) return socket.emit("campaign:error", "파티를 찾을 수 없습니다.");
      if (socket.data.room && socket.data.room !== r.code)
        return socket.emit("campaign:error", "현재 파티에서 먼저 나가세요.");
      join(socket, r);
    });
    socket.on("campaign:start", () => {
      const r = rooms.get(socket.data.room);
      if (!r || r.leader !== key) return;
      if (r.battle) return;
      if (
        r.mode === "coop" &&
        (r.members.size !== 3 || [...r.members.values()].some((m) => !m.online))
      )
        return socket.emit(
          "campaign:error",
          "3명이 모두 연결되어야 출발할 수 있습니다.",
        );
      r.battle = createBattle(
        randomUUID(),
        r.chapterId,
        r.mode,
        [...r.members.values()].map((m) => ({
          id: m.key,
          name: m.identity.name,
          family: m.identity.family,
        })),
        CHAPTER_BY_ID[r.chapterId].boss.pattern,
      );
      emitRoom(r);
    });
    socket.on("campaign:input", (p = {}) => {
      const r = rooms.get(socket.data.room);
      if (!r || !r.battle || !r.members.get(key)?.online) return;
      const last = socket.data.lastInput ?? 0;
      if (now() - last < 20) return;
      socket.data.lastInput = now();
      r.inputs[key] = {
        x: Number.isFinite(p.x) ? Math.max(-1, Math.min(1, p.x)) : 0,
        y: Number.isFinite(p.y) ? Math.max(-1, Math.min(1, p.y)) : 0,
        attack: p.attack === true,
        skill: p.skill === true,
        dodge: p.dodge === true,
        revive: p.revive === true,
        at: now(),
      };
    });
    socket.on("campaign:leave", () => {
      const r = rooms.get(socket.data.room);
      leave(socket);
      if (r && !r.battle) {
        r.members.delete(key);
        if (r.leader === key) r.leader = r.members.keys().next().value;
        emitRoom(r);
      }
    });
    socket.on("disconnect", () => {
      leave(socket);
      if (sessions.get(key) === socket.id) sessions.delete(key);
    });
  });
  const timer = setInterval(() => {
    for (const [code, r] of rooms) {
      const members = [...r.members.values()];
      if (
        (!members.some((m) => m.online) &&
          members.every(
            (m) => now() - (m.disconnectedAt || r.createdAt) > 60000,
          )) ||
        (!r.battle && now() - r.createdAt > 1800000)
      ) {
        rooms.delete(code);
        continue;
      }
      if (!r.battle || r.battle.status !== "fighting") continue;
      const inputs = {};
      for (const m of members) {
        const v = r.inputs[m.key];
        if (m.online && v && now() - v.at < 300) inputs[m.key] = v;
      }
      stepBattle(r.battle, inputs, STEP);
      io.to(code).emit("campaign:state", r.battle);
      if (r.battle.status === "won" && !r.receipt) {
        r.receipt = signProof(
          {
            id: r.battle.id,
            chapterId: r.chapterId,
            mode: r.mode,
            time: Math.round(r.battle.time),
            deaths: r.battle.players.reduce((n, p) => n + p.deaths, 0),
            members: members.map((m) => ({
              uid: m.identity.uid,
              characterId: m.identity.characterId,
              name: m.identity.name,
            })),
            exp: now() + 3600000,
          },
          secret,
        );
        io.to(code).emit("campaign:receipt", r.receipt);
      }
    }
  }, STEP);
  timer.unref();
  return {
    http,
    io,
    rooms,
    close: async () => {
      clearInterval(timer);
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createCampaignServer();
  server.http.listen(Number(process.env.CAMPAIGN_PORT ?? 3010), "0.0.0.0", () =>
    console.log("Campaign realtime server listening"),
  );
}
