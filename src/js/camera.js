/**
 * Owns the webcam stream and the per-frame inference pump.
 *
 * Lifecycle:
 *   start() → getUserMedia → attach to <video> → requestAnimationFrame loop
 *   stop()  → cancel RAF, stop tracks, pause video
 *
 * The camera also pauses inference while the tab is hidden and resumes it
 * when the tab is shown again, so a backgrounded tab does not waste CPU.
 */

import { CAMERA_CONSTRAINTS, MESSAGES } from './config.js';

/**
 * @typedef {HTMLVideoElement} VideoElement
 * @typedef {(video: VideoElement) => void | Promise<void>} FrameCallback
 *
 * @typedef {Object} CameraEvents
 * @property {(error: CameraError) => void} error
 * @property {(video: VideoElement) => void} ready
 * @property {() => void} pause
 * @property {() => void} resume
 */

export class CameraError extends Error {
  /**
   * @param {string} userMessage
   * @param {Error & { name?: string, code?: string }} [cause]
   */
  constructor(userMessage, cause) {
    super(userMessage, { cause });
    this.name = 'CameraError';
  }
}

function classifyError(err) {
  if (err && err.name === 'NotAllowedError') {
    return new CameraError(MESSAGES.CAMERA_DENIED, err);
  }
  if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
    return new CameraError(MESSAGES.CAMERA_NOT_FOUND, err);
  }
  return new CameraError(MESSAGES.CAMERA_GENERIC_ERROR, err);
}

export class CameraCapture {
  /** @type {VideoElement} */
  #video;
  /** @type {FrameCallback} */
  #onFrame;
  /** @type {MediaStream | null} */
  #stream = null;
  /** @type {number | null} */
  #rafHandle = null;
  /** @type {boolean} */
  #isRunning = false;
  /** @type {boolean} */
  #isVisible = true;
  /** @type {(() => void)[]} */
  #cleanups = [];

  /**
   * @param {VideoElement} video
   * @param {{ onFrame: FrameCallback }} options
   */
  constructor(video, { onFrame }) {
    this.#video = video;
    this.#onFrame = onFrame;
    this.#installVisibilityHandlers();
  }

  async start() {
    if (this.#isRunning) return;
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    } catch (err) {
      throw classifyError(err);
    }

    // Register the handler before assigning srcObject so we cannot miss a
    // synchronously-fired `loadedmetadata` event.
    const metadataReady = new Promise((resolve) => {
      this.#video.onloadedmetadata = () => resolve('event');
    });
    this.#video.srcObject = this.#stream;
    if (this.#video.readyState < 1 /* HAVE_METADATA */) {
      await Promise.race([
        metadataReady,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Camera metadata timeout')), 5000),
        ),
      ]);
    }
    this.#video.width = this.#video.videoWidth;
    this.#video.height = this.#video.videoHeight;
    try {
      await this.#video.play();
    } catch (err) {
      this.#stream.getTracks().forEach((track) => track.stop());
      this.#stream = null;
      this.#video.srcObject = null;
      throw classifyError(err);
    }

    this.#isRunning = true;
    this.#loop();
  }

  #loop = () => {
    if (!this.#isRunning) return;
    this.#pump();
  };

  async #pump() {
    if (!this.#isRunning) return;
    try {
      if (this.#isVisible && !this.#video.paused && !this.#video.ended) {
        await this.#onFrame(this.#video);
      }
    } catch (err) {
      console.error('Frame callback failed:', err);
    }
    if (this.#isRunning) {
      this.#rafHandle = requestAnimationFrame(this.#loop);
    }
  }

  stop() {
    this.#isRunning = false;
    if (this.#rafHandle !== null) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = null;
    }
    this.#video.pause();
    if (this.#stream) {
      this.#stream.getTracks().forEach((track) => track.stop());
      this.#stream = null;
    }
    this.#video.srcObject = null;
  }

  #installVisibilityHandlers() {
    const onVisibility = () => {
      this.#isVisible = !document.hidden;
      if (this.#isVisible && this.#isRunning) {
        this.#video.play().catch(() => {});
      } else if (!this.#isVisible) {
        this.#video.pause();
      }
    };
    const onPageHide = () => this.stop();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    this.#cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    });
  }

  dispose() {
    this.stop();
    this.#cleanups.forEach((fn) => fn());
    this.#cleanups = [];
  }
}
