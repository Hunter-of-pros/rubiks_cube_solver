import React, { useEffect } from 'react';
import { describeMove } from '../utils/cube';

export default function SolutionPlayback({
  algorithm,
  onChangeAlgorithm,
  onSolve,
  solving,
  solveResult,
  stepIndex,
  onStepChange,
  isPlaying,
  onTogglePlay,
  speedMs,
  onChangeSpeed,
}) {
  const moves = solveResult?.move_list || [];
  const totalSteps = moves.length;
  const activeMove = stepIndex < totalSteps ? moves[stepIndex] : '';

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (stepIndex >= totalSteps) {
      onTogglePlay(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      onStepChange(stepIndex + 1);
    }, speedMs);
    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex, totalSteps, speedMs, onStepChange, onTogglePlay]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Solver &amp; Playback</h2>
        <div className="controls-row">
          <select
            value={algorithm}
            onChange={(e) => onChangeAlgorithm(e.target.value)}
            aria-label="Solver algorithm"
          >
            <option value="kociemba">Kociemba Two-Phase</option>
            <option value="ida-pdb">IDA* + Pattern DB</option>
            <option value="ida-base">IDA* Baseline (shallow)</option>
          </select>
          <button type="button" className="btn-primary" disabled={solving} onClick={onSolve}>
            {solving ? 'Solving...' : 'Solve Cube'}
          </button>
        </div>
      </div>

      {solveResult && !solveResult.valid && (
        <div className="alert alert-error">{solveResult.error}</div>
      )}

      {solveResult && solveResult.valid && !solveResult.solved && (
        <div className="alert alert-error">{solveResult.error || 'Solver did not finish'}</div>
      )}

      {solveResult && solveResult.solved && (
        <>
          <div className="metrics-strip">
            <span>
              <strong>{solveResult.solution_length}</strong> moves
            </span>
            <span>
              <strong>{solveResult.nodes_expanded.toLocaleString()}</strong> nodes
            </span>
            <span>
              <strong>{solveResult.elapsed_ms.toFixed(2)}</strong> ms
            </span>
            <span>
              <strong>{(solveResult.memory_bytes / (1024 * 1024)).toFixed(2)}</strong> MB
            </span>
          </div>

          {totalSteps === 0 ? (
            <div className="alert alert-ok">Cube is already solved!</div>
          ) : (
            <>
              <div className="playback-controls">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    onTogglePlay(false);
                    onStepChange(0);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={stepIndex === 0}
                  onClick={() => {
                    onTogglePlay(false);
                    onStepChange(Math.max(0, stepIndex - 1));
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (stepIndex >= totalSteps) onStepChange(0);
                    onTogglePlay(!isPlaying);
                  }}
                >
                  {isPlaying ? 'Pause' : stepIndex >= totalSteps ? 'Replay' : 'Play'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={stepIndex >= totalSteps}
                  onClick={() => {
                    onTogglePlay(false);
                    onStepChange(Math.min(totalSteps, stepIndex + 1));
                  }}
                >
                  Next
                </button>
                <label className="speed-control">
                  <span>{(speedMs / 1000).toFixed(1)}s</span>
                  <input
                    type="range"
                    min="250"
                    max="1800"
                    step="150"
                    value={speedMs}
                    onChange={(e) => onChangeSpeed(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="step-instruction">
                {stepIndex < totalSteps ? (
                  <>
                    Step {stepIndex + 1} of {totalSteps}: <strong>{activeMove}</strong> —{' '}
                    {describeMove(activeMove)}
                  </>
                ) : (
                  <strong>Solved! All {totalSteps} moves complete.</strong>
                )}
              </div>

              <div className="move-pills">
                {moves.map((m, idx) => (
                  <button
                    key={`${m}-${idx}`}
                    type="button"
                    className={`move-pill ${
                      idx === stepIndex ? 'current' : idx < stepIndex ? 'done' : ''
                    }`}
                    onClick={() => {
                      onTogglePlay(false);
                      onStepChange(idx);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
