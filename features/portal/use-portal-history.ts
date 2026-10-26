import { useEffect, useRef } from 'react';
import { activeProfileId } from '../../lib/progress/profile-storage';

type RouteState = { readingRoute: string; profileId: string };

/** Keep navigation local to this profile; restoring a route uses the normal media teardown. */
export function usePortalHistory(route: string, ready: boolean, restore: (route: string) => void) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const initialized = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const next: RouteState = { readingRoute: route, profileId: activeProfileId() };
    const current = window.history.state as RouteState | null;
    if (!initialized.current) {
      window.history.replaceState(next, '');
      initialized.current = true;
    } else if (current?.readingRoute !== route || current.profileId !== next.profileId) {
      window.history.pushState(next, '');
    }
  }, [route, ready]);
  useEffect(() => {
    const back = (event: PopStateEvent) => {
      const state = event.state as RouteState | null;
      if (typeof state?.readingRoute !== 'string') return;
      restoreRef.current(state.profileId === activeProfileId() ? state.readingRoute : 'home');
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
}
