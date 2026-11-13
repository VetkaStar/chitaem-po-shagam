import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../app/globals.css';
import IllustrationGallery from '../../components/illustration-gallery';
import { CurriculumIllustration } from '../../features/curriculum/CurriculumIllustration';
import { pilotIllustrations } from '../../content/illustrations-pilot';

function Fixture() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') as keyof typeof pilotIllustrations;
  const [variant, setVariant] = useState<'main' | 'alternate' | 'context'>('main');
  return <main style={{ padding: 12 }}>
    {params.get('mode') === 'authored'
      ? <CurriculumIllustration asset={{ id, kind: id.startsWith('scene-') ? 'story' : 'word', variant }} busy={false} onVariant={setVariant} />
      : <IllustrationGallery assetId={id} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
