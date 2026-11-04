import { Volume2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import TaskCardBody from '../lesson/TaskCardBody';
import { useFreeExposure } from '../free-practice/use-free-exposure';
import RetainedTextFrame from './RetainedTextFrame';
import { paginateText, type TextFragment } from './text-pages';

export default function TextReadingViewport({
  lines,
  activeLine,
  activeOffset,
  fontSize,
  sound,
  presentation,
  fullText,
  enabled,
  prompted,
  progressKey,
  renderLine,
  onTargetReady,
  onVisibleTexts,
  targetKey,
}: {
  lines: string[];
  activeLine: number;
  activeOffset: number;
  fontSize: number;
  sound: boolean;
  presentation: 'scroll' | 'pages';
  fullText: boolean;
  enabled: boolean;
  prompted: number[];
  progressKey: string;
  targetKey: string;
  renderLine: (index: number, start: number, end: number) => ReactNode;
  onTargetReady: (key: string) => void;
  onVisibleTexts: (value: { key: string; texts: string[] }) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<TextFragment[][]>([]),
    [page, setPage] = useState(0);
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    const box = viewport.current,
      content = measure.current;
    if (!box || !content || !enabled) return;
    const update = () => {
      const node = content.firstElementChild as HTMLElement;
      const span = node.lastElementChild as HTMLElement;
      const next = paginateText(
        lines,
        box.clientHeight - 4,
        (line, start, end) => {
          span.textContent = lines[line].slice(start, end);
          return node.offsetHeight;
        },
      );
      const visible = fullText
        ? next
        : next
            .map((page) => page.filter((f) => f.line === activeLine))
            .filter((page) => page.length);
      setPages((previous) =>
        JSON.stringify(previous) === JSON.stringify(visible)
          ? previous
          : visible,
      );
      setMeasured(true);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [lines, fontSize, sound, fullText, presentation, activeLine, enabled]);
  useLayoutEffect(() => {
    setPage(
      Math.max(
        0,
        pages.findIndex((fragments) =>
          fragments.some(
            (f) =>
              f.line === activeLine &&
              f.start <= activeOffset &&
              (activeOffset < f.end || f.end === lines[activeLine].length),
          ),
        ),
      ),
    );
  }, [activeLine, activeOffset, pages, presentation, lines]);
  const fragments =
    presentation === 'scroll'
      ? lines.flatMap((text, line) =>
          fullText || line === activeLine
            ? [{ line, start: 0, end: text.length }]
            : [],
        )
      : (pages[Math.min(page, pages.length - 1)]?.filter(
          (f) => fullText || f.line === activeLine,
        ) ?? []);
  const exposure = useFreeExposure(
    enabled && measured
      ? {
          texts: [
            ...fragments.map((f) => lines[f.line].slice(f.start, f.end)),
            ...(fragments.length === lines.length &&
            fragments.every(
              (f, i) =>
                f.line === i && f.start === 0 && f.end === lines[i].length,
            )
              ? [lines.join('\n')]
              : []),
          ],
          promptedTexts: fragments
            .filter((f) => prompted.includes(f.line))
            .map((f) => lines[f.line].slice(f.start, f.end)),
        }
      : {},
  );
  const ready = enabled && measured && exposure.ready;
  const visibleKey = JSON.stringify(
    fragments.map((f) => lines[f.line].slice(f.start, f.end)),
  );
  useLayoutEffect(() => {
    if (ready)
      onVisibleTexts({ key: targetKey, texts: JSON.parse(visibleKey) });
  }, [ready, visibleKey, targetKey, onVisibleTexts]);
  const targetVisible = fragments.some(
    (f) =>
      f.line === activeLine && f.start <= activeOffset && activeOffset < f.end,
  );
  useLayoutEffect(() => {
    onTargetReady(ready && targetVisible ? targetKey : '');
  }, [ready, targetVisible, targetKey, onTargetReady]);
  useLayoutEffect(() => {
    if (!ready || presentation === 'pages') return;
    const node =
      viewport.current?.querySelector('.active-line [aria-current="step"]') ??
      viewport.current?.querySelector('.active-line');
    const box = viewport.current;
    if (box && node) {
      const a = node.getBoundingClientRect(),
        b = box.getBoundingClientRect();
      const scale = b.height / box.offsetHeight || 1;
      if (a.top < b.top) box.scrollTop += (a.top - b.top) / scale;
      else if (a.bottom > b.bottom)
        box.scrollTop += (a.bottom - b.bottom) / scale;
    }
  }, [ready, activeLine, progressKey, fontSize, presentation]);
  if (!enabled) return null;
  return (
    <div
      className="text-reading-viewport"
      data-text-font-size={fontSize}
      data-presentation={presentation}
      data-active-source={activeOffset}
      data-active-line={activeLine}
    >
      <TaskCardBody
        ref={viewport}
        className="text-reading-scroll"
        aria-label="Текст для чтения"
      >
        <RetainedTextFrame ready={ready} blocker={exposure.blocker}>
          <div className="full-reading-text">
            {fragments.map((f) => renderLine(f.line, f.start, f.end))}
          </div>
        </RetainedTextFrame>
        <div
          ref={measure}
          className="text-reading-measure"
          aria-hidden="true"
          inert
        >
          <div className="full-text-line">
            {sound && (
              <button type="button" className="quiet" tabIndex={-1}>
                <Volume2 size={18} />
              </button>
            )}
            <span className="reading-guide" />
          </div>
        </div>
      </TaskCardBody>
      {presentation === 'pages' && (
        <nav className="text-page-controls" aria-label="Страницы текста">
          <button
            aria-label="Предыдущая страница"
            disabled={!ready || page === 0}
            onClick={() => setPage((n) => n - 1)}
          >
            ←
          </button>
          <span>
            Страница {page + 1} из {Math.max(1, pages.length)}
          </span>
          <button
            aria-label="Следующая страница"
            disabled={!ready || page >= pages.length - 1}
            onClick={() => setPage((n) => n + 1)}
          >
            →
          </button>
        </nav>
      )}
    </div>
  );
}
