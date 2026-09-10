'use client';
import { visionProfiles, visionStyle, type VisionMode } from '@/lib/vision';
export default function VisionSettings({
  value,
  onChange,
}: {
  value: VisionMode;
  onChange: (v: VisionMode) => void;
}) {
  return (
    <div className="vision-settings">
      <div className="setting">
        <label htmlFor="color-vision">
          <b>Режим для дальтоников</b>
          <small>Палитра и подсказки, которые можно различать без цвета.</small>
        </label>
        <select
          id="color-vision"
          value={value}
          onChange={(e) => onChange(e.target.value as VisionMode)}
        >
          {Object.entries(visionProfiles).map(([id, p]) => (
            <option key={id} value={id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {value !== 'off' && (
        <>
          <p>
            Для красно-зелёных нарушений используются синий и охра, для
            сине-жёлтых — бирюзовый и малиновый. Выбери наиболее удобный вариант
            по образцу.
          </p>
          <div
            className="vision-preview"
            aria-label="Образец подсказок"
            data-vision={value}
            style={visionStyle(value)}
          >
            <div className="vision-example vision-example-vowel">
              <strong aria-hidden="true">А</strong>
              <b>А — гласная</b>
              <small>Две толстые линии</small>
            </div>
            <div className="vision-example vision-example-consonant">
              <strong aria-hidden="true">М</strong>
              <b>М — согласная</b>
              <small>Одна толстая линия</small>
            </div>
            <div className="vision-example vision-example-success">
              <strong aria-hidden="true">✓</strong>
              <b>Получилось</b>
              <small>Галочка и сплошная рамка</small>
            </div>
            <div className="vision-example vision-example-hint">
              <strong aria-hidden="true">?</strong>
              <b>Подсказка</b>
              <small>Вопрос и пунктирная рамка</small>
            </div>
          </div>
          <p>
            Гласные — двойная линия, согласные — одна. В пузырьках ищем
            одинаковые знаки. Это настройка отображения, не проверка зрения.
          </p>
        </>
      )}
    </div>
  );
}
