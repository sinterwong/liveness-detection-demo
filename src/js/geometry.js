/**
 * Geometric helpers for face-mesh landmarks.
 *
 * A landmark from MediaPipe is `{ x, y, z, visibility? }` in normalised
 * image coordinates. The helpers in this module accept an array of such
 * landmarks in MediaPipe's canonical order (the order produced by the
 * FaceMesh solution's refineLandmarks output).
 *
 * @typedef {{ x: number, y: number, z: number, visibility?: number }} Landmark
 */

/** Euclidean distance between two landmarks. */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Aspect ratio of a quadrilateral described by 8 points.
 *
 * Layout: `[v0, h0a, h0b, h0c, v1, h1a, h1b, h1c]` where v0..v1 is the
 * vertical axis and the three h pairs span it horizontally.
 */
function fourPointAspectRatio(points) {
  const vertical = distance(points[0], points[4]);
  if (vertical < 1e-6) return 0;
  const horizontal =
    distance(points[1], points[5]) +
    distance(points[2], points[6]) +
    distance(points[3], points[7]);
  return horizontal / (3 * vertical);
}

/**
 * Eye Aspect Ratio averaged over both eyes.
 *
 * Uses MediaPipe's canonical eye landmark indices. Returns 0 when the
 * vertical span collapses (which would otherwise cause a division by zero).
 */
export function eyeAspectRatio(landmarks) {
  const leftEye = [
    landmarks[263], landmarks[385], landmarks[386], landmarks[387],
    landmarks[362], landmarks[380], landmarks[374], landmarks[373],
  ];
  const rightEye = [
    landmarks[33], landmarks[160], landmarks[159], landmarks[158],
    landmarks[133], landmarks[144], landmarks[145], landmarks[153],
  ];
  const left = fourPointAspectRatio(leftEye);
  const right = fourPointAspectRatio(rightEye);
  return (left + right) / 2;
}

/**
 * Mouth Aspect Ratio.
 *
 * Uses MediaPipe's canonical inner-lip landmark indices. Returns 0 when
 * the vertical span collapses.
 */
export function mouthAspectRatio(landmarks) {
  const mouth = [
    landmarks[61], landmarks[81], landmarks[13], landmarks[311],
    landmarks[291], landmarks[178], landmarks[14], landmarks[402],
  ];
  return fourPointAspectRatio(mouth);
}

/**
 * Estimate head pose as `[roll, pitch, yaw]` in degrees.
 *
 * The estimator is a small geometric approximation: it measures the
 * asymmetry of iris / nose / mouth corners relative to the eye-line to
 * produce a rough pose suitable for liveness action recognition (it is
 * not a calibrated 6-DoF solver).
 *
 * @returns {[number, number, number]} roll (deg), pitch (deg), yaw (deg)
 */
export function headPoseAngles(landmarks) {
  const points = [landmarks[468], landmarks[473], landmarks[4], landmarks[61], landmarks[291]];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const dPxEyes = Math.max(xs[1] - xs[0], 1.0);
  const dPyEyes = ys[1] - ys[0];
  const angle = Math.atan2(dPyEyes, dPxEyes);
  const alpha = Math.cos(angle);
  const beta = Math.sin(angle);

  const rx = xs.map((x, i) => alpha * x + beta * ys[i] + (1 - alpha) * xs[2] / 2 - beta * ys[2] / 2);
  const ry = ys.map((y, i) => -beta * xs[i] + alpha * y + beta * xs[2] / 2 + (1 - alpha) * ys[2] / 2);

  const dXtot = (rx[1] - rx[0] + rx[4] - rx[3]) / 2;
  const dYtot = (ry[3] - ry[0] + ry[4] - ry[1]) / 2;
  const dXnose = (rx[1] - rx[2] + rx[4] - rx[2]) / 2;
  const dYnose = (ry[3] - ry[2] + ry[4] - ry[2]) / 2;

  const yaw = dXtot !== 0 ? -90 + (90 / 0.5) * (dXnose / dXtot) : 0;
  const pitch = dYtot !== 0 ? -90 + (90 / 0.5) * (dYnose / dYtot) : 0;
  const roll = (angle * 180) / Math.PI;

  return [roll, pitch, yaw];
}
