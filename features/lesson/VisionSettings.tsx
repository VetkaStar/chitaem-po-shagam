'use client';
import { visionProfiles, type VisionMode } from '@/lib/vision';
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
          <div className="vision-preview" aria-label="Образец подсказок">
            <span className="vowel">А — гласная</span>
            <span className="consonant">М — согласная</span>
            <span className="feedback success">✓ Получилось</span>
            <span className="feedback uncertain">? Подсказка</span>
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
