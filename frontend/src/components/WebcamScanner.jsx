import React, { useEffect, useRef, useState } from 'react';
import { scanFaceBlob } from '../services/api';
import { COLORS, FACES, SCAN_PROMPTS, CANONICAL_FACE_CENTERS } from '../utils/cube';
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircleIcon,
  StepBackIcon,
  StepForwardIcon,
} from './Icons';

const CYCLE_COLORS = ['W', 'R', 'G', 'Y', 'O', 'B'];

export default function WebcamScanner({ onApplyScannedCube }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [useMl, setUseMl] = useState(true);
  const [autoScan, setAutoScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const [liveDetection, setLiveDetection] = useState(null);
  const [scannedFaces, setScannedFaces] = useState({});

  const activePrompt = SCAN_PROMPTS[promptIndex];
  const scannedCount = Object.keys(scannedFaces).length;

  const stopCamera = () => {
    setAutoScan(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(err.message || 'Could not access camera. Check browser permissions.');
    }
  };

  useEffect(() => () => stopCamera(), []);

  const captureFrameAndDetect = async (saveToFace = false) => {
    if (!videoRef.current || !canvasRef.current || busy) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const data = await scanFaceBlob(blob, { useMl });
      setLiveDetection(data);

      if (saveToFace) {
        const faceColors = [...data.colors];
        if (CANONICAL_FACE_CENTERS[activePrompt.code]) {
          faceColors[4] = CANONICAL_FACE_CENTERS[activePrompt.code];
        }
        setScannedFaces((prev) => ({
          ...prev,
          [activePrompt.code]: faceColors,
        }));
        if (promptIndex < SCAN_PROMPTS.length - 1) {
          setPromptIndex((i) => i + 1);
        }
      }
    } catch (err) {
      setCameraError(err.message || 'Scan processing failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoScan || !cameraActive) return undefined;
    const id = setInterval(() => {
      captureFrameAndDetect(false);
    }, 650);
    return () => clearInterval(id);
  });

  const cycleScannedSticker = (faceCode, stickerIdx) => {
    if (stickerIdx === 4) return; // Center sticker is physically fixed to the face
    setScannedFaces((prev) => {
      const current = prev[faceCode] || [];
      if (current.length !== 9) return prev;
      const nextColor =
        CYCLE_COLORS[(CYCLE_COLORS.indexOf(current[stickerIdx]) + 1) % CYCLE_COLORS.length];
      const updated = [...current];
      updated[stickerIdx] = nextColor;
      return { ...prev, [faceCode]: updated };
    });
  };

  const applyAllFacesToCube = () => {
    if (scannedCount < 6) return;
    const facelets = FACES.map((code) => scannedFaces[code].join('')).join('');
    onApplyScannedCube(facelets);
  };

  return (
    <div className="card scanner-card">
      <div className="card-header">
        <div className="header-meta">
          <span className="card-tag">Computer Vision</span>
          <h2 className="card-title">Webcam Scanner</h2>
        </div>
        <div className="scanner-header-actions">
          <label className="toggle-label" title="Enable calibrated k-NN classifier">
            <input
              type="checkbox"
              checked={useMl}
              onChange={(e) => setUseMl(e.target.checked)}
            />
            <span>ML Recognition</span>
          </label>

          {!cameraActive ? (
            <button type="button" className="btn-accent" onClick={startCamera}>
              <CameraIcon size={16} />
              <span>Start Camera</span>
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={stopCamera}>
              Stop Camera
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <div className="status-banner error">
          <AlertCircleIcon size={18} />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Guide Prompt Strip */}
      <div className="scanner-instruction-strip">
        <div className="instruction-step-pill">
          Face {promptIndex + 1} of 6: <strong>{activePrompt.label}</strong>
        </div>
        <p className="instruction-hint">{activePrompt.hint}</p>
      </div>

      {/* Camera Viewfinder Viewport */}
      <div className="viewfinder-container">
        <video ref={videoRef} autoPlay playsInline muted className="viewfinder-video" />
        <canvas ref={canvasRef} hidden />

        {!cameraActive && (
          <div className="viewfinder-placeholder">
            <CameraIcon size={48} className="placeholder-icon" />
            <p className="placeholder-title">Camera Inactive</p>
            <p className="placeholder-desc">
              Click Start Camera to align each cube face inside the targeting frame.
            </p>
          </div>
        )}

        {cameraActive && (
          <div className="viewfinder-reticle" aria-hidden="true">
            {/* Color-coded orientation neighbor bars */}
            <div
              className="neighbor-guide-bar neighbor-top"
              style={{ backgroundColor: COLORS[activePrompt.top].hex }}
              title={`Top neighbor: ${COLORS[activePrompt.top].name}`}
            />
            <div
              className="neighbor-guide-bar neighbor-bottom"
              style={{ backgroundColor: COLORS[activePrompt.bottom].hex }}
              title={`Bottom neighbor: ${COLORS[activePrompt.bottom].name}`}
            />
            <div
              className="neighbor-guide-bar neighbor-left"
              style={{ backgroundColor: COLORS[activePrompt.userLeft].hex }}
              title={`Left neighbor: ${COLORS[activePrompt.userLeft].name}`}
            />
            <div
              className="neighbor-guide-bar neighbor-right"
              style={{ backgroundColor: COLORS[activePrompt.userRight].hex }}
              title={`Right neighbor: ${COLORS[activePrompt.userRight].name}`}
            />

            {/* 3x3 Grid Overlay */}
            <div className="reticle-grid">
              {Array.from({ length: 9 }, (_, i) => {
                // Mirrored preview flips columns horizontally
                const rawIdx = Math.floor(i / 3) * 3 + (2 - (i % 3));
                const code = liveDetection?.colors?.[rawIdx];
                const conf = liveDetection?.confidences?.[rawIdx];
                const lowConf = conf !== undefined && conf < 0.6;

                return (
                  <div
                    key={i}
                    className={`reticle-cell ${lowConf ? 'low-confidence' : ''}`}
                  >
                    {code && (
                      <span
                        className="detected-badge"
                        style={{
                          backgroundColor: COLORS[code].hex,
                          color: COLORS[code].text,
                        }}
                      >
                        {code}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scanner Controls Toolbar */}
      <div className="scanner-action-toolbar">
        <button
          type="button"
          className="btn-accent"
          disabled={!cameraActive || busy}
          onClick={() => captureFrameAndDetect(true)}
        >
          <span>{busy ? 'Scanning...' : `Capture ${activePrompt.code} Face`}</span>
        </button>

        <button
          type="button"
          className={`btn-secondary ${autoScan ? 'active' : ''}`}
          disabled={!cameraActive}
          onClick={() => setAutoScan((v) => !v)}
        >
          {autoScan ? 'Pause Live Preview' : 'Live Preview'}
        </button>

        <div className="step-nav-buttons">
          <button
            type="button"
            className="btn-secondary icon-only"
            disabled={promptIndex === 0}
            onClick={() => setPromptIndex((i) => Math.max(0, i - 1))}
            title="Previous face"
          >
            <StepBackIcon size={16} />
          </button>
          <button
            type="button"
            className="btn-secondary icon-only"
            disabled={promptIndex === SCAN_PROMPTS.length - 1}
            onClick={() => setPromptIndex((i) => Math.min(SCAN_PROMPTS.length - 1, i + 1))}
            title="Next face"
          >
            <StepForwardIcon size={16} />
          </button>
        </div>
      </div>

      {/* Captured Faces Filmstrip */}
      <div className="filmstrip-section">
        <div className="filmstrip-header">
          <span className="filmstrip-title">
            Captured Faces ({scannedCount}/6)
          </span>
          <button
            type="button"
            className="btn-accent small"
            disabled={scannedCount < 6}
            onClick={applyAllFacesToCube}
          >
            <CheckCircleIcon size={14} />
            <span>Load Into Cube</span>
          </button>
        </div>

        <div className="filmstrip-grid">
          {SCAN_PROMPTS.map((p, idx) => {
            const cols = scannedFaces[p.code];
            const isCurrent = idx === promptIndex;
            return (
              <div
                key={p.code}
                className={`filmstrip-tile ${isCurrent ? 'active' : ''} ${cols ? 'captured' : ''}`}
              >
                <button
                  type="button"
                  className="filmstrip-tile-header"
                  onClick={() => setPromptIndex(idx)}
                >
                  <span className="filmstrip-code">{p.code}</span>
                  {cols ? (
                    <span className="check-badge">✓</span>
                  ) : (
                    <span className="empty-badge">Empty</span>
                  )}
                </button>

                <div className="filmstrip-thumb">
                  {Array.from({ length: 9 }, (_, sIdx) => {
                    const c = cols ? cols[sIdx] : null;
                    return (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={!cols}
                        className="thumb-sticker"
                        style={{
                          backgroundColor: c ? COLORS[c].hex : '#181c27',
                          color: c ? COLORS[c].text : '#64748b',
                        }}
                        onClick={() => cycleScannedSticker(p.code, sIdx)}
                        title={cols ? 'Click to cycle color' : 'Uncaptured'}
                      >
                        {c || ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
