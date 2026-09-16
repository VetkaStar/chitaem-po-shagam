import assert from 'node:assert/strict';
import { createLevel, rotate, evaluate, trace } from '../public/games/factory/model.js';
for (let difficulty = 0; difficulty < 3; difficulty++) {
  for (let index = 0; index < 4; index++) {
    const level = createLevel(difficulty, index);
    assert.deepEqual(level, createLevel(difficulty, index), 'Reset must restore the exact puzzle');
    assert.equal(evaluate(level).ok, false, `Level ${level.id} must start unsolved`);
    for (const route of level.routes) {
      assert.equal(rotate(level, route.source), false);
      assert.equal(rotate(level, route.goal), false);
      assert.equal(level.tiles[route.machine].role, 'machine');
    }
    for (const tile of level.tiles) tile.rotation = 0;
    const result = evaluate(level);
    assert.equal(result.ok, true, `Level ${level.id} must be solvable`);
    for (let i = 0; i < level.routes.length; i++) {
      assert(result.routes[i].path.includes(level.routes[i].machine));
      assert.equal(result.routes[i].path.at(-1), level.routes[i].goal);
      const cell = result.routes[i].path[1];
      const saved = level.tiles[cell];
      level.tiles[cell] = { kind: 'wall', ports: [], rotation: 0 };
      assert.equal(evaluate(level).ok, false);
      level.tiles[cell] = saved;
    }
    const cell = result.routes[0].path[1];
    const original = structuredClone(level.tiles[cell]);
    for (let turn = 0; turn < 4; turn++) rotate(level, cell);
    assert.deepEqual(level.tiles[cell], original);
    const route = level.routes[0];
    const tile = level.tiles[result.routes[0].path[1]];
    tile.kind = tile.kind === 'pipe' ? 'belt' : 'pipe';
    assert.equal(trace(level, route).ok, false, 'Water cannot travel on a conveyor');
  }
}
const bypass = createLevel(0, 0);
bypass.tiles.forEach(tile => { tile.rotation = 0; });
bypass.routes[0].machine = 4;
assert.equal(evaluate(bypass).ok, false, 'Reaching the goal without the machine must fail');
const cyclic = { size: 2, tiles: [[1, 2], [2, 3], [0, 1], [0, 3]].map(ports => ({ kind: 'pipe', ports, rotation: 0 })) };
const cycleResult = trace(cyclic, { kind: 'pipe', source: 0, goal: 9, machine: 1 });
assert.equal(cycleResult.ok, false);
assert.equal(cycleResult.path.length, 4, 'Cycles terminate without hanging');
assert.throws(() => createLevel(3, 0), RangeError);
assert.throws(() => createLevel(0, -1), RangeError);
console.log('Factory: 12 levels, broken routes, machine requirement, materials, rotations and cycles passed.');

