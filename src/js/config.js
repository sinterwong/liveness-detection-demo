/**
 * Centralised configuration for the liveness demo.
 *
 * Paths, thresholds, timeouts and user-facing strings live here so the rest
 * of the code can stay free of magic numbers and stay easy to tune.
 */

export const MEDIAPIPE_ASSET_PATH = './resource';

export const FACE_MESH_OPTIONS = Object.freeze({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  useCpuInference: true,
});

export const CAMERA_CONSTRAINTS = Object.freeze({
  video: { facingMode: 'user' },
  audio: false,
});

export const TIMINGS = Object.freeze({
  WARMUP_MS: 1000,
  COOLDOWN_MS: 2000,
  ACTION_TIMEOUT_MS: 15000,
  TOAST_DURATION_MS: 1500,
  NO_FACE_GRACE_FRAMES: 20,
});

export const BLINK = Object.freeze({
  /** EAR below this counts as "eye closed". */
  CLOSED_EAR: 0.2,
  /** EAR must rise above this before the next blink can register. */
  OPEN_EAR: 0.25,
});

export const MOUTH = Object.freeze({
  /** MAR above this counts as "mouth open". */
  OPEN_MAR: 0.6,
  /** MAR must fall below this before the next open-mouth can register. */
  CLOSED_MAR: 0.4,
});

export const HEAD_POSE = Object.freeze({
  /** Yaw / pitch magnitude (degrees) to register as a shake / nod. */
  EXTREME_DEG: 30,
  /** Angle must return inside this deadband before a new movement can start. */
  NEUTRAL_DEG: 8,
});

export const HYSTERESIS_WINDOW = 3;

export const MESSAGES = Object.freeze({
  IDLE: '请将脸部对准画面',
  WARMUP: '正在准备…',
  COOLDOWN: '请稍候…',
  ALL_DONE: '验证完成，谢谢',
  CAMERA_DENIED: '无法访问摄像头，请授予权限后刷新页面',
  CAMERA_NOT_FOUND: '未检测到摄像头设备',
  CAMERA_GENERIC_ERROR: '摄像头启动失败',
  STARTING: '正在启动摄像头…',
  NO_FACE: '未检测到人脸，请正对屏幕',
});
