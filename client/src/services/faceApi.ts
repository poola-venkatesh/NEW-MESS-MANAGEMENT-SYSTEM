import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads the face detection, landmark, and recognition neural network weights
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const MODEL_URL = '/models';
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log('✅ Face recognition neural models loaded successfully.');
    } catch (err) {
      console.error('Failed to load Face API models from /models:', err);
      // Fallback: try SSD MobileNet V1
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        modelsLoaded = true;
      } catch (fallbackErr) {
        throw new Error('Could not load face recognition neural models: ' + String(err));
      }
    }
  })();

  return loadPromise;
}

export interface DetectionResult {
  descriptor: number[];
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score: number;
  landmarks: any;
}

/**
 * Detects a single face in a video frame or canvas, and extracts its 128-D descriptor
 */
export async function detectFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult | null> {
  await loadFaceApiModels();

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
  });

  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
    score: detection.detection.score,
    landmarks: detection.landmarks,
  };
}

/**
 * Draw bounding box and quality visual feedback onto target canvas
 */
export function drawFaceFeedback(
  canvas: HTMLCanvasElement,
  displaySize: { width: number; height: number },
  detection: DetectionResult | null,
  statusText?: string
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (detection) {
    const { x, y, width, height } = detection.box;

    // Draw smooth targeting frame
    ctx.strokeStyle = '#22c55e'; // Green
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    // Corner guides
    const cornerLen = 15;
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLen, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerLen);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerLen, y + height);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLen, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerLen);
    ctx.stroke();

    // Face detected badge
    ctx.fillStyle = 'rgba(22, 101, 52, 0.85)';
    ctx.fillRect(x, Math.max(0, y - 24), 140, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Face OK (${Math.round(detection.score * 100)}%)`, x + 6, Math.max(14, y - 8));
  }

  if (statusText) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(10, 10, displaySize.width - 20, 28);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, displaySize.width / 2, 28);
    ctx.textAlign = 'start';
  }
}
