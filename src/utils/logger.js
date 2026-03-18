export function createLogger(namespace) {
  return {
    info(message, payload) {
      console.info(`[${namespace}] ${message}`, payload ?? '');
    },
    warn(message, payload) {
      console.warn(`[${namespace}] ${message}`, payload ?? '');
    },
    error(message, payload) {
      console.error(`[${namespace}] ${message}`, payload ?? '');
    }
  };
}
