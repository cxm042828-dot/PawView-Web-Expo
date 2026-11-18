class PawViewSoundCapture extends AudioWorkletProcessor {
  constructor() {
    super();

    this.samples = new Float32Array(sampleRate);
    this.position = 0;
  }

  process(inputs) {
    const channels = inputs[0];

    if (!channels || channels.length === 0) return true;

    const frameLength = channels[0].length;

    for (let i = 0; i < frameLength; i += 1) {
      let value = 0;

      for (let channel = 0; channel < channels.length; channel += 1) {
        value += channels[channel][i] || 0;
      }

      this.samples[this.position] = value / channels.length;
      this.position += 1;

      if (this.position === this.samples.length) {
        this.port.postMessage(
          this.samples,
          [this.samples.buffer]
        );

        this.samples = new Float32Array(sampleRate);
        this.position = 0;
      }
    }

    return true;
  }
}

registerProcessor("pawview-sound-capture", PawViewSoundCapture);
