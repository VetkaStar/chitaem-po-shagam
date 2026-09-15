import type { ReactNode } from 'react';
/** Retain child state and layout while new material is invisible and inert. */
export function FreeExposureFrame({
  ready,
  blocker,
  children,
}: {
  ready: boolean;
  blocker: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={'free-material' + (ready ? '' : ' is-pending')}
      aria-busy={!ready}
    >
      <div className="free-material-content" inert={!ready}>
        {children}
      </div>
      {!ready && <div className="free-material-notice">{blocker}</div>}
    </div>
  );
}
