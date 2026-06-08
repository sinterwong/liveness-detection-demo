/**
 * Liveness state machine.
 *
 * Drives the high-level flow:
 *   idle → warmup → awaiting_face ⇄ prompting → cooldown → prompting
 *                                  ↓
 *                              completed
 *
 * The detector hides its internal phases and exposes a small set of
 * semantic events (`phaseChanged`, `actionStarted`, `actionCompleted`,
 * `allCompleted`) so the UI can react without coupling to the timer and
 * frame-counting bookkeeping.
 *
 * @typedef {import('./geometry.js').Landmark} Landmark
 * @typedef {import('./actions.js').Action} Action
 */

import { TIMINGS } from './config.js';

export const Phase = Object.freeze({
  IDLE: 'idle',
  WARMUP: 'warmup',
  AWAITING_FACE: 'awaiting_face',
  PROMPTING: 'prompting',
  COOLDOWN: 'cooldown',
  COMPLETED: 'completed',
});

/**
 * @template {string} K
 * @template V
 * @typedef {Map<K, Set<(payload: V) => void>>} ListenerMap
 */

export class LivenessDetector {
  /** @type {Action[]} */
  #actions;
  /** @type {Set<string>} */
  #completedIds = new Set();
  /** @type {Action | null} */
  #currentAction = null;
  /** @type {Phase} */
  #phase = Phase.IDLE;
  /** @type {number | null} */
  #warmupTimer = null;
  /** @type {number | null} */
  #cooldownTimer = null;
  /** @type {number | null} */
  #actionTimeoutTimer = null;
  /** @type {number} */
  #noFaceStreak = 0;
  /** @type {ListenerMap<string, unknown>} */
  #listeners = new Map();

  /** @param {Action[]} actions */
  constructor(actions) {
    this.#actions = actions;
  }

  get phase() {
    return this.#phase;
  }
  get currentAction() {
    return this.#currentAction;
  }
  get completedCount() {
    return this.#completedIds.size;
  }
  get totalCount() {
    return this.#actions.length;
  }
  get isComplete() {
    return this.#completedIds.size === this.#actions.length;
  }

  /**
   * Subscribe to a semantic event.
   * @template T
   * @param {string} event
   * @param {(payload: T) => void} listener
   * @returns {() => void} unsubscribe
   */
  on(event, listener) {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(/** @type {any} */ (listener));
    return () => set.delete(/** @type {any} */ (listener));
  }

  /**
   * @param {string} event
   * @param {unknown} payload
   */
  #emit(event, payload) {
    this.#listeners.get(event)?.forEach((fn) => fn(payload));
  }

  /** Begin the warmup phase. Called after the camera is ready. */
  start() {
    if (this.#phase !== Phase.IDLE) return;
    this.#setPhase(Phase.WARMUP);
    this.#warmupTimer = setTimeout(() => {
      this.#warmupTimer = null;
      this.#setPhase(Phase.AWAITING_FACE);
    }, TIMINGS.WARMUP_MS);
  }

  /**
   * Feed the latest face-mesh result. Pass `null` when no face is in frame.
   * @param {Landmark[] | null} landmarks
   */
  evaluate(landmarks) {
    if (this.#phase === Phase.COMPLETED || this.#phase === Phase.IDLE) return;

    if (!landmarks) {
      this.#handleNoFace();
      return;
    }

    if (this.#phase === Phase.AWAITING_FACE) {
      this.#noFaceStreak = 0;
      this.#pickNextAction();
      this.#setPhase(Phase.PROMPTING);
      this.#armActionTimeout();
    }

    if (this.#phase !== Phase.PROMPTING || !this.#currentAction) return;

    if (this.#currentAction.update(landmarks)) {
      this.#markActionCompleted(false);
    }
  }

  #handleNoFace() {
    if (this.#phase !== Phase.PROMPTING && this.#phase !== Phase.AWAITING_FACE) return;
    this.#noFaceStreak += 1;
    if (this.#phase === Phase.PROMPTING && this.#noFaceStreak >= TIMINGS.NO_FACE_GRACE_FRAMES) {
      this.#clearActionTimeout();
      this.#currentAction?.reset();
      this.#currentAction = null;
      this.#setPhase(Phase.AWAITING_FACE);
    }
  }

  #pickNextAction() {
    const remaining = this.#actions.filter((a) => !this.#completedIds.has(a.id));
    if (remaining.length === 0) {
      this.#finish();
      return;
    }
    const picked = remaining[Math.floor(Math.random() * remaining.length)];
    this.#currentAction = picked;
    this.#emit('actionStarted', picked);
  }

  #markActionCompleted(byTimeout) {
    if (!this.#currentAction) return;
    this.#clearActionTimeout();
    const action = this.#currentAction;
    this.#currentAction = null;
    this.#completedIds.add(action.id);
    this.#emit('actionCompleted', { action, byTimeout });
    this.#enterCooldown();
  }

  #armActionTimeout() {
    this.#clearActionTimeout();
    this.#actionTimeoutTimer = setTimeout(() => {
      this.#actionTimeoutTimer = null;
      if (this.#phase === Phase.PROMPTING && this.#currentAction) {
        this.#currentAction.reset();
        this.#markActionCompleted(true);
      }
    }, TIMINGS.ACTION_TIMEOUT_MS);
  }

  #clearActionTimeout() {
    if (this.#actionTimeoutTimer !== null) {
      clearTimeout(this.#actionTimeoutTimer);
      this.#actionTimeoutTimer = null;
    }
  }

  #enterCooldown() {
    if (this.isComplete) {
      this.#finish();
      return;
    }
    this.#setPhase(Phase.COOLDOWN);
    this.#cooldownTimer = setTimeout(() => {
      this.#cooldownTimer = null;
      this.#setPhase(Phase.AWAITING_FACE);
    }, TIMINGS.COOLDOWN_MS);
  }

  #finish() {
    this.#clearActionTimeout();
    if (this.#cooldownTimer !== null) {
      clearTimeout(this.#cooldownTimer);
      this.#cooldownTimer = null;
    }
    this.#currentAction = null;
    this.#setPhase(Phase.COMPLETED);
    this.#emit('allCompleted', undefined);
  }

  /**
   * @param {Phase} phase
   */
  #setPhase(phase) {
    if (this.#phase === phase) return;
    this.#phase = phase;
    this.#emit('phaseChanged', phase);
  }

  dispose() {
    if (this.#warmupTimer !== null) clearTimeout(this.#warmupTimer);
    if (this.#cooldownTimer !== null) clearTimeout(this.#cooldownTimer);
    this.#clearActionTimeout();
    this.#listeners.clear();
  }
}
