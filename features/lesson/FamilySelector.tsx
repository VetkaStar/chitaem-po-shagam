import { FreeExposureFrame } from '../free-practice/FreeExposureFrame';
import { useFreeExposure } from '../free-practice/use-free-exposure';
import type { LessonModel } from './use-lesson';

export default function FamilySelector({ model }: {
  model: Pick<LessonModel, 'family' | 'availableFamilies' | 'selectFamily'>;
}) {
  const exposure = useFreeExposure({
    texts: model.availableFamilies.flatMap(f => f.parts),
  });
  return (
    <FreeExposureFrame ready={exposure.ready} blocker={exposure.blocker}>
      <div className="practice-controls family-selector">
        <label>
          Семейство слов{' '}
          <select aria-label="Семейство слов" value={model.family?.id ?? ''}
            onChange={event => model.selectFamily(event.target.value)}>
            <option value="">Все слоги темы</option>
            {model.availableFamilies.map(f => (
              <option key={f.id} value={f.id}>{f.parts.join(' + ')}</option>
            ))}
          </select>
        </label>
      </div>
    </FreeExposureFrame>
  );
}
