import type { SpeechCallbacks } from '../local-speech';
import { microphoneConstraints, parseSpeechModel } from './models';
import { SpeechSegments } from './segments';
import { claimWorker } from './worker-client';

export function startBrowserSpeech(callbacks: SpeechCallbacks) {
  const model = parseSpeechModel(callbacks.speechModel);
  const client = claimWorker(model);
  const streaming = model.startsWith('zipformer');
  let closed = false,
    enabled = true,
    ready = false,
    finishing = false,
    generation = 0;
  let context: AudioContext | undefined, stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined,
    node: ScriptProcessorNode | undefined;
  let analyser: AnalyserNode | undefined;
  let segments: SpeechSegments | undefined;
  let queued = 0,
    lastSound = 0,
    active = false,
    lastMeter = 0;
  let chain: Promise<void> = Promise.resolve();
  const abort = () => {
    if (closed) return;
    closed = true;
    generation++;
    if (node) {
      node.onaudioprocess = null;
      node.disconnect();
    }
    source?.disconnect();
    analyser?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed') void context.close();
    segments?.reset();
    client.release(!ready);
    callbacks.onLevel(0);
    callbacks.onSpectrum?.(Array(12).fill(0));
  };
  const fail = (error: unknown) => {
    if (closed) return;
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    abort();
    client.release(true);
    callbacks.onError(
      name === 'NotAllowedError'
        ? 'Разрешите микрофон для этого сайта.'
        : name === 'NotFoundError'
          ? 'Микрофон не найден.'
          : `Не удалось запустить распознавание: ${message}`,
      name === 'NotAllowedError' ? 'not-allowed' : 'service_unavailable',
    );
  };
  const submit = (kind: 'audio' | 'finish', samples?: Float32Array) => {
    const current = generation;
    const duration = (samples?.length ?? 0) / (context?.sampleRate ?? 16000);
    queued += duration;
    if (queued > 40) {
      fail(
        new Error('Модель не успевает обрабатывать звук на этом устройстве.'),
      );
      return;
    }
    const started = performance.now();
    const task = client.request(
      kind,
      (reply) => {
        if (closed || !enabled || current !== generation) return;
        if (reply.result?.text.trim()) {
          if (reply.result.final) {
            callbacks.onResult({
              text: reply.result.text.trim(),
              experimental: true,
              model,
              elapsedMs: performance.now() - started,
            });
          } else callbacks.onPartial(reply.result.text.trim());
        }
      },
      samples,
      context?.sampleRate,
    );
    chain = Promise.all([chain, task])
      .then(() => {
        queued -= duration;
      })
      .catch(fail);
  };
  const setEnabled = (value: boolean) => {
    if (closed || value === enabled) return;
    enabled = value;
    generation++;
    segments?.reset();
    active = false;
    if (ready) void client.request('reset').catch(fail);
  };
  void (async () => {
    try {
      context = new AudioContext();
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(
          callbacks.deviceId,
          callbacks.micProcessing,
        ),
        video: false,
      });
      if (closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      callbacks.onCaptureSettings?.(
        stream.getAudioTracks()[0]?.getSettings() ?? {},
      );
      callbacks.onStatus('Загружаю выбранную модель. Пока говорить не нужно.');
      await client.request('load', ({ status }) => {
        if (!closed && status) callbacks.onStatus(status);
      });
      if (closed) return;
      await client.request('reset');
      if (closed) return;
      ready = true;
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running')
        throw new Error('Браузер приостановил звук.');
      segments = new SpeechSegments(context.sampleRate);
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const frequency = new Uint8Array(analyser.frequencyBinCount);
      node = context.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = ({ inputBuffer }) => {
        if (closed || !enabled || finishing) return;
        const samples = new Float32Array(inputBuffer.getChannelData(0));
        let power = 0;
        for (const sample of samples) power += sample * sample;
        const level = Math.min(1, Math.sqrt(power / samples.length) * 8);
        const now = performance.now();
        if (now - lastMeter > 80) {
          callbacks.onLevel(level);
          analyser!.getByteFrequencyData(frequency);
          callbacks.onSpectrum?.(
            Array.from({ length: 12 }, (_, i) => {
              const first = Math.floor((i * frequency.length) / 24);
              const end = Math.max(
                first + 1,
                Math.floor(((i + 1) * frequency.length) / 24),
              );
              let sum = 0;
              for (let j = first; j < end; j++) sum += frequency[j];
              return sum / (end - first) / 255;
            }),
          );
          lastMeter = now;
        }
        if (level > 0.048) {
          lastSound = now;
          if (!active) {
            active = true;
            callbacks.onActivity?.('sound');
          }
        } else if (active && now - lastSound > 2500) {
          active = false;
          callbacks.onActivity?.('pause');
        }
        if (streaming) submit('audio', samples);
        else {
          const segment = segments!.push(samples);
          if (segment) submit('audio', segment);
        }
      };
      source.connect(node);
      node.connect(context.destination);
      callbacks.onReady();
    } catch (error) {
      fail(error);
    }
  })();
  const finish = async () => {
    if (closed || !ready || finishing) throw new Error('not-ready');
    finishing = true;
    if (streaming) submit('finish');
    else {
      const segment = segments?.finish();
      if (segment) submit('audio', segment);
    }
    await chain;
    if (closed) throw new Error('ABORTED');
    abort();
  };
  return { abort, setEnabled, finish };
}
