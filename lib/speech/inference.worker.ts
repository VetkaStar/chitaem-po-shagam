import { modelFile } from './assets';
import type { SpeechModelId } from './models';
import type { AsrTranscriber } from 'onnx-asr-web';
import type { OnlineRecognizer, OnlineStream } from '@sherpaw/asr';
import { gigaamFeatures } from './gigaam-features';

type Request = {
  id: number;
  kind: 'load' | 'reset' | 'audio' | 'finish';
  model?: SpeechModelId;
  samples?: Float32Array;
  rate?: number;
};
let transcriber: AsrTranscriber | undefined;
let zip: OnlineRecognizer | undefined;
let stream: OnlineStream | undefined;
let streamRate = 16000;
let whisper: ((samples: Float32Array) => Promise<string>) | undefined;
let loaded: SpeechModelId | undefined;
const hf = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;
const decoder = new TextDecoder();
async function load(model: SpeechModelId, status: (message: string) => void) {
  if (model === loaded) return;
  if (model.startsWith('zipformer')) {
    const { initASRModule, createOnlineRecognizer } =
      await import('@sherpaw/asr');
    const module = await initASRModule();
    const int8 = model.endsWith('int8');
    const repo = `csukuangfj/sherpa-onnx-streaming-zipformer-small-ru-vosk-${int8 ? 'int8-' : ''}2025-08-16`;
    const files = [
      int8 ? 'encoder.int8.onnx' : 'encoder.onnx',
      'decoder.onnx',
      int8 ? 'joiner.int8.onnx' : 'joiner.onnx',
      'tokens.txt',
    ];
    for (const file of files) {
      const data = await modelFile(hf(repo, file), status);
      module.FS_createDataFile('/', file, data, true, false, true);
    }
    status('Подготавливаю Zipformer…');
    zip = createOnlineRecognizer(module, {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: '/' + files[0],
          decoder: '/' + files[1],
          joiner: '/' + files[2],
        },
        tokens: '/tokens.txt',
        numThreads: 1,
        provider: 'cpu',
        modelType: 'zipformer2',
        debug: 0,
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: 1,
      rule1MinTrailingSilence: 2.4,
      rule2MinTrailingSilence: 0.8,
      rule3MinUtteranceLength: 20,
    });
    if (!zip.handle)
      throw new Error('Не удалось создать распознаватель Zipformer.');
  } else if (model === 'whisper-base-int8') {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
    const pipe = await pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-base',
      {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (event: { status: string; progress?: number }) => {
          if (event.status === 'progress')
            status(`Загрузка Whisper: ${Math.round(event.progress ?? 0)}%`);
        },
      },
    );
    whisper = async (samples) => {
      const result = await pipe(samples, {
        language: 'russian',
        task: 'transcribe',
        return_timestamps: false,
      });
      return (Array.isArray(result) ? result[0] : result).text;
    };
  } else {
    const { createAsrModel, configureOrtWeb } = await import('onnx-asr-web');
    // Local bundled runtime, single thread also works without cross-origin isolation.
    configureOrtWeb({ numThreads: 1 });
    const repo = 'istupakov/gigaam-v3-onnx';
    const rnnt = model === 'gigaam-rnnt-int8';
    const suffix = model.endsWith('int8') ? '.int8.onnx' : '.onnx';
    const config = JSON.parse(
      decoder.decode(await modelFile(hf(repo, 'config.json'), status)),
    );
    const vocabularyText = decoder.decode(
      await modelFile(hf(repo, 'v3_vocab.txt'), status),
    );
    const names = rnnt
      ? ['v3_rnnt_encoder', 'v3_rnnt_decoder', 'v3_rnnt_joint']
      : ['v3_ctc'];
    const urls: string[] = [];
    try {
      for (const name of names) {
        const bytes = await modelFile(hf(repo, name + suffix), status);
        urls.push(URL.createObjectURL(new Blob([bytes as BlobPart])));
      }
      status('Подготавливаю GigaAM…');
      transcriber = await createAsrModel({
        modelType: 'gigaam',
        decoderKind: rnnt ? 'gigaam-rnnt' : 'ctc',
        config,
        vocabularyText,
        encoderModel: urls[0],
        decoderModel: urls[1],
        decoderJointModel: urls[2],
        sessionOptions: { executionProviders: ['wasm'] },
      });
      const { Tensor } = await import('onnxruntime-web');
      const prepare = (samples: Float32Array) => {
        const { features, frames } = gigaamFeatures(samples);
        return {
          signal: new Tensor('float32', features, [1, 64, frames]),
          length: new Tensor(
            'int64',
            BigInt64Array.from([BigInt(frames)]),
            [1],
          ),
        };
      };
      // v0.1.3 exposes these helpers; pinned dependency and real-model smoke tests guard this adapter.
      const implementation = transcriber as unknown as {
        encoder?: { prepareInputsFromWaveform: typeof prepare };
        encoderHelper?: { prepareInputsFromWaveform: typeof prepare };
      };
      const helper = rnnt
        ? implementation.encoderHelper
        : implementation.encoder;
      if (!helper) throw new Error('Несовместимый адаптер GigaAM.');
      helper.prepareInputsFromWaveform = prepare;
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url));
    }
  }
  loaded = model;
}

function resample(input: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return input;
  const ratio = rate / 16000;
  const out = new Float32Array(Math.floor(input.length / ratio));
  // Average source samples for downsampling; microphone normally supplies 44.1/48 kHz.
  for (let i = 0; i < out.length; i++) {
    const begin = Math.floor(i * ratio),
      end = Math.min(
        input.length,
        Math.max(begin + 1, Math.floor((i + 1) * ratio)),
      );
    let sum = 0;
    for (let j = begin; j < end; j++) sum += input[j];
    out[i] = sum / (end - begin);
  }
  return out;
}

async function handle(message: Request) {
  const { id, kind } = message;
  const status = (text: string) => self.postMessage({ id, status: text });
  if (kind === 'load') await load(message.model!, status);
  else if (kind === 'reset') {
    stream?.free();
    stream = zip?.createStream();
  } else if (zip) {
    stream ??= zip.createStream();
    if (kind === 'audio') {
      streamRate = message.rate!;
      stream.acceptWaveform(streamRate, message.samples!);
    } else {
      stream.acceptWaveform(
        streamRate,
        new Float32Array(Math.round(streamRate * 0.5)),
      );
      stream.inputFinished();
    }
    while (zip.isReady(stream)) zip.decode(stream);
    const result = zip.getResult(stream) as { text?: string };
    const final = kind === 'finish' || zip.isEndpoint(stream);
    self.postMessage({ id, result: { text: result.text ?? '', final } });
    if (final) {
      stream.free();
      stream = zip.createStream();
    }
  } else if (kind === 'audio') {
    const text = whisper
      ? await whisper(resample(message.samples!, message.rate!))
      : (await transcriber!.transcribeSamples(message.samples!, message.rate!))
          .text;
    self.postMessage({ id, result: { text, final: true } });
  }
  self.postMessage({ id, done: true });
}
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((error: unknown) => {
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      self.postMessage({
        id: event.data.id,
        error: detail || 'Ошибка движка распознавания.',
      });
    });
};
