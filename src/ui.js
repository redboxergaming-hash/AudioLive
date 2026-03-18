import { DELAY_PRESETS, FINE_TUNE_STEPS } from './config.js';
import { createButton, formatJson } from './utils/dom.js';
import { formatSeconds } from './utils/time.js';

function badgeClass(level) {
  return `badge badge--${level}`;
}

export function createAppView(root, handlers) {
  root.innerHTML = `
    <div class="shell">
      <header class="hero card">
        <p class="eyebrow">Private helper MVP</p>
        <h1>Audio Delay Companion</h1>
        <p class="lede">Open a stream page you already have permission to use, manually start it, and then route it through a browser-based delay pipeline when access is technically possible.</p>
      </header>

      <main class="layout">
        <section class="card controls">
          <h2>Stream page</h2>
          <label class="field">
            <span>Page URL</span>
            <input id="page-url" name="pageUrl" type="url" placeholder="https://example.com/live-player" />
          </label>
          <div class="actions actions--stacked">
            <button id="open-stream" type="button">Open Stream Page</button>
            <button id="stream-started" type="button" class="secondary">Stream Started</button>
            <button id="start-delayed" type="button">Start Delayed Playback</button>
            <button id="stop-delayed" type="button" class="secondary">Stop Delayed Playback</button>
            <button id="reset-app" type="button" class="ghost">Reset</button>
          </div>

          <h2>Delay</h2>
          <div id="preset-row" class="preset-row"></div>
          <label class="field field--compact">
            <span>Custom delay (seconds)</span>
            <input id="custom-delay" type="number" min="1" max="120" step="0.5" />
          </label>
          <div id="fine-tune-row" class="preset-row"></div>

          <h2>Output</h2>
          <label class="field field--compact">
            <span>Volume</span>
            <input id="volume-slider" type="range" min="0" max="1" step="0.05" value="1" />
          </label>
          <div class="actions actions--stacked actions--inline">
            <button id="mute-toggle" type="button" class="secondary">Mute</button>
          </div>
        </section>

        <section class="card stage">
          <div class="stage__top">
            <div>
              <h2>Embedded stream page</h2>
              <p class="hint">Embedding only works when the target site allows iframes. If the site blocks framing or same-origin access, the app will explain why it cannot continue.</p>
            </div>
            <a id="open-external-link" class="text-link" href="#" target="_blank" rel="noreferrer noopener">Open in new tab</a>
          </div>
          <div class="frame-shell">
            <iframe id="stream-frame" title="Original stream page"></iframe>
          </div>
        </section>

        <section class="card status-panel">
          <h2>Status</h2>
          <div id="status-grid" class="status-grid"></div>
          <div id="messages"></div>
        </section>

        <details class="card diagnostics" open>
          <summary>
            <span>Diagnostics</span>
            <button id="copy-diagnostics" type="button" class="ghost ghost--small">Copy diagnostics</button>
          </summary>
          <pre id="diagnostics-output"></pre>
        </details>
      </main>
    </div>
  `;

  const elements = {
    pageUrl: root.querySelector('#page-url'),
    openStream: root.querySelector('#open-stream'),
    streamStarted: root.querySelector('#stream-started'),
    startDelayed: root.querySelector('#start-delayed'),
    stopDelayed: root.querySelector('#stop-delayed'),
    resetApp: root.querySelector('#reset-app'),
    customDelay: root.querySelector('#custom-delay'),
    presetRow: root.querySelector('#preset-row'),
    fineTuneRow: root.querySelector('#fine-tune-row'),
    volumeSlider: root.querySelector('#volume-slider'),
    muteToggle: root.querySelector('#mute-toggle'),
    streamFrame: root.querySelector('#stream-frame'),
    openExternalLink: root.querySelector('#open-external-link'),
    statusGrid: root.querySelector('#status-grid'),
    messages: root.querySelector('#messages'),
    diagnosticsOutput: root.querySelector('#diagnostics-output'),
    copyDiagnostics: root.querySelector('#copy-diagnostics')
  };

  DELAY_PRESETS.forEach((preset) => {
    const button = createButton(`${preset}s`, { delayPreset: String(preset) });
    button.addEventListener('click', () => handlers.onDelaySelect(preset));
    elements.presetRow.append(button);
  });

  FINE_TUNE_STEPS.forEach((step) => {
    const label = step > 0 ? `+${step}s` : `${step}s`;
    const button = createButton(label, { fineTune: String(step) });
    button.classList.add('secondary');
    button.addEventListener('click', () => handlers.onFineTune(step));
    elements.fineTuneRow.append(button);
  });

  elements.pageUrl.addEventListener('input', (event) => handlers.onUrlChange(event.target.value));
  elements.customDelay.addEventListener('change', (event) => handlers.onDelaySelect(Number(event.target.value)));
  elements.openStream.addEventListener('click', handlers.onOpenStream);
  elements.streamStarted.addEventListener('click', handlers.onStreamStarted);
  elements.startDelayed.addEventListener('click', handlers.onStartDelayed);
  elements.stopDelayed.addEventListener('click', handlers.onStopDelayed);
  elements.resetApp.addEventListener('click', handlers.onReset);
  elements.volumeSlider.addEventListener('input', (event) => handlers.onVolumeChange(Number(event.target.value)));
  elements.muteToggle.addEventListener('click', handlers.onMuteToggle);
  elements.copyDiagnostics.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onCopyDiagnostics();
  });

  return {
    elements,
    render(state) {
      elements.pageUrl.value = state.pageUrl;
      elements.customDelay.value = String(state.selectedDelaySeconds);
      elements.volumeSlider.value = String(state.playback.volume);
      elements.muteToggle.textContent = state.playback.muted ? 'Unmute' : 'Mute';
      elements.openExternalLink.href = state.pageUrl || '#';

      [...elements.presetRow.querySelectorAll('button')].forEach((button) => {
        button.classList.toggle('is-active', Number(button.dataset.delayPreset) === state.selectedDelaySeconds);
      });

      const statusItems = [
        ['Mode', state.mode],
        ['Target delay', formatSeconds(state.selectedDelaySeconds)],
        ['Active delay', state.activeDelaySeconds ? formatSeconds(state.activeDelaySeconds) : 'Not active'],
        ['Strategy', state.strategy],
        ['Media', `${state.media.type} / ${state.media.status}`],
        ['Buffered', `${formatSeconds(state.buffering.secondsBuffered)} / ${formatSeconds(state.selectedDelaySeconds)}`],
        ['Playback', state.playback.status],
        ['Frame access', state.frame.accessible ? 'Accessible' : state.frame.blockedReason]
      ];

      elements.statusGrid.innerHTML = statusItems
        .map(([label, value]) => `<div class="status-item"><span>${label}</span><strong>${value}</strong></div>`)
        .join('');

      const messageBadges = [
        ...state.errors.map((message) => ({ level: 'error', message })),
        ...state.warnings.map((message) => ({ level: 'warning', message })),
        { level: 'info', message: state.media.details },
        { level: 'info', message: `Buffer status: ${state.buffering.status}` }
      ];

      elements.messages.innerHTML = messageBadges
        .filter((item) => item.message)
        .map((item) => `<p class="${badgeClass(item.level)}">${item.message}</p>`)
        .join('');

      elements.diagnosticsOutput.textContent = formatJson({
        support: state.support,
        frame: state.frame,
        media: state.media,
        buffering: state.buffering,
        playback: state.playback,
        diagnostics: state.diagnostics
      });
    }
  };
}
