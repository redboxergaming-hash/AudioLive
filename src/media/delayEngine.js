import { formatSeconds } from '../utils/time.js';

export class DelayEngine {
  constructor({ diagnostics, onStateChange }) {
    this.diagnostics = diagnostics;
    this.onStateChange = onStateChange;
    this.audioContext = null;
    this.sourceNode = null;
    this.delayNode = null;
    this.gainNode = null;
    this.monitorNode = null;
    this.analyserNode = null;
    this.bufferInterval = null;
    this.startEpoch = 0;
    this.currentDelaySeconds = 0;
    this.currentSource = null;
    this.currentStrategy = 'none';
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextCtor();
    }

    if (!this.analyserNode) {
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
    }

    if (!this.gainNode) {
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    if (!this.monitorNode) {
      this.monitorNode = this.audioContext.createGain();
      this.monitorNode.gain.value = 0;
    }

    return this.audioContext;
  }

  async prepareFromMediaElement(mediaElement, strategy, delaySeconds) {
    this.stop();
    const audioContext = this.ensureAudioContext();
    await audioContext.resume();

    this.currentDelaySeconds = delaySeconds;
    this.currentSource = mediaElement;
    this.currentStrategy = strategy;

    this.sourceNode = audioContext.createMediaElementSource(mediaElement);
    this.delayNode = audioContext.createDelay(120);
    this.delayNode.delayTime.value = delaySeconds;

    this.sourceNode.connect(this.monitorNode);
    this.monitorNode.connect(this.analyserNode);
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);

    this.startEpoch = performance.now();
    this.startMonitoring();

    this.onStateChange({
      engineStatus: 'buffering',
      secondsBuffered: 0,
      ready: false,
      message: `Buffering delayed audio path to ${formatSeconds(delaySeconds)}.`
    });
    this.diagnostics.add('info', 'Delay engine prepared', { strategy, delaySeconds });
  }


  async prepareFromMediaStream(mediaStream, strategy, delaySeconds) {
    this.stop();
    const audioContext = this.ensureAudioContext();
    await audioContext.resume();

    this.currentDelaySeconds = delaySeconds;
    this.currentSource = mediaStream;
    this.currentStrategy = strategy;

    this.sourceNode = audioContext.createMediaStreamSource(mediaStream);
    this.delayNode = audioContext.createDelay(120);
    this.delayNode.delayTime.value = delaySeconds;

    this.sourceNode.connect(this.monitorNode);
    this.monitorNode.connect(this.analyserNode);
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);

    this.startEpoch = performance.now();
    this.startMonitoring();

    this.onStateChange({
      engineStatus: 'buffering',
      secondsBuffered: 0,
      ready: false,
      message: `Buffering delayed audio path to ${formatSeconds(delaySeconds)}.`
    });
    this.diagnostics.add('info', 'Delay engine prepared from MediaStream', { strategy, delaySeconds });
  }

  startMonitoring() {
    clearInterval(this.bufferInterval);
    this.bufferInterval = window.setInterval(() => {
      const elapsed = (performance.now() - this.startEpoch) / 1000;
      const secondsBuffered = Math.min(elapsed, this.currentDelaySeconds);
      const ready = elapsed >= this.currentDelaySeconds;
      this.onStateChange({
        engineStatus: ready ? 'playing-delayed' : 'buffering',
        secondsBuffered,
        ready,
        message: ready
          ? `Delayed playback running at ${formatSeconds(this.currentDelaySeconds)} behind live.`
          : `Buffering ${formatSeconds(secondsBuffered)} / ${formatSeconds(this.currentDelaySeconds)}.`
      });
    }, 250);
  }

  setDelay(delaySeconds) {
    this.currentDelaySeconds = delaySeconds;
    if (this.delayNode) {
      this.delayNode.delayTime.setValueAtTime(delaySeconds, this.audioContext.currentTime);
    }
    this.startEpoch = performance.now();
    this.diagnostics.add('info', 'Delay adjusted', { delaySeconds });
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  setMuted(muted, previousVolume = 1) {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : previousVolume;
    }
  }

  stop() {
    clearInterval(this.bufferInterval);
    this.bufferInterval = null;

    [this.sourceNode, this.delayNode, this.monitorNode].forEach((node) => {
      try {
        node?.disconnect();
      } catch {
        // No-op cleanup.
      }
    });

    this.sourceNode = null;
    this.delayNode = null;
    this.startEpoch = 0;
    this.currentSource = null;
    this.currentStrategy = 'none';

    this.onStateChange({
      engineStatus: 'idle',
      secondsBuffered: 0,
      ready: false,
      message: 'Delayed playback stopped.'
    });
  }
}
