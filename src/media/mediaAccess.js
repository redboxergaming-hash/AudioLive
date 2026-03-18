export function canUseCaptureStream(mediaElement) {
  return Boolean(mediaElement?.captureStream || mediaElement?.mozCaptureStream);
}

export function captureFromMediaElement(mediaElement) {
  const capture = mediaElement.captureStream || mediaElement.mozCaptureStream;
  if (!capture) {
    throw new Error('captureStream() is not supported for the detected media element.');
  }

  return capture.call(mediaElement);
}
