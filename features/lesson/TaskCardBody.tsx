import type { ComponentProps } from 'react';

// A named scroll region needs a tab stop for keyboard scrolling when its
// content has no focusable controls. Keep this exception on this element only.
export default function TaskCardBody(props: ComponentProps<'div'>) {
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div {...props} role="region" tabIndex={0} />
  );
}
