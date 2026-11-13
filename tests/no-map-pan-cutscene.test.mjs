/* 2026-11-13 유저 지시 "쓸데없는 컷씬 빼기(맵 보여주는 컷씬 빼기)" 회귀 방지.
 * 대사 없이 맵만 훑는 컷은 재생하지 않고, 대사가 달린 컷은 카메라를 플레이어에 둔 채 대사만 낸다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chapterIntroOf, stageIntroOf } from "../src/game/storyCutscenes.ts";

const scene = readFileSync(new URL("../src/game/scenes/WorldScene.ts", import.meta.url), "utf8");
const body = scene.slice(scene.indexOf("private playChapterIntroCutscene("), scene.indexOf("private cutsceneActorPosition("));

test("입장 컷씬은 대사 달린 컷만, 플레이어 위치에서 재생한다", () => {
  assert.match(body, /spec\.shots\.filter\(\(s\) => s\.dialogue\)/);
  assert.match(body, /focus: "player"/);
  assert.match(body, /if \(!talk\.length\) return false;/);
  assert.match(body, /resolveChapterIntroShots\(\{ \.\.\.spec, shots: talk \}/);
});

test("대사 없는 연출(영프 15장 입장·구역 템플릿)은 남는 컷이 없다", () => {
  for (let n = 1; n <= 15; n++) assert.equal(chapterIntroOf(`howlrstone${n}`).shots.filter((s) => s.dialogue).length, 0);
  assert.equal(stageIntroOf("howlrstone2", 3).shots.filter((s) => s.dialogue).length, 0);
  assert.equal(chapterIntroOf("dlcstargate").shots.filter((s) => s.dialogue).length, 1);
});
