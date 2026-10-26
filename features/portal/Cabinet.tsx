import { Star, Shirt, Cat, UserRound, type LucideIcon } from 'lucide-react';
import type { Profile } from './profile';
import { plural } from '../../lib/plural';
import { stages, type Entry } from '../lesson/config';
const upcoming: [LucideIcon, string, string][] = [
  [UserRound, 'Твой персонаж', 'Выбери героя и придумай ему образ.'],
  [Shirt, 'Костюмчики', 'Наряды и аксессуары за учебные звёзды.'],
  [Cat, 'Питомец', 'Маленький друг, который будет рядом.'],
];
export default function Cabinet({
  profile,
  stars,
  history = [],
  onContinue,
  onPrograms,
  onEdit,
  onLogout,
}: {
  profile: Profile;
  stars: number;
  history?: Entry[];
  onContinue?: () => void;
  onPrograms?: () => void;
  onEdit: () => void;
  onLogout?: () => void;
}) {
  return (
    <section className="portal-panel">
      <p className="eyebrow">МОЙ КАБИНЕТ</p>
      <h1>{profile.name}, это твоё место</h1>
      <p className="star-total">
        <Star /> {stars} {plural(stars, ['звезда', 'звезды', 'звёзд'])}
      </p>
      <div className="curriculum-actions">
        <button onClick={onEdit}>Изменить имя и возраст</button>
        {onLogout && <button onClick={onLogout}>Выйти из профиля</button>}
      </div>
      <h2>Мои занятия</h2>
      <div className="curriculum-actions">
        {onContinue && <button onClick={onContinue}>Открыть свободный тренажёр</button>}
        {onPrograms && <button onClick={onPrograms}>Программы и учебные результаты</button>}
      </div>
      <p>Последние действия в свободных занятиях. Звёзды показывают выполненные задания, а не подтверждённое освоение навыка.</p>
      {history.length ? (
        <ol className="activity-history">
          {history.slice(-10).reverse().map((entry, index) => (
            <li key={`${entry.at}:${index}`}>
              <strong>{entry.target}</strong>
              <span>{stages.find((stage) => stage.id === entry.stage)?.name ?? 'Тексты'} · {entry.result === 'success' ? 'Выполнено' : entry.result === 'skip' ? 'Пропущено' : entry.result === 'repeat-success' ? 'Повторено' : 'Тренировка'}</span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString('ru-RU')}</time>
            </li>
          ))}
        </ol>
      ) : <p>Здесь появятся действия после первых занятий.</p>}
      <h2>Скоро: твой маленький мир</h2>
      <p>
        За звёзды, которые ты получаешь в занятиях, планируем открывать
        украшения для твоего мира. Звёзды уже копятся; магазин ещё не открыт.
      </p>
      <div className="portal-grid">
        {upcoming.map(([Icon, title, text]) => (
          <div className="portal-card" key={title}>
            <Icon size={32} />
            <b>{title}</b>
            <span>{text}</span>
            <span className="soon">Скоро</span>
          </div>
        ))}
      </div>
      <p className="storage-note">
        Сейчас это локальный профиль. Синхронизация и перенос прогресса между
        устройствами появятся позже.
      </p>
    </section>
  );
}
