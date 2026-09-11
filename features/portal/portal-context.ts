import { createContext } from 'react';

/** Navigation that screens inside the portal may need, such as «Все разделы» in the focus bar. */
export const PortalContext = createContext<{ home: () => void }>({
  home: () => {},
});
