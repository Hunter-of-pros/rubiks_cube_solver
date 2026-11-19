import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Volume2Icon,
  VolumeXIcon,
} from './components/Icons';
import {
  fetchHealth,
  fetchRandomScramble,
  solveCubeState,
  validateCubeState,
} from './services/api';
import { SOLVED_FACELETS, buildPlaybackStates } from './utils/cube';
import { playCubeClick, playSolvedChime } from './utils/audio';

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
  const [soundMuted, setSoundMuted] = useState(false);

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

  const clearSolution = useCallback(() => {
    setSolveResult(null);
    setStepIndex(0);
    setIsPlaying(false);
  }, []);

  const runValidation = useCallback(async (nextFacelets) => {
    setApiError('');
    try {
      const res = await validateCubeState(nextFacelets);
      setValidation(res);
      return res;
    } catch (err) {
      setApiError(err.message);
      return null;
    }
  }, []);

  const handlePaintSticker = useCallback((globalIdx, color) => {
    const arr = facelets.split('');
    arr[globalIdx] = color;
    const next = arr.join('');
    setFacelets(next);
    clearSolution();
    playCubeClick(soundMuted);
    runValidation(next);
  }, [facelets, clearSolution, runValidation, soundMuted]);

  const handleScramble = useCallback(async () => {
    setApiError('');
    clearSolution();
    playCubeClick(soundMuted);
    try {
      const data = await fetchRandomScramble(20);
      setFacelets(data.facelets);
      setValidation({ valid: true, solved: false, error: '' });
    } catch (err) {
      setApiError(err.message);
    }
  }, [clearSolution, soundMuted]);

  const handleReset = useCallback(() => {
    clearSolution();
    setFacelets(SOLVED_FACELETS);
    setValidation({ valid: true, solved: true, error: '' });
    setApiError('');
    playCubeClick(soundMuted);
  }, [clearSolution, soundMuted]);

  const handleSolve = useCallback(async () => {
    setApiError('');
    setSolving(true);
    setIsPlaying(false);
    setStepIndex(0);
    try {
      const res = await solveCubeState(facelets, algorithm);
      setSolveResult(res);
      setValidation({ valid: res.valid, solved: res.solved, error: res.error });
      if (res.solved) {
        playSolvedChime(soundMuted);
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSolving(false);
    }
  }, [facelets, algorithm, soundMuted]);

  const handleApplyScanned = useCallback((scannedFacelets) => {
    clearSolution();
    setFacelets(scannedFacelets);
    setActiveTab('solve');
    runValidation(scannedFacelets);
    playCubeClick(soundMuted);
  }, [clearSolution, runValidation, soundMuted]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const movesCount = solveResult?.move_list?.length || 0;

      if (e.code === 'Space') {
        e.preventDefault();
        if (movesCount > 0) {
          if (stepIndex >= movesCount) setStepIndex(0);
          setIsPlaying((p) => !p);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (movesCount > 0 && stepIndex < movesCount) {
          setIsPlaying(false);
          setStepIndex((i) => i + 1);
          playCubeClick(soundMuted);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (movesCount > 0 && stepIndex > 0) {
          setIsPlaying(false);
          setStepIndex((i) => i - 1);
          playCubeClick(soundMuted);
        }
      } else if (e.code === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setStepIndex(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setStepIndex(movesCount);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleScramble();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setSoundMuted((m) => !m);
      } else if (e.key === '1') {
        setActiveTab('solve');
      } else if (e.key === '2') {
        setActiveTab('net');
      } else if (e.key === '3') {
        setActiveTab('camera');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [solveResult, stepIndex, handleScramble, handleReset, soundMuted]);

  const isOnline = health?.status === 'ok';

  return (
    <div className="studio-root">
      {/* Human Studio Header */}
      <header className="studio-header">
        <div className="header-brand">
          <div className="cube-mark">
            <CubeIcon size={20} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">Rubik</span>
            <span className="brand-tagline">Optimal Two-Phase Solver</span>
          </div>
        </div>

        {/* View Mode Navigation Switch */}
        <nav className="studio-nav" aria-label="Workspaces">
          <button
            type="button"
            className={`nav-btn ${activeTab === 'solve' ? 'active' : ''}`}
            onClick={() => setActiveTab('solve')}
            title="3D Cube Stage [1]"
          >
            <CubeIcon size={15} />
            <span>3D Stage</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeTab === 'net' ? 'active' : ''}`}
            onClick={() => setActiveTab('net')}
            title="2D Net Painter [2]"
          >
            <PaletteIcon size={15} />
            <span>2D Net</span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
            title="Webcam Scanner [3]"
          >
            <CameraIcon size={15} />
            <span>Webcam</span>
          </button>
        </nav>

        {/* Right Tools: State Actions & Sound */}
        <div className="header-actions">
          <button
            type="button"
            className="btn-quiet"
            onClick={handleScramble}
            title="Scramble cube [S]"
          >
            <ShuffleIcon size={14} />
            <span>Scramble</span>
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={handleReset}
            title="Reset to solved [R]"
          >
            <RotateCcwIcon size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className={`btn-icon-quiet ${soundMuted ? 'muted' : ''}`}
            onClick={() => setSoundMuted((m) => !m)}
            title={soundMuted ? 'Unmute haptic audio [M]' : 'Mute haptic audio [M]'}
          >
            {soundMuted ? <VolumeXIcon size={15} /> : <Volume2Icon size={15} />}
          </button>

          <div
            className={`connection-indicator ${isOnline ? 'online' : 'offline'}`}
            title={isOnline ? 'C++ Backend Connected on :8001' : 'Backend Offline'}
          >
            <span className="indicator-dot" />
            <span className="indicator-text">{isOnline ? 'Engine Ready' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* API Error Toast */}
      {apiError && (
        <div className="studio-alert" role="alert">
          <AlertCircleIcon size={16} />
          <span>{apiError}</span>
          <button type="button" className="alert-close" onClick={() => setApiError('')}>
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Arena */}
      <main className="studio-arena">
        {/* Workspace: Primary 3D Stage & Playback */}
        {activeTab === 'solve' && (
          <div className="stage-layout">
            <div className="stage-viewport">
              <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
            </div>

            <div className="stage-dock">
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
                soundMuted={soundMuted}
              />
            </div>
          </div>
        )}

        {/* Workspace: 2D Net Painter & Live 3D Preview */}
        {activeTab === 'net' && (
          <div className="split-workspace">
            <div className="workspace-column main-col">
              <CubeNetEditor
                facelets={displayedFacelets}
                activeColor={activeColor}
                onSelectColor={setActiveColor}
                onPaintSticker={handlePaintSticker}
                readOnly={Boolean(solveResult?.solved)}
                highlightFace={activeMove ? activeMove[0] : null}
              />
            </div>
            <div className="workspace-column side-col">
              <div className="live-preview-box">
                <div className="live-preview-label">Live 3D View</div>
                <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
              </div>
              <div className="side-solve-action">
                <button
                  type="button"
                  className="btn-solve-primary full-width"
                  disabled={solving}
                  onClick={() => {
                    setActiveTab('solve');
                    handleSolve();
                  }}
                >
                  Solve This Configuration &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace: Webcam Scanner & Live Preview */}
        {activeTab === 'camera' && (
          <div className="split-workspace">
            <div className="workspace-column main-col">
              <WebcamScanner onApplyScannedCube={handleApplyScanned} />
            </div>
            <div className="workspace-column side-col">
              <div className="live-preview-box">
                <div className="live-preview-label">Live 3D View</div>
                <Cube3DView facelets={displayedFacelets} activeMove={activeMove} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Minimalist Invariant Footer Bar */}
      <footer className="studio-footer">
        <div className="footer-invariant">
          {validation.valid ? (
            <span className="invariant-badge ok">
              <CheckCircleIcon size={13} />
              <span>
                {validation.solved ? 'Solved Identity State' : 'Physically Solvable'}
              </span>
            </span>
          ) : (
            <span className="invariant-badge error">
              <AlertCircleIcon size={13} />
              <span>{validation.error || 'Invalid Cube'}</span>
            </span>
          )}
        </div>

        <div className="footer-shortcuts">
          <span className="shortcut-item">
            <kbd className="key">Space</kbd> Play/Pause
          </span>
          <span className="shortcut-item">
            <kbd className="key">&larr;</kbd> <kbd className="key">&rarr;</kbd> Step
          </span>
          <span className="shortcut-item">
            <kbd className="key">S</kbd> Scramble
          </span>
          <span className="shortcut-item">
            <kbd className="key">R</kbd> Reset
          </span>
        </div>
      </footer>
    </div>
  );
}
