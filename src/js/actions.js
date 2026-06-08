/**
 * Liveness action definitions.
 *
 * Each action owns a small state machine that watches landmark frames and
 * returns `true` exactly once when a complete gesture has been observed
 * (entry + exit), preventing single-frame false positives.
 *
 * @typedef {import('./geometry.js').Landmark} Landmark
 */

import { BLINK, HEAD_POSE, HYSTERESIS_WINDOW, MOUTH } from './config.js';
import { eyeAspectRatio, headPoseAngles, mouthAspectRatio } from './geometry.js';

/**
 * @template T
 * @typedef {{ value: T, samples: T[] }} Hysteresis
 */

/**
 * Build a sliding-window hysteresis helper.
 *
 * `update(rawState)` records the latest sample and returns the majority
 * value of the last `windowSize` samples — that is, the value that
 * appeared in at least ⌈windowSize / 2⌉ of the most recent frames.
 *
 * @template T
 * @param {number} windowSize
 * @returns {{ update: (value: T) => T, reset: () => void }}
 */
function makeWindow(windowSize) {
  /** @type {T[]} */
  let samples = [];
  return {
    update(value) {
      samples.push(value);
      if (samples.length > windowSize) samples.shift();
      const counts = new Map();
      for (const sample of samples) {
        counts.set(sample, (counts.get(sample) ?? 0) + 1);
      }
      let majorityValue = samples[0];
      let majorityCount = 0;
      for (const [candidate, count] of counts) {
        if (count > majorityCount) {
          majorityCount = count;
          majorityValue = candidate;
        }
      }
      return majorityValue;
    },
    reset() {
      samples = [];
    },
  };
}

/**
 * Translate a continuous metric into discrete states using two thresholds.
 *
 * While `rawState` matches `lowLabel` the value `lowLabel` is emitted;
 * otherwise `highLabel` is emitted. This produces the open/closed-style
 * state machine used by the gesture detectors below.
 *
 * @param {number} value
 * @param {number} enterThreshold — when the value crosses this, emit `enterLabel`
 * @param {number} exitThreshold — when the value returns past this, emit `exitLabel`
 * @param {string} enterLabel
 * @param {string} exitLabel
 * @returns {string}
 */
function twoState(value, enterThreshold, exitThreshold, enterLabel, exitLabel) {
  if (value > enterThreshold) return enterLabel;
  if (value < exitThreshold) return exitLabel;
  return value > (enterThreshold + exitThreshold) / 2 ? enterLabel : exitLabel;
}

/**
 * @typedef {Object} Action
 * @property {string} id
 * @property {string} prompt
 * @property {(landmarks: Landmark[]) => boolean} update
 * @property {() => void} reset
 */

/** @type {Action[]} */
export const ACTIONS = [
  createBlinkAction(),
  createMouthAction(),
  createShakeAction(),
  createNodAction(),
];

/**
 * @returns {Action}
 */
function createBlinkAction() {
  const window = makeWindow(HYSTERESIS_WINDOW);
  let phase = 'open';
  return {
    id: 'blink',
    prompt: '请眨眼',
    update(landmarks) {
      const ear = eyeAspectRatio(landmarks);
      const closed = ear < BLINK.CLOSED_EAR;
      const open = ear > BLINK.OPEN_EAR;
      const stable = window.update(closed ? 'closed' : 'open');
      if (phase === 'open' && stable === 'closed') {
        phase = 'closed';
      } else if (phase === 'closed' && open) {
        phase = 'open';
        return true;
      }
      return false;
    },
    reset() {
      phase = 'open';
      window.reset();
    },
  };
}

/**
 * @returns {Action}
 */
function createMouthAction() {
  const window = makeWindow(HYSTERESIS_WINDOW);
  let phase = 'closed';
  return {
    id: 'mouth',
    prompt: '请张嘴',
    update(landmarks) {
      const mar = mouthAspectRatio(landmarks);
      const opened = mar > MOUTH.OPEN_MAR;
      const closed = mar < MOUTH.CLOSED_MAR;
      const stable = window.update(opened ? 'open' : 'closed');
      if (phase === 'closed' && stable === 'open') {
        phase = 'open';
      } else if (phase === 'open' && closed) {
        phase = 'closed';
        return true;
      }
      return false;
    },
    reset() {
      phase = 'closed';
      window.reset();
    },
  };
}

/**
 * Head-shake detector: horizontal (yaw) sweep that returns to neutral.
 *
 * The pose estimator is noisy, so we require a single majority reading of
 * "extreme" inside a sliding window before treating it as an entry, which
 * keeps the gesture from triggering on a brief head wobble.
 *
 * @returns {Action}
 */
function createShakeAction() {
  const window = makeWindow(HYSTERESIS_WINDOW);
  let phase = 'neutral';
  return {
    id: 'shake',
    prompt: '请左右摇头',
    update(landmarks) {
      const [, , yaw] = headPoseAngles(landmarks);
      const neutral = Math.abs(yaw) < HEAD_POSE.NEUTRAL_DEG;
      const extreme = Math.abs(yaw) > HEAD_POSE.EXTREME_DEG;
      const stable = window.update(extreme ? 'extreme' : neutral ? 'neutral' : 'mid');
      if (phase === 'neutral' && stable === 'extreme') {
        phase = 'extreme';
      } else if (phase === 'extreme' && neutral) {
        phase = 'neutral';
        return true;
      }
      return false;
    },
    reset() {
      phase = 'neutral';
      window.reset();
    },
  };
}

/**
 * Head-nod detector: vertical (pitch) sweep that returns to neutral.
 * Mirrors the shake detector but for the pitch axis.
 *
 * @returns {Action}
 */
function createNodAction() {
  const window = makeWindow(HYSTERESIS_WINDOW);
  let phase = 'neutral';
  return {
    id: 'nod',
    prompt: '请上下点头',
    update(landmarks) {
      const [, pitch] = headPoseAngles(landmarks);
      const neutral = Math.abs(pitch) < HEAD_POSE.NEUTRAL_DEG;
      const extreme = Math.abs(pitch) > HEAD_POSE.EXTREME_DEG;
      const stable = window.update(extreme ? 'extreme' : neutral ? 'neutral' : 'mid');
      if (phase === 'neutral' && stable === 'extreme') {
        phase = 'extreme';
      } else if (phase === 'extreme' && neutral) {
        phase = 'neutral';
        return true;
      }
      return false;
    },
    reset() {
      phase = 'neutral';
      window.reset();
    },
  };
}
