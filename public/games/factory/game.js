import { createLevel, rotate, evaluate, ports } from './model.js';
const $ = id => document.getElementById(id);
const KEY = 'little-factory-progress-v1';
let completed = [];
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(saved)) completed = [...new Set(saved.filter(id => Number.isInteger(id) && id >= 0 && id < 12))]; } catch { /* Private browsing: progress stays in memory. */ }
let difficulty = 0, index = 0, level, turns = 0, running = false, won = false, runId = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const directionNames = ['вверх', 'вправо', 'вниз', 'влево'];
function svg(tile) {
  if (tile.kind === 'wall') return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="35" cy="35" r="4"/><circle cx="65" cy="65" r="4"/></svg>';
  const ends = [[50, 0], [100, 50], [50, 100], [0, 50]];
  const path = tile.ports.map((d, i) => `${i === 0 ? 'M' : 'L'}${ends[d].join(' ')}${i === 0 ? ' L50 50' : ''}`).join(' ');
  const mark = tile.role === 'source' ? (tile.kind === 'pipe' ? '●' : '◆') : tile.role === 'goal' ? '⚑' : tile.role === 'machine' ? '⚙' : '';
  const label = tile.role === 'source' ? 'СТАРТ' : tile.role === 'goal' ? 'ФИНИШ' : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rivet" cx="11" cy="11" r="2"/><circle class="rivet" cx="89" cy="89" r="2"/><g class="rotor" style="--rotation:${tile.rotation * 90}deg"><path class="track-shadow" d="${path}"/><path class="track" d="${path}"/>${tile.kind === 'belt' ? `<path class="treads" d="${path}"/>` : ''}</g>${mark ? `<circle cx="50" cy="47" r="21" fill="#315d49"/><text class="badge" x="50" y="47">${mark}</text>` : ''}${label ? `<rect x="16" y="73" width="68" height="20" rx="6" fill="#fffbed"/><text class="endpoint-label" x="50" y="88">${label}</text>` : ''}</svg>`;
}
function describe(tile, cell) {
  const kind = tile.kind === 'pipe' ? 'Труба' : 'Конвейер';
  const role = { source: 'Старт', goal: 'Финиш', machine: 'Станок', track: kind }[tile.role];
  return `${role}, ряд ${Math.floor(cell / level.size) + 1}, столбец ${cell % level.size + 1}. Соединения: ${ports(tile).map(d => directionNames[d]).join(', ')}.${tile.fixed ? '' : ' Нажми для поворота.'}`;
}
function updateTile(cell) {
  const button = $('board').children[cell];
  const tile = level.tiles[cell];
  button.innerHTML = svg(tile);
  button.setAttribute('aria-label', describe(tile, cell));
}
function setStatus(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function clearTrace() { [...$('board').children].forEach(button => button.classList.remove('visited', 'current', 'broken')); }
function renderLevels() {
  $('levels').replaceChildren();
  for (let i = 0; i < 4; i++) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = String(i + 1);
    button.setAttribute('aria-current', String(index === i));
    const done = completed.includes(difficulty * 4 + i);
    button.classList.toggle('complete', done);
    button.setAttribute('aria-label', `Уровень ${i + 1}${done ? ', пройден' : ''}`);
    button.addEventListener('click', () => load(difficulty, i));
    $('levels').append(button);
  }
  $('progress').textContent = `${completed.filter(id => Math.floor(id / 4) === difficulty).length} / 4`;
}
function load(d, i) {
  runId++; difficulty = d; index = i; level = createLevel(d, i); turns = 0; running = false; won = false;
  $('turns').textContent = '0'; $('success').hidden = true; $('launch').disabled = false;
  $('launch').innerHTML = '<span>▶</span> Запустить завод';
  $('level-title').textContent = level.title;
  $('level-number').textContent = `УРОВЕНЬ ${String(i + 1).padStart(2, '0')} / 04`;
  $('difficulty').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.difficulty) === d)));
  renderLevels();
  $('board').style.setProperty('--size', level.size);
  $('board').replaceChildren();
  level.tiles.forEach((tile, cell) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `tile ${tile.kind} ${tile.role || ''}`;
    button.disabled = Boolean(tile.fixed || tile.kind === 'wall');
    if (tile.kind === 'wall') button.setAttribute('aria-label', 'Пустое место');
    else button.setAttribute('aria-label', describe(tile, cell));
    button.innerHTML = svg(tile);
    button.addEventListener('click', () => {
      if (running || won || !rotate(level, cell)) return;
      clearTrace(); turns++; $('turns').textContent = String(turns); updateTile(cell);
      setStatus('Готово? Нажми «Запустить завод».');
    });
    button.addEventListener('keydown', event => {
      const offsets = { ArrowUp: -level.size, ArrowRight: 1, ArrowDown: level.size, ArrowLeft: -1 };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      let next = cell + offset;
      while (next >= 0 && next < level.tiles.length) {
        if (Math.abs(offset) === 1 && Math.floor(next / level.size) !== Math.floor(cell / level.size)) break;
        const target = $('board').children[next];
        if (!target.disabled) { target.focus(); break; }
        next += offset;
      }
    });
    $('board').append(button);
  });
  setStatus(d === 2 ? 'Собери оба маршрута: вода ● и груз ◆. Каждый — через свой станок ⚙.' : 'Нажимай на детали: соедини СТАРТ → станок ⚙ → ФИНИШ.');
}
function unlockBoard() {
  level.tiles.forEach((tile, i) => { $('board').children[i].disabled = Boolean(tile.fixed || tile.kind === 'wall'); });
}
async function launch() {
  if (running || won) return;
  running = true; const token = ++runId;
  $('launch').disabled = true;
  [...$('board').children].forEach(button => { button.disabled = true; });
  $('launch').textContent = 'Завод работает…'; clearTrace(); setStatus('Проверяем доставку…');
  const result = evaluate(level);
  const length = Math.max(...result.routes.map(route => route.path.length));
  for (let step = 0; step < length; step++) {
    if (token !== runId) return;
    [...$('board').children].forEach(button => button.classList.remove('current'));
    result.routes.forEach(route => {
      const cell = route.path[step];
      if (cell !== undefined) $('board').children[cell].classList.add('visited', 'current');
    });
    await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 15 : 160));
  }
  if (token !== runId) return;
  [...$('board').children].forEach(button => button.classList.remove('current'));
  running = false;
  if (result.ok) {
    won = true;
    if (!completed.includes(level.id)) completed.push(level.id);
    try { localStorage.setItem(KEY, JSON.stringify(completed)); } catch { /* No persistence available. */ }
    renderLevels();
    setStatus('Все маршруты работают. Уровень пройден!');
    $('success-title').textContent = index === 3 ? 'Смена завершена!' : 'Завод работает!';
    $('success-text').textContent = `Всё доставлено за ${turns} поворотов. Отличная работа!`;
    $('next').textContent = index < 3 ? 'Следующий уровень →' : difficulty < 2 ? 'Следующая сложность →' : 'Сыграть ещё раз ↻';
    $('success').hidden = false; $('launch').textContent = '✓ Всё доставлено';
    $('next').focus({ preventScroll: true });
    $('success').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  } else {
    result.routes.filter(route => !route.ok).forEach(route => $('board').children[route.error].classList.add('broken'));
    setStatus(result.routes.find(route => !route.ok).reason, true);
    $('launch').disabled = false; $('launch').innerHTML = '<span>▶</span> Попробовать ещё'; unlockBoard();
  }
}
$('difficulty').addEventListener('click', event => { const button = event.target.closest('button[data-difficulty]'); if (button) load(Number(button.dataset.difficulty), 0); });
$('reset').addEventListener('click', () => load(difficulty, index));
$('launch').addEventListener('click', launch);
$('next').addEventListener('click', () => { load(index < 3 ? difficulty : (difficulty + 1) % 3, index < 3 ? index + 1 : 0); $('launch').focus({ preventScroll: true }); });
load(0, 0);
