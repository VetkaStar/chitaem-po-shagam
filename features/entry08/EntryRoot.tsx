import EntryScreens from './EntryScreens';
import PersonalLesson from './PersonalLesson';
import { useEntry08 } from './use-entry08';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import type { Settings } from '../lesson/config';
export default function EntryRoot(props: {
  controller: CurriculumController;
  supply: Supply;
  settings: Settings;
  onExit: () => void;
  media?: ReturnType<typeof import('./media').createEntryMedia>;
}) {
  const m = useEntry08(
    props.controller,
    props.supply,
    props.settings,
    props.onExit,
    props.media,
  );
  if (!m.ui)
    return (
      <section className="portal-panel" aria-busy={m.busy}>
        <p role={m.error ? 'alert' : 'status'}>
          {m.error || 'Открываем знакомство…'}
        </p>
      </section>
    );
  if (m.ui.page === 'lesson' && m.view && m.personal)
    return (
      <PersonalLesson
        {...m}
        view={m.view}
        voiceEnabled={m.entry?.config.input !== 'buttons'}
        number={m.personal.visit.used}
        total={m.personal.visit.budget}
        playingTarget={m.personal.active?.audio?.scope === 'target'}
      />
    );
  return (
    <>
      <EntryScreens
        {...m}
        page={m.ui.page === 'lesson' ? 'report' : m.ui.page}
        answers={m.ui.answers}
        accessHint={m.ui.accessHint}
        companion={m.entry?.config.companion}
        played={m.entry?.active?.played}
        playingTarget={m.entry?.active?.audio?.scope === 'target'}
      />
      <button disabled={m.busy} onClick={() => m.dispatch('exit')}>
        К тренажёрам
      </button>
    </>
  );
}
