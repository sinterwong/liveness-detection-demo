/**
 * Application entry point.
 *
 * Wires the camera, MediaPipe FaceMesh detector, landmark renderer and
 * liveness state machine to the DOM controller. Bootstrap is single-shot
 * — re-running it would require recreating the camera and detector.
 */

import { ACTIONS } from './actions.js';
import { CameraCapture, CameraError } from './camera.js';
import { createFaceMeshDetector } from './face-mesh-detector.js';
import { createLandmarkRenderer } from './landmark-renderer.js';
import { LivenessDetector, Phase } from './liveness-detector.js';
import { MESSAGES } from './config.js';
import { UI } from './ui.js';

function bootstrap() {
  const video = /** @type {HTMLVideoElement | null} */ (document.getElementById('video'));
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('overlay'));
  const videoStage = document.getElementById('videoStage');
  if (!video || !canvas || !videoStage) {
    throw new Error('Missing required DOM nodes (video, overlay, videoStage)');
  }

  const ui = new UI();
  ui.renderActionList(ACTIONS);
  ui.setInstruction(MESSAGES.STARTING);

  const renderer = createLandmarkRenderer(canvas);
  const detector = createFaceMeshDetector({
    onResults: (results) => {
      const landmarks = results.multiFaceLandmarks?.[0] ?? null;
      if (window.__livenessDebug) {
        console.debug('[liveness] frame', {
          faceCount: results.multiFaceLandmarks?.length ?? 0,
          hasLandmarks: landmarks !== null,
          phase: liveness.phase,
        });
      }
      renderer.clear();
      if (landmarks) {
        renderer.draw(landmarks);
      }
      liveness.evaluate(landmarks);
    },
  });
  const liveness = new LivenessDetector(ACTIONS);
  const camera = new CameraCapture(video, { onFrame: (frame) => detector.send(frame) });

  // --- Liveness → UI bindings ---------------------------------------------

  liveness.on('phaseChanged', (phase) => {
    ui.setPhase(phase, liveness.currentAction?.prompt);
  });

  liveness.on('actionStarted', (action) => {
    ui.setActiveAction(action.id);
    ui.setPhase(Phase.PROMPTING, action.prompt);
  });

  liveness.on('actionCompleted', ({ action, byTimeout }) => {
    ui.markActionCompleted(action.id);
    ui.setCompletedCount(liveness.completedCount);
    ui.showToast(byTimeout ? '未识别，换一个动作试试' : '动作已识别');
  });

  liveness.on('allCompleted', () => {
    camera.stop();
  });

  // --- Camera start -------------------------------------------------------

  camera
    .start()
    .then(() => {
      renderer.resize(video.videoWidth, video.videoHeight);
      videoStage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      ui.showCameraReady();
      liveness.start();
    })
    .catch((err) => {
      const message = err instanceof CameraError ? err.message : MESSAGES.CAMERA_GENERIC_ERROR;
      ui.setInstruction(message);
      ui.showCameraError(message);
      console.error('Camera failed to start:', err);
    });

  // --- Cleanup on unload --------------------------------------------------

  window.addEventListener('pagehide', () => {
    camera.dispose();
    detector.close();
    liveness.dispose();
  });
}

bootstrap();
