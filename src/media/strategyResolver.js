import { canUseCaptureStream } from './mediaAccess.js';

export function resolveStrategy({ frameAccessible, mediaResult, support }) {
  if (!frameAccessible) {
    return {
      strategy: 'unsupported',
      reason: 'The page loaded in a cross-origin or restricted context, so the wrapper cannot inspect the original player.'
    };
  }

  if (!mediaResult?.best) {
    return {
      strategy: 'unsupported',
      reason: 'No playable audio/video element was found after the page became accessible.'
    };
  }

  if (!support.audioContext) {
    return {
      strategy: 'unsupported',
      reason: 'Web Audio is unavailable in this browser.'
    };
  }

  if (canUseCaptureStream(mediaResult.best.element)) {
    return {
      strategy: 'capture-stream',
      reason: 'Using captureStream() provides a robust capture path for the detected playing media element.'
    };
  }

  return {
    strategy: 'media-element-source',
    reason: 'The media element is accessible, so the app can route it directly through Web Audio.'
  };
}
