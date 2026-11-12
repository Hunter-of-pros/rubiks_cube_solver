import React, { useEffect, useMemo, useState } from 'react';
import Cube3DView from './components/Cube3DView';
import CubeNetEditor from './components/CubeNetEditor';
import SolutionPlayback from './components/SolutionPlayback';
import WebcamScanner from './components/WebcamScanner';
import {
  fetchHealth,
  fetchRandomScramble,
  solveCubeState,
  validateCubeState,
} from './services/api';
import { SOLVED_FACELETS, buildPlaybackStates } from './utils/cube';

export default function App() {
  const [inputMode, setInputMode] = useState('manual');
  const [facelets, setFacelets] = useState(SOLVED_FACELETS);
  const [activeColor, setActiveColor] = useState('W');
  const [health, setHealth] = useState(null);
  const [validation, setValidation] = useState({ valid: true, solved: true, error: '' });
  const [algorithm, setAlgorithm] = useState('kociemba');
  const [solving, setSolving] = useState(false);
  const [solveResult, setSolveResult] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(700);
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
    setInputMode('manual');
    runValidation(scannedFacelets);
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Rubik&apos;s Cube Solver</h1>
          <p className="muted">C++ Search Engine • OpenCV + ML Vision • FastAPI + React</p>
        </div>
        <div className="status-pills">
          <span className={`pill ${health?.status === 'ok' ? 'pill-ok' : 'pill-warn'}`}>
            API: {health?.status === 'ok' ? 'Connected' : 'Start FastAPI on :8000'}
          </span>
          {health?.ml_model_loaded && (
            <span className="pill pill-ok">ML: {health.ml_model_name}</span>
          )}
        </div>
      </header>

      {apiError && <div className="alert alert-error">{apiError}</div>}

      <div className="toolbar">
        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${inputMode === 'manual' ? 'active' : ''}`}
            onClick={() => setInputMode('manual')}
          >
            Manual Editor
          </button>
          <button
            type="button"
            className={`tab-btn ${inputMode === 'webcam' ? 'active' : ''}`}
            onClick={() => setInputMode('webcam')}
          >
            Webcam Scanner
          </button>
        </div>

        <div className="controls-row">
          <button type="button" className="btn-ghost" onClick={handleScramble}>
            Random Scramble
          </button>
          <button type="button" className="btn-ghost" onClick={handleReset}>
            Reset Solved
          </button>
          <button type="button" className="btn-ghost" onClick={() => runValidation(facelets)}>
            Validate
          </button>
        </div>
      </div>

      <div className={`validation-banner ${validation.valid ? 'valid' : 'invalid'}`}>
        {validation.valid
          ? validation.solved
            ? 'Cube state is valid and already solved.'
            : 'Cube state is physically valid and ready to solve.'
          : `Invalid cube state: ${validation.error}`}
      </div>

      <main className="workspace-grid">
        <section className="left-col">
          {inputMode === 'manual' ? (
            <CubeNetEditor
              facelets={displayedFacelets}
              activeColor={activeColor}
              onSelectColor={setActiveColor}
              onPaintSticker={handlePaintSticker}
              readOnly={Boolean(solveResult?.solved)}
              highlightFace={activeMove ? activeMove[0] : null}
            />
          ) : (
            <WebcamScanner onApplyScannedCube={handleApplyScanned} />
          )}
        </section>

        <section className="right-col">
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
      </main>
    </div>
  );
}
