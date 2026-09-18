export type CtcOutput = {
  encodedData: ArrayLike<number | bigint>;
  encodedDims: readonly number[];
  encodedLayout: string;
  encodedLength: number;
};
/** Minimum of peak posterior for each emitted CTC token. Not calibrated correctness. */
export function ctcScore(output: CtcOutput, blank: number): number | undefined {
  const { encodedData: data, encodedDims: dims, encodedLayout: layout } = output;
  if (dims.length !== 3 || !['BTV', 'BVT'].includes(layout)) return;
  const time = layout === 'BVT' ? dims[2] : dims[1];
  const vocab = layout === 'BVT' ? dims[1] : dims[2];
  if (!time || !vocab || data.length !== time * vocab || blank < 0 || blank >= vocab) return;
  let previous = blank, peak = 0;
  const peaks: number[] = [];
  for (let t = 0; t < Math.min(time, output.encodedLength); t++) {
    const value = (v: number) => Number(data[layout === 'BVT' ? v * time + t : t * vocab + v]);
    let best = 0, max = -Infinity;
    for (let v = 0; v < vocab; v++) {
      const x = value(v);
      if (!Number.isFinite(x)) return;
      if (x > max) { max = x; best = v; }
    }
    let sum = 0;
    for (let v = 0; v < vocab; v++) sum += Math.exp(value(v) - max);
    if (best !== previous) {
      if (previous !== blank) peaks.push(peak);
      peak = 0;
    }
    if (best !== blank) peak = Math.max(peak, 1 / sum);
    previous = best;
  }
  if (previous !== blank) peaks.push(peak);
  return peaks.length ? Math.min(...peaks) : undefined;
}
export function belowSpeechThreshold(score: number | undefined, threshold = 0) {
  return threshold > 0 && (score === undefined || !Number.isFinite(score) || score * 100 < threshold);
}
