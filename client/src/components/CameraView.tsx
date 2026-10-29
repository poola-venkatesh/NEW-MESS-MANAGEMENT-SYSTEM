import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle, CheckCircle, VideoOff } from 'lucide-react';
import { loadFaceApiModels, detectFaceDescriptor, drawFaceFeedback, DetectionResult } from '../services/faceApi';

interface CameraViewProps {
  onCapture?: (descriptor: number[], qualityScore: number) => void;
  continuousVerify?: boolean;
  onContinuousMatch?: (descriptor: number[]) => void;
  statusMessage?: string;
  isProcessing?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onCapture,
  continuousVerify = false,
  onContinuousMatch,
  statusMessage,
  isProcessing = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    setCameraError(null);
    try {
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraError('Camera access requires a secure HTTPS connection. Please access this portal via the secure HTTPS URL.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API (getUserMedia) is not supported or is blocked. Ensure you are accessing via HTTPS.');
        return;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissionState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Enumerate camera devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setCameraError('Camera access denied. Please click the lock/settings icon in your browser URL bar and allow Camera permission.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. Please connect a webcam.');
      } else {
        setCameraError(err.message || 'Unable to open camera.');
      }
    }
  }, [selectedDeviceId, stream]);

  // Load models on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadFaceApiModels();
        if (mounted) setModelsLoading(false);
      } catch (err: any) {
        if (mounted) {
          setCameraError('Failed to load neural models: ' + err.message);
          setModelsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Start camera once mounted
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Frame processing loop
  useEffect(() => {
    let animationFrameId: number;
    let lastScanTime = 0;

    const processFrame = async () => {
      const now = Date.now();
      if (
        videoRef.current &&
        canvasRef.current &&
        !modelsLoading &&
        !isProcessing &&
        videoRef.current.readyState === 4 &&
        now - lastScanTime > 300 // scan every 300ms
      ) {
        lastScanTime = now;
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };

          const detection = await detectFaceDescriptor(video);
          setCurrentDetection(detection);

          if (detection) {
            // Assess quality: box size, position
            const faceRatio = detection.box.width / displaySize.width;
            if (faceRatio < 0.2) {
              setQualityWarning('Please move closer to the camera');
            } else if (detection.score < 0.6) {
              setQualityWarning('Low confidence. Face camera directly in good lighting');
            } else {
              setQualityWarning(null);
            }

            drawFaceFeedback(canvas, displaySize, detection, statusMessage);

            if (continuousVerify && onContinuousMatch && detection.score >= 0.7 && faceRatio >= 0.2) {
              onContinuousMatch(detection.descriptor);
            }
          } else {
            setQualityWarning('Position your face inside the camera view');
            drawFaceFeedback(canvas, displaySize, null, statusMessage || 'Looking for face...');
          }
        } catch (err) {
          // ignore transient frame detection errors
        }
      }
      animationFrameId = requestAnimationFrame(processFrame);
    };

    animationFrameId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [modelsLoading, isProcessing, continuousVerify, onContinuousMatch, statusMessage]);

  const handleManualCapture = () => {
    if (!currentDetection) {
      alert('No face detected. Please ensure your face is clearly visible.');
      return;
    }
    if (onCapture) {
      onCapture(currentDetection.descriptor, currentDetection.score);
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900 rounded-2xl p-4 shadow-xl text-white max-w-2xl mx-auto">
      {/* Camera Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-sm">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-slate-200">Device Camera Feed</span>
          {modelsLoading ? (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full animate-pulse">
              Loading AI Models...
            </span>
          ) : (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live AI Active
            </span>
          )}
        </div>

        {/* Camera Selector */}
        {devices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="bg-slate-800 text-xs text-slate-200 rounded px-2 py-1 border border-slate-700 outline-none"
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Video & Canvas Container */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100" // Mirror for natural selfie view
          onLoadedMetadata={() => videoRef.current?.play()}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
        />

        {/* Permission Denied Overlay */}
        {permissionState === 'denied' && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <VideoOff className="w-12 h-12 text-rose-500" />
            <div className="max-w-md">
              <h4 className="text-lg font-bold text-slate-100">Camera Access Blocked</h4>
              <p className="text-sm text-slate-400 mt-1">
                The browser camera permission was denied. To enable face recognition, grant camera access in your browser site permissions and click retry.
              </p>
            </div>
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Generic Camera Error Overlay */}
        {cameraError && permissionState !== 'denied' && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="text-sm text-slate-300 max-w-sm">{cameraError}</p>
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
            </button>
          </div>
        )}

        {/* Loading Spinner during server verification */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
            <span className="text-sm font-semibold text-emerald-300">
              Verifying Face Biometrics...
            </span>
          </div>
        )}
      </div>

      {/* Quality Feedback Bar */}
      <div className="w-full mt-3 flex items-center justify-between text-xs px-2">
        <div className="flex items-center space-x-2">
          {currentDetection ? (
            <span className="flex items-center text-emerald-400 gap-1 font-medium">
              <CheckCircle className="w-4 h-4" /> Face Detected (Score: {Math.round(currentDetection.score * 100)}%)
            </span>
          ) : (
            <span className="flex items-center text-slate-400 gap-1">
              <AlertCircle className="w-4 h-4 text-amber-400" /> No face in frame
            </span>
          )}

          {qualityWarning && (
            <span className="text-amber-400 font-medium ml-2">⚠️ {qualityWarning}</span>
          )}
        </div>

        {/* Manual Capture Button if not in continuous mode */}
        {onCapture && !continuousVerify && (
          <button
            onClick={handleManualCapture}
            disabled={!currentDetection || isProcessing || modelsLoading}
            className={`px-4 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              currentDetection && !isProcessing && !modelsLoading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Camera className="w-4 h-4" /> Capture Frame
          </button>
        )}
      </div>
    </div>
  );
};
