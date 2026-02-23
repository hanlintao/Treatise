export class AudioRecorder {
  constructor() {
    this.mediaStream = null;
    this.audioContext = null;
    this.workletNode = null;
    this.buffers = [];
    this.recordedLength = 0;
  }

  async start() {
    this.buffers = [];
    this.recordedLength = 0;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      
      // Load AudioWorklet
      const workletUrl = new URL('./recorder-processor.js', import.meta.url);
      await this.audioContext.audioWorklet.addModule(workletUrl);
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'recorder-processor');

      this.workletNode.port.onmessage = (e) => {
        const inputBuffer = e.data;
        const buffer = new Float32Array(inputBuffer);
        this.buffers.push(buffer);
        this.recordedLength += buffer.length;
      };

      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch (e) {
      console.error('Recording start error:', e);
      throw e;
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      
      let finalBuffer = null;
      let currentSampleRate = this.audioContext ? this.audioContext.sampleRate : 16000;

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      // Merge buffers
      const result = new Float32Array(this.recordedLength);
      let offset = 0;
      for (const buffer of this.buffers) {
        result.set(buffer, offset);
        offset += buffer.length;
      }
      
      // Resample if necessary
      if (currentSampleRate !== 16000) {
        console.log(`Resampling from ${currentSampleRate} to 16000`);
        finalBuffer = this.downsampleBuffer(result, currentSampleRate, 16000);
      } else {
        finalBuffer = result;
      }

      // Convert to 16-bit PCM WAV
      console.log(`Final buffer length: ${finalBuffer.length} samples`);
      const wavBuffer = this.encodeWAV(finalBuffer, 16000);
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      resolve(audioBlob);
    });
  }

  downsampleBuffer(buffer, sampleRate, outSampleRate) {
      if (outSampleRate === sampleRate) {
          return buffer;
      }
      if (outSampleRate > sampleRate) {
          // Upsampling not supported in this simple implementation
          return buffer;
      }
      var sampleRateRatio = sampleRate / outSampleRate;
      var newLength = Math.round(buffer.length / sampleRateRatio);
      var result = new Float32Array(newLength);
      var offsetResult = 0;
      var offsetBuffer = 0;
      while (offsetResult < result.length) {
          var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
          var accum = 0, count = 0;
          for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
              accum += buffer[i];
              count++;
          }
          result[offsetResult] = accum / count;
          offsetResult++;
          offsetBuffer = nextOffsetBuffer;
      }
      return result;
  }

  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    this.writeString(view, 8, 'WAVE');
    // format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    this.writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length * 2, true);

    this.floatTo16BitPCM(view, 44, samples);

    return view;
  }

  floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}