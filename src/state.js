import { DEFAULT_DELAY_SECONDS, STORAGE_KEYS } from './config.js';

const initialState = {
  pageUrl: localStorage.getItem(STORAGE_KEYS.pageUrl) ?? '',
  selectedDelaySeconds: Number(localStorage.getItem(STORAGE_KEYS.delaySeconds) ?? DEFAULT_DELAY_SECONDS),
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
    status: 'stopped',
    muted: false,
    volume: 1
  },
  support: {
    audioContext: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
    mediaElementSource: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
    captureStream: false
  },
  errors: [],
  warnings: [],
  diagnostics: []
};

export function createStore() {
  let state = structuredClone(initialState);
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  function setState(updater) {
    const nextState = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    state = nextState;

    localStorage.setItem(STORAGE_KEYS.pageUrl, state.pageUrl);
    localStorage.setItem(STORAGE_KEYS.delaySeconds, String(state.selectedDelaySeconds));
    notify();
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe, initialState };
}
