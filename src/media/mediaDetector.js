function scoreCandidate(media) {
  let score = 0;
  if (!media.paused) score += 4;
  if (!media.ended) score += 1;
  if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) score += 2;
  if (media.currentTime > 0) score += 1;
  if (media.volume > 0 && !media.muted) score += 1;
  if (media.srcObject) score += 2;
  if (media.tagName === 'AUDIO') score += 1;
  return score;
}

export function detectMediaElements(doc) {
  const elements = [...doc.querySelectorAll('audio, video')];
  const candidates = elements
    .map((element) => ({
      element,
      score: scoreCandidate(element),
      type: element.tagName.toLowerCase(),
      paused: element.paused,
      currentTime: element.currentTime,
      readyState: element.readyState,
      src: element.currentSrc || element.src || '[inline/srcObject]'
    }))
    .sort((a, b) => b.score - a.score);

  return {
    candidates,
    best: candidates[0] ?? null
  };
}
