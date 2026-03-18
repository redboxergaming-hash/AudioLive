export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatSeconds(seconds) {
  return `${seconds.toFixed(1)}s`;
}
