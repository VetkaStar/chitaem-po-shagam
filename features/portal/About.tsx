import { ExternalLink, Heart } from 'lucide-react';
import { feedbackUrl } from '@/content/links';
export default function About() {
  return (
    <section className="portal-panel about">
      <p className="eyebrow">by Vetka_Star</p>
      <h1>Место, где можно не спешить</h1>
      <p className="welcome-note">
        «Читаем по шагам» — бесплатный учебный тренажёр для всех детей. Особое
        внимание уделяем детям с аутизмом, СДВГ и ЗПР.
      </p>
      <h2>Как всё началось</h2>
      <p>
        Я начала делать это приложение для своего ребёнка с аутизмом и СДВГ —
        чтобы помочь ему освоить чтение. Теперь хочу, чтобы здесь было уютно и
        другим семьям: можно повторять, ошибаться, просить подсказку и отдыхать.
      </p>
      <p>
        Мы не являемся аккредитованной образовательной площадкой. Это
        развивающийся авторский проект, а не официальная образовательная
        программа. Он не заменяет индивидуальные занятия со специалистом.
      </p>
      <h2>Бесплатно, благодаря вам</h2>
      <p>
        Приложение распространяется бесплатно. Проект живёт на вашу добровольную
        поддержку: она помогает развивать программу, добавлять задания и делать
        новые иллюстрации. Донат не нужен для доступа к занятиям и не покупает
        учебные звёзды.
      </p>
      <div className="support-block">
        <img
          src="./support-qr.png"
          width="220"
          height="220"
          alt="QR-код ссылки dalink.to/vetka_star для поддержки проекта"
        />
        <div>
          <h3>Помочь проекту расти</h3>
          <a
            className="primary"
            href="https://dalink.to/vetka_star"
            target="_blank"
            rel="noreferrer"
          >
            <Heart size={18} /> Поддержать проект
          </a>
          <p className="muted">Добровольная поддержка через DonationAlerts.</p>
        </div>
      </div>
      <h2>Давайте делать лучше вместе</h2>
      <p>
        Советы, пожелания и сообщения об ошибках можно писать на Boosty или в
        Telegram, а также обсуждать на трансляциях автора.
      </p>
      <div className="portal-actions">
        {[
          ['Boosty', 'https://boosty.to/vetka_star'],
          ['Telegram', 'https://t.me/vetka_star'],
          ['Twitch', 'https://www.twitch.tv/vetka_star'],
        ].map(([title, url]) => (
          <a key={title} href={url} target="_blank" rel="noreferrer">
            {title} <ExternalLink size={15} />
          </a>
        ))}
        {feedbackUrl && (
          <a href={feedbackUrl} target="_blank" rel="noreferrer">
            Форма обратной связи <ExternalLink size={15} />
          </a>
        )}
      </div>
      <h2>Ваши сохранения</h2>
      <p>
        Профиль и результаты хранятся в браузере на вашем устройстве. Единого
        аккаунта и переноса между устройствами пока нет — это в планах. Голос
        распознаётся на устройстве и не сохраняется.
      </p>
    </section>
  );
}
