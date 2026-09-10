import { useEffect } from 'react';
import { illustrations, type IllustrationId } from '@/content/illustrations';
import { illustrationSources } from '@/content/illustration-sources';
export const illustrationSizes = (id: string) =>
  id.startsWith('scene-')
    ? '(max-width: 650px) calc(100vw - 100px), 560px'
    : '(max-width: 420px) calc(100vw - 100px), 320px';
export function useIllustrationPreload(id?: IllustrationId) {
  useEffect(() => {
    if (!id || typeof Image === 'undefined') return;
    const images = Object.values(illustrations[id].variants).map((p) => {
      const img = new Image();
      img.sizes = illustrationSizes(id);
      img.srcset = illustrationSources[p.src];
      img.src = p.src + '?v=2';
      return img;
    });
    return () => {
      images.forEach((i) => {
        i.onload = null;
      });
    };
  }, [id]);
}
