/**
 * DOM controller for the liveness demo.
 *
 * Owns references to the instruction text, progress list, count badge
 * and toast surface. All updates are pure DOM mutations — this class
 * knows nothing about MediaPipe or the state machine.
 *
 * @typedef {import('./actions.js').Action} Action
 */

import { TIMINGS, MESSAGES } from './config.js';
import { Phase } from './liveness-detector.js';

/**
 * @param {Action} action
 * @param {boolean} isActive
 * @param {boolean} isDone
 */
function actionLi(action, isActive, isDone) {
  const li = document.createElement('li');
  li.className = 'action-item';
  if (isActive) li.classList.add('is-active');
  if (isDone) li.classList.add('is-done');
  li.dataset.actionId = action.id;
  const check = document.createElement('span');
  check.className = 'action-item__check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = '✓';
  const label = document.createElement('span');
  label.className = 'action-item__label';
  label.textContent = action.prompt;
  li.append(check, label);
  return li;
}

export class UI {
  /** @type {HTMLElement} */
  #instructionEl;
  /** @type {HTMLElement} */
  #actionCountEl;
  /** @type {HTMLElement} */
  #actionTotalEl;
  /** @type {HTMLOListElement} */
  #actionListEl;
  /** @type {HTMLElement} */
  #placeholderEl;
  /** @type {HTMLElement} */
  #toastEl;
  /** @type {number | null} */
  #toastTimer = null;
  /** @type {Action[]} */
  #actions = [];
  /** @type {Set<string>} */
  #completedIds = new Set();
  /** @type {string | null} */
  #activeActionId = null;

  constructor() {
    this.#instructionEl = this.#mustGet('instruction');
    this.#actionCountEl = this.#mustGet('actionCount');
    this.#actionTotalEl = this.#mustGet('actionTotal');
    this.#actionListEl = /** @type {HTMLOListElement} */ (this.#mustGet('actionList'));
    this.#placeholderEl = this.#mustGet('placeholder');
    this.#toastEl = this.#mustGet('toast');
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  #mustGet(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing required element #${id}`);
    return el;
  }

  /** @param {Action[]} actions */
  renderActionList(actions) {
    this.#actions = actions;
    this.#actionListEl.replaceChildren();
    for (const action of actions) {
      this.#actionListEl.appendChild(actionLi(action, false, false));
    }
    this.#actionTotalEl.textContent = String(actions.length);
  }

  /**
   * @param {Phase} phase
   * @param {string | null} [activeActionPrompt]
   */
  setPhase(phase, activeActionPrompt) {
    switch (phase) {
      case Phase.IDLE:
      case Phase.WARMUP:
        this.setInstruction(MESSAGES.WARMUP);
        this.#setActiveAction(null);
        break;
      case Phase.AWAITING_FACE:
        this.setInstruction(MESSAGES.NO_FACE);
        this.#setActiveAction(null);
        break;
      case Phase.PROMPTING:
        if (activeActionPrompt) this.setInstruction(activeActionPrompt);
        break;
      case Phase.COOLDOWN:
        this.setInstruction(MESSAGES.COOLDOWN);
        this.#setActiveAction(null);
        break;
      case Phase.COMPLETED:
        this.setInstruction(MESSAGES.ALL_DONE);
        this.#setActiveAction(null);
        break;
    }
  }

  /** @param {string} text */
  setInstruction(text) {
    this.#instructionEl.textContent = text;
  }

  /**
   * Highlight an action in the progress list.
   * @param {string | null} actionId
   */
  setActiveAction(actionId) {
    this.#setActiveAction(actionId);
  }

  /** @param {number} completed */
  setCompletedCount(completed) {
    this.#actionCountEl.textContent = String(completed);
  }

  /** @param {string} id */
  #setActiveAction(id) {
    if (this.#activeActionId === id) return;
    this.#activeActionId = id;
    for (const li of this.#actionListEl.children) {
      li.classList.toggle('is-active', li.dataset.actionId === id);
    }
  }

  /** @param {string} id */
  markActionCompleted(id) {
    this.#completedIds.add(id);
    const li = this.#actionListEl.querySelector(`[data-action-id="${CSS.escape(id)}"]`);
    if (li) li.classList.add('is-done');
    this.#setActiveAction(null);
  }

  /** @param {string} message */
  showToast(message) {
    this.#toastEl.textContent = message;
    this.#toastEl.classList.add('is-visible');
    if (this.#toastTimer !== null) clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      this.#toastEl.classList.remove('is-visible');
      this.#toastTimer = null;
    }, TIMINGS.TOAST_DURATION_MS);
  }

  showCameraReady() {
    this.#placeholderEl.classList.add('is-hidden');
  }

  showCameraError(message) {
    this.#placeholderEl.classList.remove('is-hidden');
    this.#placeholderEl.textContent = message;
  }
}
