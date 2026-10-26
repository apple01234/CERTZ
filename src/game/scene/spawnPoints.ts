/**
 * scene/spawnPoints.ts — 개방 지점 탐색 유틸 (vc189, WorldScene 분할 2차)
 *
 * 왜 분리하나
 *   던전 레이아웃(`RoomLayout`) 위에서 "적·장식·파편을 놓을 수 있는 빈 땅"을 찾는
 *   순수 기하 연산이다. 게임 상태를 바꾸지 않고 WorldScene 필드도 거의 안 쓴다
 *   (layout / player / solidGroup / stageW / stageH 다섯 개).
 *
 * 동작 보존
 *   재시도 24회, 셀 내부 ±26% 산포, 최소거리 검사, 결정적 rng 주입 — 전부 원본 그대로.
 *   `openPointAny` 만 Date.now()+랜덤 시드를 쓰는 비결정 경로를 유지한다(파편용).
 */
import Phaser from "phaser";
import { cellCenterOf, isOpenXY, type RoomLayout } from "../mapgen";

export interface SpawnPointHost {
  layout: RoomLayout | null;
  player?: { x: number; y: number } | null;
  solidGroup: Phaser.GameObjects.Group;
  stageW: number;
  stageH: number;
}

export interface OpenPointOpts {
  minDist?: number;
  avoidEntry?: boolean;
}

const MAX_TRIES = 24;
const CELL_SPREAD = 0.26;

/**
 * 레이아웃 내 무작위 개방 지점 — 적/오브젝트 스폰 공용 (결정적 rng 주입).
 * 레이아웃이 없으면(마을 등) 맵 안쪽 임의 좌표로 폴백한다.
 */
export function openPointRng(
  host: SpawnPointHost,
  rng: Phaser.Math.RandomDataGenerator,
  opts?: OpenPointOpts,
): { x: number; y: number } {
  const lay = host.layout;
  if (!lay) return { x: rng.between(240, host.stageW - 160), y: rng.between(120, host.stageH - 120) };

  const idxs: number[] = [];
  const openCount = lay.open.filter(Boolean).length;
  for (let i = 0; i < lay.open.length; i++) {
    if (!lay.open[i]) continue;
    if (opts?.avoidEntry && i === lay.entry && openCount > 2) continue;
    idxs.push(i);
  }
  if (idxs.length === 0) idxs.push(lay.entry);

  const minDist = opts?.minDist ?? 0;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const cell = idxs[rng.between(0, idxs.length - 1)];
    const c = cellCenterOf(lay, cell);
    const x = c.x + rng.realInRange(-lay.cellW * CELL_SPREAD, lay.cellW * CELL_SPREAD);
    const y = c.y + rng.realInRange(-lay.cellH * CELL_SPREAD, lay.cellH * CELL_SPREAD);
    if (minDist > 0 && host.player && Phaser.Math.Distance.Between(x, y, host.player.x, host.player.y) < minDist) continue;
    return { x, y };
  }
  return cellCenterOf(lay, idxs[rng.between(0, idxs.length - 1)]);
}

/** 실행 시점 무작위 개방 지점 (파편 등 — 재결정성 불필요) */
export function openPointAny(host: SpawnPointHost, opts?: OpenPointOpts): { x: number; y: number } {
  return openPointRng(host, new Phaser.Math.RandomDataGenerator([`${Date.now()}-${Phaser.Math.Between(0, 1e9)}`]), opts);
}

/** 지점이 개방 영역인지 — 장식 배치 판정용 */
export function inOpenArea(host: SpawnPointHost, x: number, y: number): boolean {
  return !host.layout || isOpenXY(host.layout, x, y);
}

/** 배치 겹침 방지: 지점이 기존 충돌 오브제(나무/바위) 중심에 너무 가까운지 */
export function nearSolidObstacle(host: SpawnPointHost, x: number, y: number, minDist: number): boolean {
  for (const go of host.solidGroup.getChildren()) {
    if (!go.active || !go.getData("obstacle")) continue;
    const s = go as Phaser.Physics.Arcade.Sprite;
    if (Phaser.Math.Distance.Between(x, y, s.x, s.y) < minDist) return true;
  }
  return false;
}
