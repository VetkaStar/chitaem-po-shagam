export function breakDue(completed: number, every: number, length: number) {
  return (
    every > 0 && completed > 0 && completed < length && completed % every === 0
  );
}
