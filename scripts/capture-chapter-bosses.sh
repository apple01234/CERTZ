#!/usr/bin/env bash
set -eu
export BOSS_QA_OUT="${GAME_DEV_RUN_DIR:?Run through game-dev scenario run}/staging"
exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/playtest-chapter-bosses.mjs
