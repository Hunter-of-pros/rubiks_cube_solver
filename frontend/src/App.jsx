import React, { useEffect, useMemo, useState } from 'react';
import Cube3DView from './components/Cube3DView';
import CubeNetEditor from './components/CubeNetEditor';
import SolutionPlayback from './components/SolutionPlayback';
import WebcamScanner from './components/WebcamScanner';
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircleIcon,
  CubeIcon,
  PaletteIcon,
  RotateCcwIcon,
  ShuffleIcon,
} from './components/Icons';
import {
  fetchHealth,
  fetchRandomScramble,
  solveCubeState,
  validateCubeState,
} from './services/api';
import { SOLVED_FACELETS, buildPlaybackStates } from './utils/cube';

export default function App() {
  const [activeTab, setActiveTab] = useState('solve'); // 'solve' | 'net' | 'camera'
  const [facelets, setFacelets] = useState(SOLVED_FACELETS);
  const [activeColor, setActiveColor] = useState('W');
  const [health, setHealth] = useState(null);
  const [validation, setValidation] = useState({ valid: true, solved: true, error: '' });
  const [algorithm, setAlgorithm] = useState('kociemba');
  const [solving, setSolving] = useState(false);
  const [solveResult, setSolveResult] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(750);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }));
  }, []);

  const playbackStates = useMemo(() => {
    if (solveResult?.solved && solveResult.move_list?.length) {
      return buildPlaybackStates(facelets, solveResult.move_list);
    }
    return [facelets];
  }, [facelets, solveResult]);

  const displayedFacelets = playbackStates[stepIndex] || facelets;
  const activeMove =
    solveResult?.solved && stepIndex < (solveResult.move_list?.length || 0)
      ? solveResult.move_list[stepIndex]
      : '';

  const clearSolution = () => {
    setSolveResult(null);
    setStepIndex(0);
    setIsPlaying(false);
  };

  const runValidation = async (nextFacelets) => {
    setApiError('');
    try {
      const res = await validateCubeState(nextFacelets);
      setValidation(res);
      return res;
    } catch (err) {
      setApiError(err.message);
      return null;
    }
  };

  const handlePaintSticker = (globalIdx, color) => {
    const arr = facelets.split('');
    arr[globalIdx] = color;
    const next = arr.join('');
    setFacelets(next);
    clearSolution();
    runValidation(next);
  };

  const handleScramble = async () => {
    setApiError('');
    clearSolution();
    try {
      const data = await fetchRandomScramble(20);
      setFacelets(data.facelets);
      setValidation({ valid: true, solved: false, error: '' });
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleReset = () => {
    clearSolution();
    setFacelets(SOLVED_FACELETS);
    setValidation({ valid: true, solved: true, error: '' });
    setApiError('');
  };

  const handleSolve = async () => {
    setApiError('');
    setSolving(true);
    setIsPlaying(false);
    setStepIndex(0);
    try {
      const res = await solveCubeState(facelets, algorithm);
      setSolveResult(res);
      setValidation({ valid: res.valid, solved: res.solved, error: res.error });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSolving(false);
    }
  };

  const handleApplyScanned = (scannedFacelets) => {
    clearSolution();
    setFacelets(scannedFacelets);
    setActiveTab('solve');
    runValidation(scannedFacelets);
  };

  const isOnline = health?.status === 'ok';

  return (
    <div className="app-container">
      {/* Studio Header */}
      <header className="navbar">
        <div className="brand-group">
          <div className="brand-icon-wrap">
            <CubeIcon size={22} className="brand-icon" />
          </div>
          <div>
            <div className="brand-title">RUBIK STUDIO</div>
            <div className="brand-subtitle">C++ Kociemba Two-Phase &bull; Computer Vision</div>
          </div>
        </div>

        <div className="navbar-status">
          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            <span className="status-text">
              {isOnline ? 'C++ Solver Connected' : 'Backend Offline'}
            </span>
          </div>

          {health?.ml_model_loaded && (
            <div className="status-pill ml-pill">
              <span className="ml-dot" />
              <span className="status-text">ML Model: {health.ml_model_name.toUpperCase()}</span>
            </div>
          )}
        </div>
      </header>

      {/* Global API Error Toast */}
      {apiError && (
        <div className="global-alert-toast" role="alert">
          <AlertCircleIcon size={18} />
          <span>{apiError}</span>
          <button type="button" className="close-btn" onClick={() => setApiError('')}>
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Controls Strip */}
      <div className="studio-toolbar">
        {/* View Mode Segmented Switcher */}
        <div className="segmented-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'solve'}
            className={`segment-btn ${activeTab === 'solve' ? 'active' : ''}`}
            onClick={() => setActiveTab('solve')}
          >
            <CubeIcon size={15} />
            <span>3D Studio</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'net'}
            className={`segment-btn ${activeTab === 'net' ? 'active' : ''}`}
            onClick={() => setActiveTab('net')}
          >
            <PaletteIcon size={15} />
            <span>2D Net Painter</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'camera'}
            className={`segment-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            <CameraIcon size={15} />
            <span>Webcam Scanner</span>
          </button>
        </div>

        {/* Global Cube State Actions */}
        <div className="action-button-group">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleScramble}
            title="Generate random 20-move scramble"
          >
            <ShuffleIcon size={15} />
            <span>Random Scramble</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            title="Reset cube to solved identity state"
          >
            <RotateCcwIcon size={15} />
            <span>Reset Solved</span>
          </button>
        </div>
      </div>

      {/* Physical State Validation Indicator */}
      <div
        className={`validation-status-bar ${
          validation.valid
            ? validation.solved
              ? 'solved'
              : 'ready'
            : 'invalid'
        }`}
      >
        <div className="validation-status-content">
          {validation.valid ? (
            <CheckCircleIcon size={16} />
          ) : (
            <AlertCircleIcon size={16} />
          )}
          <span className="validation-text">
            {validation.valid
              ? validation.solved
                ? 'Cube state is physically valid and solved.'
                : 'Cube state is physically valid and ready to solve.'
              : `Physical invariant violation: ${validation.error}`}
          </span>
        </div>
        <button
          type="button"
          className="revalidate-link"
          onClick={() => runValidation(facelets)}
        >
          Check Invariants
        </button>
      </div>

      {/* Dynamic Studio Workspace Layout */}
      <main className="studio-workspace">
        {activeTab === 'solve' && (
          <div className="workspace-duo">
            <section className="viewport-panel">
              <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
            </section>
            <section className="controls-panel">
              <SolutionPlayback
                algorithm={algorithm}
                onChangeAlgorithm={setAlgorithm}
                onSolve={handleSolve}
                solving={solving}
                solveResult={solveResult}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                isPlaying={isPlaying}
                onTogglePlay={setIsPlaying}
                speedMs={speedMs}
                onChangeSpeed={setSpeedMs}
              />
            </section>
          </div>
        )}

        {activeTab === 'net' && (
          <div className="workspace-duo">
            <section className="viewport-panel">
              <CubeNetEditor
                facelets={displayedFacelets}
                activeColor={activeColor}
                onSelectColor={setActiveColor}
                onPaintSticker={handlePaintSticker}
                readOnly={Boolean(solveResult?.solved)}
                highlightFace={activeMove ? activeMove[0] : null}
              />
            </section>
            <section className="controls-panel">
              <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
              <SolutionPlayback
                algorithm={algorithm}
                onChangeAlgorithm={setAlgorithm}
                onSolve={handleSolve}
                solving={solving}
                solveResult={solveResult}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                isPlaying={isPlaying}
                onTogglePlay={setIsPlaying}
                speedMs={speedMs}
                onChangeSpeed={setSpeedMs}
              />
            </section>
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="workspace-duo">
            <section className="viewport-panel">
              <WebcamScanner onApplyScannedCube={handleApplyScanned} />
            </section>
            <section className="controls-panel">
              <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
              <SolutionPlayback
                algorithm={algorithm}
                onChangeAlgorithm={setAlgorithm}
                onSolve={handleSolve}
                solving={solving}
                solveResult={solveResult}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                isPlaying={isPlaying}
                onTogglePlay={setIsPlaying}
                speedMs={speedMs}
                onChangeSpeed={setSpeedMs}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
