import React, { useEffect, useRef } from 'react';
import { describeMove } from '../utils/cube';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  StepBackIcon,
  StepForwardIcon,
  ZapIcon,
} from './Icons';

const SPEED_PRESETS = [
  { label: 'Fast', ms: 400 },
  { label: 'Normal', ms: 750 },
  { label: 'Slow', ms: 1200 },
];

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
  const isSolvedAtEnd = stepIndex >= totalSteps && totalSteps > 0;
  const ribbonRef = useRef(null);

  // Auto-step timer
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

  // Auto-scroll ribbon to keep active move visible
  useEffect(() => {
    if (!ribbonRef.current) return;
    const activeElem = ribbonRef.current.querySelector('.move-chip.current');
    if (activeElem) {
      activeElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [stepIndex]);

  return (
    <div className="card playback-card">
      <div className="card-header">
        <div className="header-meta">
          <span className="card-tag">Search &amp; Playback</span>
          <h2 className="card-title">Solution Engine</h2>
        </div>
        <div className="solve-action-group">
          <select
            className="algo-select"
            value={algorithm}
            onChange={(e) => onChangeAlgorithm(e.target.value)}
            aria-label="Solver algorithm"
            disabled={solving}
          >
            <option value="kociemba">Kociemba Two-Phase (Fastest)</option>
            <option value="ida-pdb">IDA* + Pattern DB (Optimal)</option>
            <option value="ida-base">IDA* Baseline (Shallow)</option>
          </select>

          <button
            type="button"
            className="btn-accent"
            disabled={solving}
            onClick={onSolve}
          >
            <ZapIcon size={15} />
            <span>{solving ? 'Solving...' : 'Solve'}</span>
          </button>
        </div>
      </div>

      {solveResult && !solveResult.valid && (
        <div className="status-banner error">
          <AlertCircleIcon size={18} />
          <span>{solveResult.error || 'Invalid cube configuration'}</span>
        </div>
      )}

      {solveResult && solveResult.valid && !solveResult.solved && (
        <div className="status-banner error">
          <AlertCircleIcon size={18} />
          <span>{solveResult.error || 'Search reached limit before finding solution'}</span>
        </div>
      )}

      {solveResult && solveResult.solved && (
        <div className="playback-body">
          {/* Executive Metrics Grid */}
          <div className="metrics-grid">
            <div className="metric-tile">
              <span className="metric-value">{solveResult.solution_length}</span>
              <span className="metric-label">Moves (HTM)</span>
            </div>
            <div className="metric-tile">
              <span className="metric-value">{solveResult.elapsed_ms.toFixed(2)}</span>
              <span className="metric-label">Runtime (ms)</span>
            </div>
            <div className="metric-tile">
              <span className="metric-value">
                {solveResult.nodes_expanded.toLocaleString()}
              </span>
              <span className="metric-label">Nodes Explored</span>
            </div>
            <div className="metric-tile">
              <span className="metric-value">
                {(solveResult.memory_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              <span className="metric-label">Memory Footprint</span>
            </div>
          </div>

          {totalSteps === 0 ? (
            <div className="status-banner success">
              <CheckCircleIcon size={18} />
              <span>Cube is already solved! No moves required.</span>
            </div>
          ) : (
            <>
              {/* Active Step Hero Banner */}
              <div className="active-step-card">
                <div className="step-badge-col">
                  <span className="step-counter">
                    {isSolvedAtEnd ? 'SOLVED' : `STEP ${stepIndex + 1} / ${totalSteps}`}
                  </span>
                  <span className="step-move-callout">
                    {isSolvedAtEnd ? '✓' : activeMove}
                  </span>
                </div>
                <div className="step-info-col">
                  <p className="step-instruction-text">
                    {isSolvedAtEnd
                      ? 'Cube is fully restored to its solved state.'
                      : describeMove(activeMove)}
                  </p>
                  <div className="step-progress-track">
                    <div
                      className="step-progress-fill"
                      style={{ width: `${(stepIndex / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Media Transport Controls */}
              <div className="transport-row">
                <div className="transport-controls">
                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex === 0}
                    onClick={() => {
                      onTogglePlay(false);
                      onStepChange(0);
                    }}
                    title="Jump to start"
                  >
                    <SkipBackIcon size={16} />
                  </button>

                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex === 0}
                    onClick={() => {
                      onTogglePlay(false);
                      onStepChange(Math.max(0, stepIndex - 1));
                    }}
                    title="Previous move"
                  >
                    <StepBackIcon size={16} />
                  </button>

                  <button
                    type="button"
                    className="transport-btn-hero"
                    onClick={() => {
                      if (stepIndex >= totalSteps) onStepChange(0);
                      onTogglePlay(!isPlaying);
                    }}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                  </button>

                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex >= totalSteps}
                    onClick={() => {
                      onTogglePlay(false);
                      onStepChange(Math.min(totalSteps, stepIndex + 1));
                    }}
                    title="Next move"
                  >
                    <StepForwardIcon size={16} />
                  </button>

                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex >= totalSteps}
                    onClick={() => {
                      onTogglePlay(false);
                      onStepChange(totalSteps);
                    }}
                    title="Jump to end"
                  >
                    <SkipForwardIcon size={16} />
                  </button>
                </div>

                <div className="speed-pills">
                  {SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`speed-pill ${speedMs === preset.ms ? 'active' : ''}`}
                      onClick={() => onChangeSpeed(preset.ms)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Scrollable Move Ribbon */}
              <div className="move-ribbon" ref={ribbonRef}>
                {moves.map((move, idx) => {
                  const isPast = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <button
                      key={`${move}-${idx}`}
                      type="button"
                      className={`move-chip ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                      onClick={() => {
                        onTogglePlay(false);
                        onStepChange(idx);
                      }}
                      title={`Jump to step ${idx + 1}: ${move}`}
                    >
                      <span className="move-chip-index">{idx + 1}</span>
                      <span className="move-chip-name">{move}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
