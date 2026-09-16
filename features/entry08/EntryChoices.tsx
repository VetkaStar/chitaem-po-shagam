import {
  Baby,
  Gamepad2,
  House,
  Laptop,
  PawPrint,
  UserRound,
  UsersRound,
  Volume2,
} from 'lucide-react';
import type { EntryDispatch } from './entry-screen-types';

const symbols = {
  child: Baby,
  parent: UsersRound,
  self: UserRound,
  technology: Laptop,
  videogames: Gamepad2,
  animals: PawPrint,
  everyday: House,
};
const pictures: Record<string, string> = {
  technology: 'illustrations/reviewed-120/picture-10-main.webp',
  videogames: 'illustrations/stories/story-game-build-01.webp',
  animals: 'illustrations/reviewed-120/picture-02-main.webp',
  everyday: 'illustrations/reviewed-120/picture-01-main.webp',
};
export default function EntryChoices({
  rows,
  selected = [],
  multiple = false,
  busy,
  onSelect,
  dispatch,
}: {
  rows: [string, string][];
  selected?: string[];
  multiple?: boolean;
  busy?: boolean;
  onSelect: (value: string) => void;
  dispatch: EntryDispatch;
}) {
  return (
    <div className="entry08-choices">
      {rows.map(([value, label]) => {
        const Icon = symbols[value as keyof typeof symbols];
        return (
          <div className="entry08-choice" key={value}>
            <button
              className={
                'entry08-pick' + (selected.includes(value) ? ' selected' : '')
              }
              disabled={busy}
              aria-pressed={multiple ? selected.includes(value) : undefined}
              onClick={() => onSelect(value)}
            >
              {pictures[value] ? (
                <img
                  className="entry08-interest-picture"
                  src={pictures[value]}
                  alt=""
                  width={96}
                  height={72}
                />
              ) : (
                Icon && (
                  <Icon className="entry08-choice-icon" aria-hidden="true" />
                )
              )}
              <span>{label}</span>
            </button>
            <button
              className="speak-button"
              aria-label={'Послушать: ' + label}
              onClick={() =>
                dispatch('option_audio', { id: value, text: label })
              }
            >
              <Volume2 size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
