/**
 * Canvas-based renderer for face-mesh landmarks.
 *
 * Drawing styles are kept in a small table so the call site is
 * declarative. The vendor `drawConnectors` and `FACEMESH_*` constants
 * are provided as globals by `static/js/drawing_utils.js` and
 * `static/js/face_mesh.js` respectively.
 *
 * @typedef {import('./geometry.js').Landmark} Landmark
 */

/** @type {ReadonlyArray<{ connections: number[][], color: string, lineWidth?: number }>} */
const STYLES = Object.freeze([
  { connections: window.FACEMESH_TESSELATION, color: '#C0C0C070', lineWidth: 1 },
  { connections: window.FACEMESH_RIGHT_EYE, color: '#FF3030' },
  { connections: window.FACEMESH_RIGHT_EYEBROW, color: '#FF3030' },
  { connections: window.FACEMESH_RIGHT_IRIS, color: '#FF3030' },
  { connections: window.FACEMESH_LEFT_EYE, color: '#30FF30' },
  { connections: window.FACEMESH_LEFT_EYEBROW, color: '#30FF30' },
  { connections: window.FACEMESH_LEFT_IRIS, color: '#30FF30' },
  { connections: window.FACEMESH_FACE_OVAL, color: '#E0E0E0' },
  { connections: window.FACEMESH_LIPS, color: '#E0E0E0' },
]);

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createLandmarkRenderer(canvas) {
  if (typeof window.drawConnectors !== 'function') {
    throw new Error('MediaPipe drawing_utils is not loaded — check the script order in index.html');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  return {
    /** Resize the drawing buffer so coordinates map 1:1 to the video frame. */
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    /** @param {Landmark[]} landmarks */
    draw(landmarks) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const style of STYLES) {
        window.drawConnectors(ctx, landmarks, style.connections, {
          color: style.color,
          lineWidth: style.lineWidth,
        });
      }
    },
  };
}
