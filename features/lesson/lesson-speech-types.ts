/** Both the lesson recognizer and the microphone test can be stopped. */
export type SpeechController = {
  abort(): void;
  setEnabled?(enabled: boolean): void;
};
