import React, { useEffect, useRef, useState } from 'react';
import { scanFaceBlob } from '../services/api';
import { COLORS, FACES, SCAN_PROMPTS } from '../utils/cube';

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
      setCameraError(err.message || 'Could not access webcam');
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
        setScannedFaces((prev) => ({
          ...prev,
          [activePrompt.code]: data.colors,
        }));
        if (promptIndex < SCAN_PROMPTS.length - 1) {
          setPromptIndex((i) => i + 1);
        }
      }
    } catch (err) {
      setCameraError(err.message || 'Scan request failed');
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
    <div className="panel">
      <div className="panel-header">
        <h2>Webcam Scanner</h2>
        <div className="controls-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useMl}
              onChange={(e) => setUseMl(e.target.checked)}
            />
            Use ML model
          </label>
          {!cameraActive ? (
            <button type="button" className="btn-primary" onClick={startCamera}>
              Start Camera
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={stopCamera}>
              Stop Camera
            </button>
          )}
        </div>
      </div>

      {cameraError && <div className="alert alert-error">{cameraError}</div>}

      <div className="scanner-prompt">
        <div className="prompt-title">
          Step {promptIndex + 1}/6 — <strong>{activePrompt.label}</strong>
        </div>
        <div className="muted">{activePrompt.hint}</div>
      </div>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted className="video-mirrored" />
        <canvas ref={canvasRef} hidden />

        <div className="guide-overlay" aria-hidden="true">
          <div
            className="neighbor-bar neighbor-top"
            style={{ backgroundColor: COLORS[activePrompt.top].hex }}
          />
          <div
            className="neighbor-bar neighbor-bottom"
            style={{ backgroundColor: COLORS[activePrompt.bottom].hex }}
          />
          <div
            className="neighbor-bar neighbor-left"
            style={{ backgroundColor: COLORS[activePrompt.userLeft].hex }}
          />
          <div
            className="neighbor-bar neighbor-right"
            style={{ backgroundColor: COLORS[activePrompt.userRight].hex }}
          />
          <div className="guide-grid">
            {Array.from({ length: 9 }, (_, i) => {
              // Mirrored preview flips col 0 <-> 2 visually to match user's hands.
              const rawIdx = Math.floor(i / 3) * 3 + (2 - (i % 3));
              const code = liveDetection?.colors?.[rawIdx];
              const conf = liveDetection?.confidences?.[rawIdx];
              const lowConf = conf !== undefined && conf < 0.55;
              return (
                <div key={i} className={`guide-cell ${lowConf ? 'low-conf' : ''}`}>
                  {code && (
                    <span
                      className="live-badge"
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
      </div>

      <div className="controls-row wrap">
        <button
          type="button"
          className="btn-primary"
          disabled={!cameraActive || busy}
          onClick={() => captureFrameAndDetect(true)}
        >
          Capture {activePrompt.code} Face
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!cameraActive}
          onClick={() => setAutoScan((v) => !v)}
        >
          {autoScan ? 'Pause Live Preview' : 'Live Preview'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={promptIndex === 0}
          onClick={() => setPromptIndex((i) => Math.max(0, i - 1))}
        >
          Prev Face
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={promptIndex === SCAN_PROMPTS.length - 1}
          onClick={() => setPromptIndex((i) => Math.min(SCAN_PROMPTS.length - 1, i + 1))}
        >
          Next Face
        </button>
      </div>

      {liveDetection && (
        <div className="muted small-note">
          Classifier: <code>{liveDetection.classifier_used}</code> | Min confidence:{' '}
          {(liveDetection.min_confidence * 100).toFixed(0)}%
        </div>
      )}

      <div className="scanned-summary">
        <div className="panel-header">
          <span>Captured Faces ({scannedCount}/6) — click any sticker to adjust</span>
          <button
            type="button"
            className="btn-primary"
            disabled={scannedCount < 6}
            onClick={applyAllFacesToCube}
          >
            Load Into Cube
          </button>
        </div>
        <div className="scanned-faces-row">
          {SCAN_PROMPTS.map((p, idx) => {
            const cols = scannedFaces[p.code];
            return (
              <div
                key={p.code}
                className={`mini-face ${idx === promptIndex ? 'mini-face-active' : ''}`}
              >
                <button
                  type="button"
                  className="mini-face-title"
                  onClick={() => setPromptIndex(idx)}
                >
                  {p.code} {cols ? '✓' : ''}
                </button>
                <div className="mini-grid">
                  {Array.from({ length: 9 }, (_, sIdx) => {
                    const c = cols ? cols[sIdx] : null;
                    return (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={!cols}
                        className="mini-cell"
                        style={{
                          backgroundColor: c ? COLORS[c].hex : '#1e293b',
                          color: c ? COLORS[c].text : '#64748b',
                        }}
                        onClick={() => cycleScannedSticker(p.code, sIdx)}
                        title={cols ? 'Click to cycle color' : 'Not captured yet'}
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
