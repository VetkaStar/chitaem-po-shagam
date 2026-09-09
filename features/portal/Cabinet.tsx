import { Star, Shirt, Cat, UserRound } from 'lucide-react';
import type { Profile } from './profile';
export default function Cabinet({
  profile,
  stars,
  onEdit,
}: {
  profile: Profile;
  stars: number;
  onEdit: () => void;
}) {
  return (
    <section className="portal-panel">
      <p className="eyebrow">МОЙ КАБИНЕТ</p>
      <h1>{profile.name}, это твоё место</h1>
      <p className="star-total">
        <Star /> {stars} звёзд
      </p>
      <button onClick={onEdit}>Изменить имя и возраст</button>
      <h2>Скоро: твой маленький мир</h2>
      <p>
        За звёзды, которые ты получаешь в занятиях, планируем открывать
        украшения для твоего мира. Звёзды уже копятся; магазин ещё не открыт.
      </p>
      <div className="portal-grid">
        {[
          [UserRound, 'Твой персонаж', 'Выбери героя и придумай ему образ.'],
          [Shirt, 'Костюмчики', 'Наряды и аксессуары за учебные звёзды.'],
          [Cat, 'Питомец', 'Маленький друг, который будет рядом.'],
        ].map(([Icon, title, text]: any) => (
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
