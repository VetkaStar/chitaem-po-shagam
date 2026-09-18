import { combineFinals, type FinalCandidate } from './combined-result';
import type { SpeechCallbacks } from '../local-speech';
import {
  microphoneConstraints,
  parseSpeechModel,
  verificationModel,
} from './models';
import { SpeechSegments } from './segments';
import { claimWorker } from './worker-client';

export function startBrowserSpeech(callbacks: SpeechCallbacks) {
  const selected = parseSpeechModel(callbacks.speechModel);
  const model = verificationModel(selected);
  const preview = selected.startsWith('combined:')
    ? claimWorker('zipformer-int8', 'preview')
    : undefined;
  let previewChain: Promise<void> = Promise.resolve();
  let previewQueued = 0,
    segmentId = 0,
    confirmedSegment = -1;
  const previewParts = new Map<number, { prefix: string; text: string }>();
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
  let delivery: Promise<void> = Promise.resolve();
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
    preview?.release(true);
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
  const submitPreview = (samples: Float32Array) => {
    if (!preview) return;
    const current = generation,
      part = segmentId;
    const duration = samples.length / (context?.sampleRate ?? 16000);
    previewQueued += duration;
    if (previewQueued > 10) {
      fail(
        new Error(
          'Совместный режим не успевает обрабатывать звук. Выберите одну модель.',
        ),
      );
      return;
    }
    const task = preview.request(
      'audio',
      (reply) => {
        if (
          closed ||
          !enabled ||
          current !== generation ||
          part <= confirmedSegment
        )
          return;
        if (reply.result?.text.trim()) {
          const text = reply.result.text.trim();
          const previous = previewParts.get(part)?.prefix ?? '';
          const combined = (previous + ' ' + text).trim();
          previewParts.set(part, {
            prefix: reply.result.final ? combined : previous,
            text: combined,
          });
          callbacks.onPartial(
            [...previewParts]
              .filter(([id]) => id > confirmedSegment)
              .sort(([a], [b]) => a - b)
              .map(([, value]) => value.text)
              .join(' '),
          );
        }
      },
      samples,
      context?.sampleRate,
    );
    previewChain = Promise.all([previewChain, task])
      .then(() => {
        previewQueued -= duration;
      })
      .catch(fail);
  };
  const submit = (kind: 'audio' | 'finish', samples?: Float32Array) => {
    const current = generation,
      part = segmentId;
    const duration = (samples?.length ?? 0) / (context?.sampleRate ?? 16000);
    queued += duration;
    if (queued > 40) {
      fail(
        new Error('Модель не успевает обрабатывать звук на этом устройстве.'),
      );
      return;
    }
    const started = performance.now();
    if (preview && samples) callbacks.onStatus('Проверяю услышанное…');
    let primary: FinalCandidate = {text:'', model};
    let fastText = '';
    const fastFinish = preview && samples ? preview.request('finish', reply => {
      if (closed || current !== generation) return;
      if (reply.result?.final) fastText = ((previewParts.get(part)?.prefix ?? '') + ' ' + reply.result.text).trim();
    }) : Promise.resolve();
    const task = client.request(
      kind,
      (reply) => {
        if (closed || !enabled || current !== generation) return;
        if (reply.result?.final && !preview) {
          confirmedSegment = Math.max(confirmedSegment, part);
          for (const id of previewParts.keys())
            if (id <= confirmedSegment) previewParts.delete(id);
        }
        if (reply.result && (reply.result.final || reply.result.text.trim())) {
          if (reply.result.final) {
            if (preview) { primary = {text:reply.result.text.trim(), model, confidenceScore:reply.result.confidenceScore}; return; }
            callbacks.onResult({
              text: reply.result.text.trim(),
              experimental: true,
              confidenceScore: reply.result.confidenceScore,
              model,
              elapsedMs: performance.now() - started,
            });
          } else if (!preview) callbacks.onPartial(reply.result.text.trim());
        }
      },
      samples,
      context?.sampleRate,
    );
    if (preview) {
      const ready = Promise.all([task, fastFinish]);
      // Attach rejection immediately; deliver segments in capture order.
      const settled = ready.then(() => true, error => { fail(error); return false; });
      delivery = delivery.then(async () => {
        if (!await settled || closed || !enabled || current !== generation) return;
        confirmedSegment = Math.max(confirmedSegment, part);
        for (const id of previewParts.keys()) if (id <= confirmedSegment) previewParts.delete(id);
        callbacks.onResult({...combineFinals(primary, {text:fastText, model:'zipformer-int8'}, callbacks.speechConfidenceThreshold),
          experimental:true, elapsedMs:performance.now()-started});
      }).catch(fail);
    }
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
    previewParts.clear();
    segmentId++;
    if (ready) {
      void client.request('reset').catch(fail);
      void preview?.request('reset').catch(fail);
    }
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
      await Promise.all([
        preview?.request('load', ({ status }) => {
          if (!closed && status) callbacks.onStatus('Подсветка: ' + status);
        }),
        client.request('load', ({ status }) => {
          if (!closed && status) callbacks.onStatus(status);
        }),
      ]);
      if (closed) return;
      await Promise.all([client.request('reset'), preview?.request('reset')]);
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
        if (preview) submitPreview(new Float32Array(samples));
        if (streaming) submit('audio', samples);
        else {
          const segment = segments!.push(samples);
          if (segment) {
            submit('audio', segment);
            segmentId++;
            // Reset the fast stream on the same boundary used by the verifier.
            if (preview) {
              void preview.request('reset').catch(fail);
            }
          }
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
    await Promise.all([chain, previewChain, delivery]);
    if (closed) throw new Error('ABORTED');
    abort();
  };
  return { abort, setEnabled, finish };
}
