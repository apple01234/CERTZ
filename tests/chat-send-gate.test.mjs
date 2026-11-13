/* 2026-11-13 "채팅안됨" 회귀 방지 — 전송은 입력창 포커스(chatFocused) 상태에서 일어나므로
 * chat:send 가 canPlayerAction 게이트(chatFocused 면 false)를 거치면 모든 메시지가 버려진다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");

test("chat:send 는 입력 게이트(menu)로 분류되지 않는다", () => {
  const body = src.slice(src.indexOf("const actionOf = (event: string"), src.indexOf("const listen = (event: string"));
  assert.ok(body.length > 0);
  const gate = body.split("\n").find((l) => l.includes('? "menu" : null'));
  assert.ok(gate, "menu 분류 줄을 찾지 못했다");
  assert.doesNotMatch(gate, /chat:send/);
  assert.match(src, /listen\("chat:send", onChatSend\)/);
  assert.match(src, /\|\| this\.chatFocused\) return false;/); // 게이트 자체는 유지(키 입력 차단용)
});
