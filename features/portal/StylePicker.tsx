'use client';
import './style-picker.css';
import type { Layout, Look, Paper } from '../lesson/config';

export type StyleValue = { layout: Layout; look: Look; paper: Paper };

const layouts = [
  {
    id: 'order',
    name: 'Порядок',
    text: 'Меню разделов всегда рядом, всё на своих местах.',
  },
  {
    id: 'focus',
    name: 'Фокус',
    text: 'Во время задания на экране только задание и крупные кнопки.',
  },
] as const;
const looks = [
  { id: 'plain', name: 'Обычное', text: 'Белый лист задания без рисунка.' },
  {
    id: 'notebook',
    name: 'Тетрадь',
    text: 'Лист в клетку с полями, как в школьной тетради.',
  },
] as const;
const papers = [
  { id: 'main', name: 'Основной' },
  { id: 'blue', name: 'Тетрадный' },
] as const;

function Letters() {
  return (
    <span className="pv-letters">
      <i>М</i>
      <i>А</i>
    </span>
  );
}

function Preview({ kind, blue }: { kind: Layout | Look; blue: boolean }) {
  if (kind === 'order')
    return (
      <span className="pv pv-order" aria-hidden="true">
        <span className="pv-nav">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pv-card">
          <Letters />
          <i className="pv-btn" />
        </span>
      </span>
    );
  if (kind === 'focus')
    return (
      <span className="pv pv-focus" aria-hidden="true">
        <i className="pv-top" />
        <span className="pv-card">
          <Letters />
        </span>
        <span className="pv-dock">
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  if (kind === 'plain')
    return (
      <span className="pv pv-plain" aria-hidden="true">
        <span className="pv-card">
          <Letters />
          <i className="pv-btn" />
        </span>
      </span>
    );
  return (
    <span
      className={'pv pv-notebook' + (blue ? ' pv-blue' : '')}
      aria-hidden="true"
    >
      <Letters />
      <i className="pv-btn" />
    </span>
  );
}

/** Two independent choices: layout and look; the notebook look adds a page colour. */
export default function StylePicker({
  value,
  onChange,
  name,
}: {
  value: StyleValue;
  onChange: (next: StyleValue) => void;
  name: string;
}) {
  const option = (
    group: 'layout' | 'look',
    item: { id: Layout | Look; name: string; text: string },
    on: boolean,
    select: () => void,
  ) => (
    <label key={item.id} className={'style-option' + (on ? ' chosen' : '')}>
      <input
        type="radio"
        name={`${name}-${group}`}
        value={item.id}
        checked={on}
        onChange={select}
      />
      <Preview kind={item.id} blue={value.paper === 'blue'} />
      <span className="style-body">
        <span className="style-label">
          <span className="style-radio" aria-hidden="true" />
          {item.name}
        </span>
        <span className="style-text">{item.text}</span>
      </span>
    </label>
  );
  return (
    <div className="style-picker">
      <fieldset className="style-group">
        <legend>Раскладка</legend>
        <div className="style-options">
          {layouts.map((item) =>
            option('layout', item, value.layout === item.id, () =>
              onChange({ ...value, layout: item.id }),
            ),
          )}
        </div>
      </fieldset>
      <fieldset className="style-group">
        <legend>Оформление</legend>
        <div className="style-options">
          {looks.map((item) =>
            option('look', item, value.look === item.id, () =>
              onChange({ ...value, look: item.id }),
            ),
          )}
        </div>
      </fieldset>
      {value.look === 'notebook' && (
        <fieldset className="style-group style-paper">
          <legend>Цвет страницы</legend>
          <div className="style-swatches">
            {papers.map((item) => (
              <label
                key={item.id}
                className={
                  'style-swatch' + (value.paper === item.id ? ' chosen' : '')
                }
              >
                <input
                  type="radio"
                  name={`${name}-paper`}
                  value={item.id}
                  checked={value.paper === item.id}
                  onChange={() => onChange({ ...value, paper: item.id })}
                />
                <span
                  className={
                    'style-swatch-dot' + (item.id === 'blue' ? ' blue' : '')
                  }
                  aria-hidden="true"
                />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
