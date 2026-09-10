import { shuffled } from './session';
export function bubbleRound(mode: string, density: number) {
  if (mode === 'sequence') {
    const order = Array.from({ length: density }, () => [4, 3, 2]).flat();
    return { order, board: shuffled(order) };
  }
  return {
    order: shuffled([0, 1, 2, 3, 4]),
    board: shuffled(
      Array.from({ length: density }, () => [0, 1, 2, 3, 4]).flat(),
    ),
  };
}
export function bubbleChoice(
  board: number[],
  order: number[],
  step: number,
  popped: number[],
  index: number,
  mode: string,
  density: number,
) {
  if (
    step >= order.length ||
    popped.includes(index) ||
    board[index] !== order[step]
  )
    return 'wait';
  return mode === 'sequence' ||
    [...popped, index].filter((i) => board[i] === order[step]).length ===
      density
    ? 'advance'
    : 'more';
}
export function pairDeck(amount: number) {
  const chosen = shuffled([
    '🌼',
    '🐢',
    '🍓',
    '🐈',
    '🍎',
    '🦋',
    '🐟',
    '🌻',
  ]).slice(0, amount);
  return shuffled([...chosen, ...chosen]);
}

export function bubbleGrid(count: number) {
  const columns = count <= 6 ? 3 : 4;
  return { columns, rows: Math.max(1, Math.ceil(count / columns)) };
}

export function pairGrid(amount: number) {
  const columns = amount <= 2 ? 2 : amount <= 3 ? 3 : 4;
  return { columns, rows: Math.ceil((amount * 2) / columns) };
}
