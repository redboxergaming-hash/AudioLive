import { DIAGNOSTIC_LIMIT } from './config.js';

export function createDiagnostics(store) {
  function add(level, message, details = null) {
    store.setState((state) => {
      const entry = {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        level,
        message,
        details
      };

      return {
        ...state,
        diagnostics: [entry, ...state.diagnostics].slice(0, DIAGNOSTIC_LIMIT)
      };
    });
  }

  function snapshot(label, payload) {
    add('debug', label, payload);
  }

  function clear() {
    store.setState((state) => ({
      ...state,
      diagnostics: []
    }));
  }

  return {
    add,
    snapshot,
    clear
  };
}
