import { getErrorMessage } from '../utils/errors.js';
import { detectMediaElements } from './mediaDetector.js';
import { resolveStrategy } from './strategyResolver.js';
import { captureFromMediaElement } from './mediaAccess.js';

export class PlaybackController {
  constructor({ store, diagnostics, delayEngine, iframe }) {
    this.store = store;
    this.diagnostics = diagnostics;
    this.delayEngine = delayEngine;
    this.iframe = iframe;
    this.detectedMedia = null;
  }

  inspectFrame() {
    const state = this.store.getState();
    if (!this.iframe.src) {
      throw new Error('No stream page is currently loaded.');
    }

    let doc;
    try {
      doc = this.iframe.contentWindow?.document;
      void doc?.body;
    } catch (error) {
      this.store.setState((current) => ({
        ...current,
        frame: {
          ...current.frame,
          accessible: false,
          blockedReason: 'Cross-origin or sandbox restrictions prevent access.'
        }
      }));
      throw error;
    }

    const mediaResult = detectMediaElements(doc);
    const support = {
      ...state.support,
      captureStream: Boolean(mediaResult.best?.element?.captureStream || mediaResult.best?.element?.mozCaptureStream)
    };

    const strategyDecision = resolveStrategy({
      frameAccessible: true,
      mediaResult,
      support
    });

    this.detectedMedia = mediaResult.best?.element ?? null;

    this.store.setState((current) => ({
      ...current,
      support,
      strategy: strategyDecision.strategy,
      frame: {
        ...current.frame,
        accessible: true,
        blockedReason: 'Accessible same-origin document.'
      },
      media: {
        found: Boolean(mediaResult.best),
        type: mediaResult.best?.type ?? 'unknown',
        candidates: mediaResult.candidates.length,
        status: mediaResult.best ? 'detected' : 'not-found',
        details: strategyDecision.reason,
        captureMethod: strategyDecision.strategy
      },
      mode: mediaResult.best ? 'media-detected' : 'unsupported'
    }));

    this.diagnostics.snapshot('Media detection result', {
      candidates: mediaResult.candidates.map((candidate) => ({
        type: candidate.type,
        score: candidate.score,
        paused: candidate.paused,
        currentTime: candidate.currentTime,
        src: candidate.src
      })),
      strategyDecision
    });

    return { mediaResult, strategyDecision };
  }

  async startDelayedPlayback() {
    try {
      const { strategyDecision } = this.inspectFrame();
      if (!this.detectedMedia) {
        throw new Error('No playable media element was detected.');
      }
      if (strategyDecision.strategy === 'unsupported') {
        throw new Error(strategyDecision.reason);
      }

      const { selectedDelaySeconds } = this.store.getState();
      if (strategyDecision.strategy === 'capture-stream') {
        const stream = captureFromMediaElement(this.detectedMedia);
        await this.delayEngine.prepareFromMediaStream(stream, strategyDecision.strategy, selectedDelaySeconds);
      } else {
        await this.delayEngine.prepareFromMediaElement(this.detectedMedia, strategyDecision.strategy, selectedDelaySeconds);
      }

      this.store.setState((state) => ({
        ...state,
        activeDelaySeconds: selectedDelaySeconds,
        mode: 'buffering',
        playback: {
          ...state.playback,
          status: 'buffering'
        }
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      this.diagnostics.add('error', 'Unable to start delayed playback', { message });
      this.store.setState((state) => ({
        ...state,
        mode: 'error',
        errors: [message, ...state.errors].slice(0, 10),
        playback: {
          ...state.playback,
          status: 'error'
        }
      }));
      throw error;
    }
  }

  stopDelayedPlayback() {
    this.delayEngine.stop();
    this.store.setState((state) => ({
      ...state,
      mode: state.media.found ? 'media-detected' : 'idle',
      activeDelaySeconds: 0,
      buffering: {
        secondsBuffered: 0,
        ready: false,
        status: 'idle'
      },
      playback: {
        ...state.playback,
        status: 'stopped'
      }
    }));
    this.diagnostics.add('info', 'Delayed playback stopped');
  }
}
