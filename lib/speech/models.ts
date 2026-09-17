export const speechModels = [
  { id: 'vosk', label: 'Vosk — текущая', mb: 45, engine: 'vosk' },
  {
    id: 'gigaam-ctc-int8',
    label: 'Сбер GigaAM v3 CTC — INT8',
    mb: 225,
    engine: 'gigaam',
  },
  {
    id: 'gigaam-ctc-fp32',
    label: 'Сбер GigaAM v3 CTC — FP32',
    mb: 885,
    engine: 'gigaam',
  },
  {
    id: 'gigaam-rnnt-int8',
    label: 'Сбер GigaAM v3 RNNT — INT8',
    mb: 226,
    engine: 'gigaam',
  },
  {
    id: 'zipformer-int8',
    label: 'Zipformer RU Streaming — INT8',
    mb: 29,
    engine: 'zipformer',
  },
  {
    id: 'zipformer-fp32',
    label: 'Zipformer RU Streaming — FP32',
    mb: 94,
    engine: 'zipformer',
  },
  {
    id: 'whisper-base-int8',
    label: 'Whisper Base — INT8, русский',
    mb: 77,
    engine: 'whisper',
  },
] as const;
export type SpeechModelId = (typeof speechModels)[number]['id'];
export type SpeechOptions = {
  speechModel?: SpeechModelId;
  micProcessing?: boolean;
};
export function parseSpeechModel(value: unknown): SpeechModelId {
  return speechModels.find((model) => model.id === value)?.id ?? 'vosk';
}
export function microphoneConstraints(
  deviceId?: string,
  processing = true,
): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: processing,
    noiseSuppression: processing,
    autoGainControl: processing,
    channelCount: 1,
  };
}
