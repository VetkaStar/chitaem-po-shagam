/** Sample-time endpointing: includes pre-roll and trailing silence, never uses the target text. */
export class SpeechSegments {
  private blocks: Float32Array[] = [];
  private lead: Float32Array[] = [];
  private length = 0;
  private silence = 0;
  private voiced = 0;
  constructor(private rate: number) {}
  reset() {
    this.blocks = [];
    this.lead = [];
    this.length = this.silence = this.voiced = 0;
  }
  push(block: Float32Array): Float32Array | null {
    let power = 0;
    for (const sample of block) power += sample * sample;
    const sound = Math.sqrt(power / block.length) > 0.006;
    if (!this.blocks.length && !sound) {
      this.lead.push(block);
      while (this.lead.length > Math.ceil((this.rate * 0.2) / block.length))
        this.lead.shift();
      return null;
    }
    if (!this.blocks.length) {
      this.blocks = this.lead;
      this.lead = [];
      this.length = this.blocks.reduce((sum, b) => sum + b.length, 0);
    }
    this.blocks.push(block);
    this.length += block.length;
    if (sound) {
      this.voiced += block.length;
      this.silence = 0;
    } else this.silence += block.length;
    if (this.silence >= this.rate * 0.8 || this.length >= this.rate * 20)
      return this.finish();
    return null;
  }
  finish(): Float32Array | null {
    // Reject tiny clicks and pure silence, but retain short syllables.
    if (this.voiced < this.rate * 0.08) {
      this.reset();
      return null;
    }
    const samples = new Float32Array(this.length);
    let offset = 0;
    for (const block of this.blocks) {
      samples.set(block, offset);
      offset += block.length;
    }
    this.reset();
    return samples;
  }
}
