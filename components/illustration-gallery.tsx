'use client';
import { useState } from 'react';
import {
  illustrations,
  type IllustrationId,
  type IllustrationVariant,
} from '@/content/illustrations';
import './illustration-gallery.css';

const variants: IllustrationVariant[] = ['main', 'alternate', 'context'];

/** One fixed-size frame for all variants; context can also be requested by answer help. */
export default function IllustrationGallery({
  assetId,
  concealAnswer = false,
  context = false,
  onContextChange,
}: {
  assetId: IllustrationId;
  concealAnswer?: boolean;
  context?: boolean;
  onContextChange?: (value: boolean) => void;
}) {
  const [selected, setSelected] = useState<IllustrationVariant>('main');
  const variant = context ? 'context' : selected;
  const item = illustrations[assetId];
  const picture = item.variants[variant];
  const index = variants.indexOf(variant);
  return (
    <div
      className={
        'illustration-gallery' +
        (assetId.startsWith('scene-') ? ' illustration-landscape' : '')
      }
    >
      <img
        className="reviewed-illustration"
        src={picture.src}
        alt={concealAnswer ? 'Картинка предмета для задания' : picture.alt}
        width={picture.width}
        height={picture.height}
        loading="lazy"
        decoding="async"
      />
      <div className="illustration-navigation">
        <span className="illustration-position" aria-live="polite">
          Картинка {index + 1} из 3
          {variant === 'context' ? ' · в окружении' : ''}
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const next = variants[(index + 1) % variants.length];
            setSelected(next);
            onContextChange?.(next === 'context');
          }}
        >
          Посмотреть другую картинку
        </button>
      </div>
    </div>
  );
}
