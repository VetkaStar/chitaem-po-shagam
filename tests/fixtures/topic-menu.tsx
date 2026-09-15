import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TopicBar from '../../components/topic-bar';
import { topicNames } from '../../lib/topics';
import '../../app/globals.css';

function Fixture() {
  const [unit, setUnit] = useState(0);
  const [changes, setChanges] = useState(0);
  const compact =
    new URLSearchParams(location.search).get('compact') === 'true';
  return (
    <main className="curriculum-session">
      <button type="button" id="outside-before">
        До меню
      </button>
      <TopicBar
        compact={compact}
        chipLabel="Слоги · тема"
        unit={unit}
        current={topicNames[unit]}
        nextLabel={topicNames[unit + 1] ?? topicNames[0]}
        onNext={() => setUnit((value) => (value + 1) % topicNames.length)}
        onSelect={(value) => {
          setUnit(value);
          setChanges((count) => count + 1);
        }}
        onSpeak={() => undefined}
      />
      <button type="button" id="outside-after">
        Вне меню
      </button>
      <output data-testid="selection">
        {unit}:{changes}
      </output>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
