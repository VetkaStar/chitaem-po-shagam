export default function SessionResults({ correct, skipped, practice }: { correct: number; skipped: number; practice: number }) {
  return <p className="session-results">Выполнено: {correct}. Пропущено: {skipped}. Нужно потренировать: {practice}.</p>;
}
