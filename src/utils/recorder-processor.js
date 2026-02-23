class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this._buffer = new Float32Array(this.bufferSize);
    this._ptr = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      
      // We could send data back to main thread in chunks
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
