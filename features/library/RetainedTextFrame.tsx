import { createPortal } from 'react-dom';
import { freeMaterialReady } from '../free-practice/material-ready';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

export const TextSaveNoticeContext = createContext<HTMLElement | null>(null);

/** Only a successfully recorded snapshot may be retained during another save. */
export default function RetainedTextFrame({
  ready,
  blocker,
  children,
  className = '',
}: {
  ready: boolean;
  blocker: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const saved = useRef<ReactNode>(null);
  const noticeTarget = useContext(TextSaveNoticeContext);
  const notice = (
    <div
      className={
        'retained-text-notice' + (saved.current === null ? ' is-initial' : '')
      }
    >
      {blocker}
    </div>
  );
  useLayoutEffect(() => {
    if (ready) saved.current = children;
  }, [ready, children]);
  useLayoutEffect(() => {
    const root = content.current;
    if (!root || ready) return;
    const blocked: HTMLElement[] = [];
    const block = (node: HTMLElement) => {
      if (node === noticeTarget) return;
      if (noticeTarget && node.contains(noticeTarget)) {
        Array.from(node.children).forEach((child) =>
          block(child as HTMLElement),
        );
      } else if (!node.inert) {
        node.inert = true;
        blocked.push(node);
      }
    };
    block(root);
    return () =>
      blocked.forEach((node) => {
        node.inert =
          node.classList.contains('text-task-controls') && !freeMaterialReady();
      });
  }, [ready, noticeTarget]);
  return (
    <div
      className={`retained-text-frame free-material ${className}`}
      aria-busy={!ready}
    >
      <div
        className="retained-text-content free-material-content"
        ref={content}
      >
        {ready ? children : saved.current}
      </div>
      {!ready && (noticeTarget ? createPortal(notice, noticeTarget) : notice)}
    </div>
  );
}
