/**
 * Thin wrapper around the globally-loaded MediaPipe `FaceMesh` solution.
 *
 * The vendor bundle (`static/js/face_mesh.js`) attaches `FaceMesh` to
 * `window`; this module hides that detail behind a small interface.
 *
 * @typedef {import('./geometry.js').Landmark} Landmark
 */

import { FACE_MESH_OPTIONS, MEDIAPIPE_ASSET_PATH } from './config.js';

/**
 * @typedef {(results: FaceMeshResults) => void} ResultsCallback
 */

/**
 * Subset of MediaPipe's results payload that we actually consume.
 * @typedef {{ multiFaceLandmarks?: Landmark[][] }} FaceMeshResults
 */

/**
 * @param {{ onResults: ResultsCallback }} options
 */
export function createFaceMeshDetector({ onResults }) {
  if (typeof window.FaceMesh !== 'function') {
    throw new Error('MediaPipe FaceMesh is not loaded — check the script order in index.html');
  }
  const faceMesh = new window.FaceMesh({
    locateFile: (file) => `${MEDIAPIPE_ASSET_PATH}/${file}`,
  });
  faceMesh.setOptions(FACE_MESH_OPTIONS);
  faceMesh.onResults(onResults);

  return {
    send(image) {
      return faceMesh.send({ image });
    },
    close() {
      faceMesh.close();
    },
  };
}
