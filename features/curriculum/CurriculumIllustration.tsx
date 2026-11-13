import { illustrations } from '../../content/illustrations';
import { nextStoryFrames } from '../../content/next-illustrations';
import { illustrationSources } from '../../content/illustration-sources';
import type { TaskPresentation } from './presentation.js';

interface Props {
  asset: NonNullable<TaskPresentation['illustration']>;
  busy: boolean;
  onVariant: (variant: 'main' | 'alternate' | 'context') => void;
}
export function CurriculumIllustration({ asset, busy, onVariant }: Props) {
  const word =
    asset.kind === 'word'
      ? illustrations[asset.id as keyof typeof illustrations]
      : null;
  const frames = word
    ? [word.variants[asset.variant]]
    : (nextStoryFrames[asset.id as keyof typeof nextStoryFrames] ?? []);
  return (
    <section
      className="curriculum-illustration"
      aria-label="Иллюстрация-подсказка"
    >
      <div className="curriculum-illustration-frames">
        {frames.map((frame) => (
          <img
            key={frame.src}
            src={frame.src}
            srcSet={illustrationSources[frame.src]}
            sizes={
              word
                ? '(max-width: 390px) 80vw, 320px'
                : '(max-width: 600px) 85vw, 560px'
            }
            width={frame.width}
            height={frame.height}
            alt={frame.alt}
          />
        ))}
      </div>
      {word && (
        <div className="curriculum-actions">
          {(['main', 'alternate', 'context'] as const).map((variant, index) => (
            <button
              key={variant}
              type="button"
              disabled={busy}
              aria-pressed={asset.variant === variant}
              onClick={() => onVariant(variant)}
            >
              {['Основная картинка', 'Другой пример', 'В жизни'][index]}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
