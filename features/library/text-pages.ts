export type TextFragment = { line: number; start: number; end: number };
/** Visual pages preserve offsets and never mutate the logical exercise lines. */
export function paginateText(
  lines: string[],
  available: number,
  measure: (line: number, start: number, end: number) => number,
): TextFragment[][] {
  const pages: TextFragment[][] = [];
  let page: TextFragment[] = [],
    used = 0;
  const height = Math.max(1, available);
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };
  lines.forEach((text, line) => {
    const boundaries = [...text.matchAll(/\S+\s*/gu)].map(
      (match) => match.index! + match[0].length,
    );
    if (!boundaries.length) boundaries.push(text.length);
    let start = 0,
      from = 0;
    while (from < boundaries.length) {
      let lo = from,
        hi = boundaries.length - 1,
        fit = -1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (measure(line, start, boundaries[mid]) <= height - used) {
          fit = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (fit < 0 && page.length) {
        flush();
        continue;
      }
      // A single unbreakable token is still present; CSS wraps it at any character.
      if (fit < 0) fit = from;
      const end = boundaries[fit];
      page.push({ line, start, end });
      used += measure(line, start, end);
      start = end;
      from = fit + 1;
      if (from < boundaries.length) flush();
    }
  });
  flush();
  return pages;
}
