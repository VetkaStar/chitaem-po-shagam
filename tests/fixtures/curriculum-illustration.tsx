/** Browser-only controlled-image fixture using production assets and styles. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CurriculumIllustration } from '../../features/curriculum/CurriculumIllustration';
import '../../app/globals.css';

type Variant = 'main' | 'alternate' | 'context';
const requested: Variant[] = [];
declare global {
  interface Window {
    illustrationHarness: { requested: Variant[]; apply: (variant: Variant) => void };
  }
}
function Fixture() {
  const [variant, setVariant] = useState<Variant>('main');
  const params = new URLSearchParams(location.search);
  const story = params.get('kind') === 'story';
  window.illustrationHarness = { requested, apply: setVariant };
  return <section className="curriculum-session"><article className="curriculum-step">
    <CurriculumIllustration
      asset={story ? { kind: 'story', id: 'story-paper-map', variant: 'main' }
        : { kind: 'word', id: 'word-47', variant }}
      busy={params.get('busy') === 'true'}
      onVariant={value => requested.push(value)}
    />
  </article></section>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
