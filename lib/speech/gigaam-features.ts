/** GigaAM v3 FeatureExtractor: 16 kHz, periodic Hann 320, hop 160, HTK 64, center=false.
 * Matches gigaam/preprocess.py and v3_ctc.yaml; the generic JS loader defaults differ.
 */
const size = 320,
  bins = 161,
  mels = 64;
const hann = Float32Array.from(
  { length: size },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
);
const cos = Array.from({ length: bins }, (_, k) =>
  Float32Array.from({ length: size }, (_, n) =>
    Math.cos((2 * Math.PI * k * n) / size),
  ),
);
const sin = Array.from({ length: bins }, (_, k) =>
  Float32Array.from({ length: size }, (_, n) =>
    Math.sin((2 * Math.PI * k * n) / size),
  ),
);
const high = 2595 * Math.log10(1 + 8000 / 700);
const points = Array.from(
  { length: mels + 2 },
  (_, i) => 700 * (10 ** ((high * i) / (mels + 1) / 2595) - 1),
);
const filters = Array.from({ length: mels }, (_, m) =>
  Float32Array.from({ length: bins }, (_, k) => {
    const hz = (k * 16000) / size;
    return Math.max(
      0,
      Math.min(
        (hz - points[m]) / (points[m + 1] - points[m]),
        (points[m + 2] - hz) / (points[m + 2] - points[m + 1]),
      ),
    );
  }),
);
export function gigaamFeatures(samples: Float32Array) {
  const frames = Math.max(1, 1 + Math.floor((samples.length - size) / 160));
  const features = new Float32Array(mels * frames);
  const frame = new Float32Array(size),
    power = new Float32Array(bins);
  for (let t = 0; t < frames; t++) {
    for (let n = 0; n < size; n++)
      frame[n] = (samples[t * 160 + n] ?? 0) * hann[n];
    for (let k = 0; k < bins; k++) {
      let re = 0,
        im = 0;
      for (let n = 0; n < size; n++) {
        re += frame[n] * cos[k][n];
        im -= frame[n] * sin[k][n];
      }
      power[k] = re * re + im * im;
    }
    for (let m = 0; m < mels; m++) {
      let energy = 0;
      for (let k = 0; k < bins; k++) energy += power[k] * filters[m][k];
      features[m * frames + t] = Math.log(
        Math.max(1e-9, Math.min(1e9, energy)),
      );
    }
  }
  return { features, frames };
}
