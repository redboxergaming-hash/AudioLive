import { createStore } from './state.js';
import { createDiagnostics } from './diagnostics.js';
import { createAppView } from './ui.js';
import { DelayEngine } from './media/delayEngine.js';
import { PlaybackController } from './media/playbackController.js';
import { clamp } from './utils/time.js';
import { getErrorMessage } from './utils/errors.js';
import { createLogger } from './utils/logger.js';

export function createApp(root) {
  const logger = createLogger('audio-delay');
  const store = createStore();
  const diagnostics = createDiagnostics(store);

  let playbackController;
  let view;

  function setError(message) {
    store.setState((state) => ({
      ...state,
      errors: [message, ...state.errors].slice(0, 8)
    }));
  }

  function applyDelaySelection(delaySeconds) {
    const safeDelay = clamp(Number(delaySeconds) || 0, 1, 120);
    store.setState((state) => ({ ...state, selectedDelaySeconds: safeDelay }));
    const playbackStatus = store.getState().playback.status;
    if (playbackStatus === 'playing-delayed' || playbackStatus === 'buffering') {
      delayEngine.setDelay(safeDelay);
      store.setState((state) => ({ ...state, activeDelaySeconds: safeDelay }));
    }
  }

  function clearMessages() {
    store.setState((state) => ({
      ...state,
      errors: [],
      warnings: []
    }));
  }

  function syncEngineState(engineState) {
    store.setState((state) => ({
      ...state,
      mode: engineState.engineStatus,
      buffering: {
        secondsBuffered: engineState.secondsBuffered,
        ready: engineState.ready,
        status: engineState.engineStatus
      },
      playback: {
        ...state.playback,
        status: engineState.engineStatus === 'playing-delayed' ? 'playing-delayed' : state.playback.status
      },
      warnings: engineState.ready ? state.warnings : ['Waiting until enough audio is buffered before delayed playback becomes audible.']
    }));
  }

  const delayEngine = new DelayEngine({ diagnostics, onStateChange: syncEngineState });

  function validateUrl(url) {
    try {
      return new URL(url).toString();
    } catch {
      throw new Error('Please enter a valid absolute URL, including http:// or https://.');
    }
  }

  function attachFrameListeners(frame) {
    frame.addEventListener('load', () => {
      diagnostics.add('info', 'Iframe loaded', { src: frame.src });
      try {
        void frame.contentWindow?.location?.href;
        store.setState((state) => ({
          ...state,
          frame: {
            attempted: true,
            loaded: true,
            accessible: true,
            blockedReason: 'Accessible same-origin document.'
          },
          mode: 'page-loaded'
        }));
      } catch (error) {
        store.setState((state) => ({
          ...state,
          frame: {
            attempted: true,
            loaded: true,
            accessible: false,
            blockedReason: 'Loaded, but cross-origin access is blocked by the browser.'
          },
          mode: 'page-loaded',
          warnings: [
            'The page loaded, but the wrapper cannot inspect its DOM because the site is cross-origin or sandboxed. Delayed playback may not be possible in this browser-based MVP.'
          ]
        }));
        diagnostics.add('warning', 'Iframe access blocked after load', { message: getErrorMessage(error) });
      }
    });
  }

  function resetState(preserveUrl = false) {
    delayEngine.stop();
    store.setState((state) => ({
      ...state,
      pageUrl: preserveUrl ? state.pageUrl : '',
      activeDelaySeconds: 0,
      mode: 'idle',
      strategy: 'none',
      frame: {
        attempted: false,
        loaded: false,
        accessible: false,
        blockedReason: 'Not attempted'
      },
      media: {
        found: false,
        type: 'unknown',
        candidates: 0,
        status: 'waiting',
        details: 'Open a page and manually start the original stream.',
        captureMethod: 'none'
      },
      buffering: {
        secondsBuffered: 0,
        ready: false,
        status: 'idle'
      },
      playback: {
        ...state.playback,
        status: 'stopped'
      },
      errors: [],
      warnings: [],
      diagnostics: []
    }));
    diagnostics.add('info', 'App state reset', { preserveUrl });
    view.elements.streamFrame.src = 'about:blank';
  }

  view = createAppView(root, {
    onUrlChange(url) {
      store.setState((state) => ({ ...state, pageUrl: url }));
    },
    onOpenStream() {
      clearMessages();
      try {
        const normalizedUrl = validateUrl(store.getState().pageUrl);
        resetState(true);
        store.setState((state) => ({ ...state, pageUrl: normalizedUrl }));
        view.elements.streamFrame.src = normalizedUrl;
        diagnostics.add('info', 'Attempting to load stream page', { url: normalizedUrl });
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    onStreamStarted() {
      clearMessages();
      try {
        const result = playbackController.inspectFrame();
        if (!result.mediaResult.best) {
          store.setState((state) => ({
            ...state,
            warnings: ['The page is accessible, but no playing audio/video element was found yet. Start the stream on the original page, then try again.']
          }));
        }
      } catch (error) {
        const message = getErrorMessage(error);
        setError(`Stream inspection failed: ${message}`);
      }
    },
    async onStartDelayed() {
      clearMessages();
      try {
        await playbackController.startDelayedPlayback();
      } catch (error) {
        logger.error('Failed to start delayed playback', error);
      }
    },
    onStopDelayed() {
      playbackController.stopDelayedPlayback();
    },
    onDelaySelect(delaySeconds) {
      applyDelaySelection(delaySeconds);
    },
    onFineTune(delta) {
      const nextDelay = clamp(store.getState().selectedDelaySeconds + delta, 1, 120);
      applyDelaySelection(nextDelay);
    },
    onVolumeChange(volume) {
      delayEngine.setVolume(volume);
      store.setState((state) => ({
        ...state,
        playback: {
          ...state.playback,
          volume,
          muted: volume === 0 ? true : state.playback.muted
        }
      }));
    },
    onMuteToggle() {
      const state = store.getState();
      const nextMuted = !state.playback.muted;
      delayEngine.setMuted(nextMuted, state.playback.volume || 1);
      store.setState((current) => ({
        ...current,
        playback: {
          ...current.playback,
          muted: nextMuted
        }
      }));
    },
    onReset() {
      resetState(false);
    },
    async onCopyDiagnostics() {
      const payload = JSON.stringify(store.getState().diagnostics, null, 2);
      try {
        await navigator.clipboard.writeText(payload);
        diagnostics.add('info', 'Diagnostics copied to clipboard');
      } catch (error) {
        setError(`Could not copy diagnostics: ${getErrorMessage(error)}`);
      }
    }
  });

  attachFrameListeners(view.elements.streamFrame);
  playbackController = new PlaybackController({
    store,
    diagnostics,
    delayEngine,
    iframe: view.elements.streamFrame
  });

  store.subscribe((state) => view.render(state));
  diagnostics.snapshot('Initial browser support', store.getState().support);

  return { store, diagnostics, delayEngine, playbackController };
}
