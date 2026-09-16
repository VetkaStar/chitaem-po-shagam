// Standalone, deterministic game rules. No platform state or dependencies.
export const DIFFICULTIES = ['Лёгкая', 'Средняя', 'Сложная'];
export const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const templates = [
  [5, [[0, 5, 6, 7, 12, 17, 18, 19, 24]]],
  [5, [[0, 1, 2, 7, 6, 11, 16, 17, 18, 13, 14, 19, 24]]],
  [5, [[0, 5, 10, 11, 6, 7, 8, 13, 18, 17, 22, 23, 24]]],
  [5, [[0, 1, 6, 11, 10, 15, 20, 21, 22, 17, 12, 13, 14, 19, 24]]],
  [6, [[0, 1, 7, 13, 12, 18, 24, 25, 26, 20, 14, 15, 16, 22, 28, 29, 35]]],
  [6, [[0, 6, 12, 13, 7, 8, 9, 15, 21, 20, 26, 32, 33, 34, 28, 22, 23, 29, 35]]],
  [6, [[0, 1, 2, 8, 7, 13, 19, 18, 24, 30, 31, 32, 26, 20, 21, 15, 16, 17, 23, 29, 35]]],
  [6, [[0, 6, 7, 8, 2, 3, 4, 10, 16, 15, 21, 27, 26, 25, 31, 32, 33, 34, 28, 22, 23, 29, 35]]],
  [6, [[0, 6, 7, 1, 2, 8, 14, 15, 9, 10, 4, 5, 11, 17], [18, 24, 30, 31, 25, 19, 20, 26, 32, 33, 27, 21, 22, 28, 34, 35]]],
  [6, [[0, 1, 7, 6, 12, 13, 14, 8, 2, 3, 9, 15, 16, 10, 11, 17], [18, 24, 30, 31, 25, 26, 20, 21, 27, 33, 34, 28, 22, 23, 29, 35]]],
  [6, [[0, 6, 12, 13, 7, 1, 2, 3, 9, 8, 14, 15, 16, 10, 4, 5, 11, 17], [18, 19, 25, 24, 30, 31, 32, 26, 20, 21, 22, 28, 27, 33, 34, 35]]],
  [6, [[0, 1, 2, 8, 7, 6, 12, 13, 14, 15, 9, 3, 4, 10, 16, 17], [18, 24, 30, 31, 25, 19, 20, 21, 27, 26, 32, 33, 34, 28, 22, 23, 29, 35]]],
];
const titles = ['Первая смена', 'За поворотом', 'Капля за каплей', 'Большой обход', 'Посылка в пути', 'Извилистая лента', 'Через весь цех', 'Сборочный маршрут', 'Два цеха', 'Двойная смена', 'Слаженная работа', 'Мастер завода'];
function direction(a, b, size) {
  const dx = b % size - a % size;
  const dy = Math.floor(b / size) - Math.floor(a / size);
  const d = DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
  if (d < 0) throw new Error(`Non-adjacent cells: ${a}, ${b}`);
  return d;
}
export function ports(tile) {
  return tile.ports.map(d => (d + tile.rotation) % 4);
}
export function createLevel(difficulty, index) {
  if (![0, 1, 2].includes(difficulty) || ![0, 1, 2, 3].includes(index)) throw new RangeError('Unknown level');
  const id = difficulty * 4 + index;
  const [size, paths] = templates[id];
  let seed = 101 + id * 73;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const tiles = Array.from({ length: size * size }, () => ({ kind: 'wall', ports: [], rotation: 0 }));
  const routes = paths.map((path, routeIndex) => {
    const kind = difficulty === 1 || routeIndex === 1 ? 'belt' : 'pipe';
    const machine = path[Math.floor(path.length / 2)];
    path.forEach((cell, step) => {
      const fixed = step === 0 || step === path.length - 1;
      tiles[cell] = {
        kind, ports: [step > 0 ? direction(cell, path[step - 1], size) : null, step < path.length - 1 ? direction(cell, path[step + 1], size) : null].filter(d => d !== null),
        rotation: fixed ? 0 : 1 + Math.floor(random() * 3),
        fixed, role: step === 0 ? 'source' : step === path.length - 1 ? 'goal' : cell === machine ? 'machine' : 'track',
      };
    });
    return { kind, source: path[0], goal: path.at(-1), machine };
  });
  if (difficulty > 0) tiles.forEach((tile, i) => {
    if (tile.kind === 'wall' && random() > 0.4) tiles[i] = { kind: difficulty === 1 ? 'belt' : i % 2 ? 'belt' : 'pipe', ports: [0, random() > 0.5 ? 1 : 2], rotation: Math.floor(random() * 4), role: 'track', fixed: false };
  });
  return { id, difficulty, index, size, title: titles[id], tiles, routes };
}
export function rotate(level, cell) {
  const tile = level.tiles[cell];
  if (!tile || tile.fixed || tile.kind === 'wall') return false;
  tile.rotation = (tile.rotation + 1) % 4;
  return true;
}
export function trace(level, route) {
  const visited = new Set();
  const path = [];
  let current = route.source;
  let incoming = null;
  let processed = false;
  while (!visited.has(current)) {
    visited.add(current);
    path.push(current);
    const tile = level.tiles[current];
    if (current === route.machine) processed = true;
    if (current === route.goal) return { ok: processed, path, error: current, reason: processed ? '' : 'Маршрут обошёл станок. Проведи его через шестерёнку.' };
    const exit = ports(tile).find(d => d !== incoming);
    if (exit === undefined) break;
    const [dx, dy] = DIRECTIONS[exit];
    const x = current % level.size + dx;
    const y = Math.floor(current / level.size) + dy;
    if (x < 0 || x >= level.size || y < 0 || y >= level.size) break;
    const next = y * level.size + x;
    const nextTile = level.tiles[next];
    if (nextTile.kind !== route.kind || !ports(nextTile).includes((exit + 2) % 4)) break;
    incoming = (exit + 2) % 4;
    current = next;
  }
  return { ok: false, path, error: path.at(-1), reason: 'Здесь обрыв. Поверни детали рядом с отметкой и запусти ещё раз.' };
}
export function evaluate(level) {
  const routes = level.routes.map(route => trace(level, route));
  return { ok: routes.every(route => route.ok), routes };
}
