# Audio Delay Companion

A private-use browser helper that wraps an existing live-stream web page, lets the user manually start the original stream, and then attempts to play that same audio with a configurable delay such as 5, 10, 15, or 20 seconds.

## What this app does

- Loads the page URL that already contains the live audio player.
- Lets the user manually start playback on that original page.
- Tries to detect an accessible `<audio>` or `<video>` element inside the embedded page.
- Routes accessible media through a Web Audio delay pipeline.
- Waits until enough audio is buffered before making the delayed output audible.
- Shows detailed status and diagnostics so failures are explicit instead of silent.

## What this app does not do

- It is **not** a downloader.
- It is **not** a recorder-first workflow.
- It does **not** scrape a direct stream URL on the server.
- It does **not** modify the original site.
- It does **not** pretend it can bypass browser security boundaries.

## Intended use

This MVP is designed as a private personal delay companion for stream pages that the user is already allowed to access. It works best when the target page can be embedded and its media element is accessible from the wrapper page.

## Architecture summary

The app is intentionally modular and centered around three layers:

1. **UI and state layer**: captures URL, delay presets, playback controls, status, and diagnostics.
2. **Media inspection and strategy layer**: inspects the iframe when possible, detects candidate media elements, and selects a strategy.
3. **Delay engine**: uses the Web Audio API to route the detected media element through a real-time delay line and only becomes audible after the requested delay has elapsed.

### Strategy model

- **Strategy A – Direct accessible media element**: use an accessible media element with `createMediaElementSource()`.
- **Strategy B – Media capture fallback**: the code detects whether `captureStream()` exists and surfaces that as the chosen strategy when available, but this MVP still routes through the accessible element path because the browser must already expose the media element to the wrapper.
- **Strategy C – Graceful unsupported state**: if the iframe is cross-origin, sandboxed, or no media element is available, the app reports the limitation clearly.

## Technical limitations

This project is deliberately honest about browser limitations. Some pages will simply not work in a browser-only wrapper. Common failure reasons:

- The target page sends `X-Frame-Options` or CSP `frame-ancestors` rules that block embedding.
- The page loads in the iframe but remains cross-origin, so the wrapper cannot inspect its DOM.
- The player is hidden behind a custom rendering pipeline instead of a normal `<audio>`/`<video>` element.
- The browser blocks autoplay or keeps the `AudioContext` suspended until the user clicks.
- Some browsers expose `captureStream()` inconsistently.

When those conditions occur, the app reports them in the status panel and diagnostics panel instead of claiming success.

## Supported scenarios

More likely to work:

- Same-origin pages during development/testing.
- Pages explicitly built to allow iframe embedding.
- Pages that use a normal HTML audio or video element for live playback.
- Browsers with solid Web Audio support and user interaction to unlock audio playback.

## Unsupported or fragile scenarios

Less likely to work or expected to fail:

- Cross-origin media pages that the wrapper cannot inspect.
- Sites that block framing entirely.
- DRM or EME-protected players.
- Canvas/WebAssembly/custom native player pipelines without accessible media elements.
- Environments where the user can only open the page in a separate tab but not embed or inspect it.

## How to run

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

To build for production:

```bash
npm run build
npm run preview
```

## How to use

1. Open the app.
2. Paste the URL of the page that contains the original live stream player.
3. Click **Open Stream Page**.
4. If the page loads inside the iframe, manually interact with the original player and start the stream.
5. Click **Stream Started** so the wrapper re-checks the iframe for active media elements.
6. Choose a delay preset or enter a custom delay.
7. Click **Start Delayed Playback**.
8. Wait while the app buffers audio up to the requested delay.
9. Once buffering completes, listen to the delayed output and use fine-tune controls if needed.
10. Use **Stop Delayed Playback** or **Reset** to clean up and start over.

## Implementation notes

- The delay path is a real Web Audio delay line, not a fake pause/resume trick.
- The app requires user interaction for the original player and usually also for starting delayed playback.
- Diagnostics are intended for real troubleshooting: browser support, iframe accessibility, media detection count, strategy choice, and recent errors are all exposed.
- URL and selected delay are persisted in `localStorage` for convenience.

## Future improvements

- Add a true `captureStream()` execution path that converts the captured `MediaStream` into a Web Audio source node when browser behavior is predictable enough.
- Add site-specific adapters for known internal stream pages.
- Add a desktop wrapper (Electron or Tauri) for scenarios where browser cross-origin rules make the web-only approach impossible.
- Add saved presets and named profiles.
- Add richer signal monitoring and drift correction for long sessions.
