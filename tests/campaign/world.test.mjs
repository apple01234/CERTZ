import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS } from "../../src/game/campaign/catalog.ts";
import {
  buildCampaignMap,
  canWalkAt,
  walkingRoute,
  MAP_COLS,
  MAP_ROWS,
} from "../../src/game/campaign/world.ts";

test("every story map keeps entry, dialogue and all objective positions reachable", () => {
  const points = [
    { x: 512, y: 300 },
    { x: 512, y: 240 },
    { x: 310, y: 330 },
    { x: 700, y: 250 },
    { x: 765, y: 470 },
    { x: 400, y: 510 },
  ];
  for (const chapter of CHAPTERS) {
    const map = buildCampaignMap(
      chapter.theme,
      chapter.episode,
      !!chapter.boss,
    );
    assert.equal(map.ground.length, MAP_COLS * MAP_ROWS);
    for (const point of points) {
      const route = walkingRoute(map, { x: 512, y: 485 }, point);
      assert.ok(route.length > 0, `${chapter.id}: ${JSON.stringify(point)}`);
      assert.ok(route.every((p) => canWalkAt(map, p)));
    }
  }
});
test("click routes detour around walls and reject water, lava and outside targets", () => {
  const map = buildCampaignMap("castle", 1);
  map.collision[3 * MAP_COLS + 4] = true;
  const route = walkingRoute(map, { x: 160, y: 224 }, { x: 480, y: 224 });
  assert.ok(route.some((p) => p.y !== 224));
  assert.ok(route.every((p) => canWalkAt(map, p)));
  assert.deepEqual(walkingRoute(map, { x: 160, y: 224 }, { x: -1, y: 0 }), []);
  for (const theme of ["harbor", "volcano"])
    assert.deepEqual(
      walkingRoute(
        buildCampaignMap(theme, 1),
        { x: 512, y: 485 },
        { x: 96, y: 300 },
      ),
      [],
    );
});

test("the library passage changes navigation while boss rooms preserve their clear arena", () => {
  const room = buildCampaignMap("castle", 1);
  const route = walkingRoute(room, { x: 544, y: 352 }, { x: 288, y: 352 });
  assert.ok(route.some((point) => point.y === 288));
  assert.ok(room.structures.some(Boolean));
  assert.ok(
    buildCampaignMap("castle", 1, true).structures.every(
      (tile) => tile === null,
    ),
  );
});
