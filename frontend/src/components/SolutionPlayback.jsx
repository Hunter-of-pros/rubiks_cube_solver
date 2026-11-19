import React, { useEffect, useRef } from 'react';
import { describeMove } from '../utils/cube';
import { playCubeClick, playSolvedChime } from '../utils/audio';
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
  { label: '0.4s', ms: 400 },
  { label: '0.7s', ms: 750 },
  { label: '1.2s', ms: 1200 },
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
  soundMuted = false,
}) {
  const moves = solveResult?.move_list || [];
  const totalSteps = moves.length;
  const activeMove = stepIndex < totalSteps ? moves[stepIndex] : '';
  const isSolvedAtEnd = stepIndex >= totalSteps && totalSteps > 0;
  const ribbonRef = useRef(null);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return undefined;
    if (stepIndex >= totalSteps) {
      onTogglePlay(false);
      playSolvedChime(soundMuted);
      return undefined;
    }
    const timer = setTimeout(() => {
      onStepChange(stepIndex + 1);
      playCubeClick(soundMuted);
    }, speedMs);
    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex, totalSteps, speedMs, onStepChange, onTogglePlay, soundMuted]);

  // Ribbon auto-scroll
  useEffect(() => {
    if (!ribbonRef.current) return;
    const activeElem = ribbonRef.current.querySelector('.move-chip.current');
    if (activeElem) {
      activeElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [stepIndex]);

  const handleStep = (nextIdx) => {
    onTogglePlay(false);
    onStepChange(nextIdx);
    playCubeClick(soundMuted);
    if (nextIdx >= totalSteps && totalSteps > 0) {
      playSolvedChime(soundMuted);
    }
  };

  return (
    <div className="playback-dock">
      {/* Solver Action Bar */}
      <div className="dock-action-bar">
        <div className="algo-selector-wrap">
          <select
            className="algo-selector"
            value={algorithm}
            onChange={(e) => onChangeAlgorithm(e.target.value)}
            disabled={solving}
            aria-label="Solver Algorithm"
          >
            <option value="kociemba">Kociemba Two-Phase (Sub-30ms)</option>
            <option value="ida-pdb">IDA* + Pattern Databases (Optimal)</option>
            <option value="ida-base">IDA* Baseline (Shallow)</option>
          </select>
        </div>

        <button
          type="button"
          className="btn-solve-primary"
          disabled={solving}
          onClick={onSolve}
        >
          <ZapIcon size={16} />
          <span>{solving ? 'Solving...' : 'Solve Cube'}</span>
        </button>
      </div>

      {solveResult && !solveResult.valid && (
        <div className="dock-status-msg error">
          <AlertCircleIcon size={16} />
          <span>{solveResult.error || 'Invalid cube configuration'}</span>
        </div>
      )}

      {solveResult && solveResult.valid && !solveResult.solved && (
        <div className="dock-status-msg error">
          <AlertCircleIcon size={16} />
          <span>{solveResult.error || 'Search exceeded depth limit'}</span>
        </div>
      )}

      {solveResult && solveResult.solved && (
        <div className="playback-panel">
          {/* Subtle Technical Telemetry Strip */}
          <div className="telemetry-bar">
            <span className="telemetry-item">
              <strong className="mono">{solveResult.solution_length}</strong> moves
            </span>
            <span className="telemetry-divider">&bull;</span>
            <span className="telemetry-item">
              <strong className="mono">{solveResult.elapsed_ms.toFixed(2)}</strong> ms
            </span>
            <span className="telemetry-divider">&bull;</span>
            <span className="telemetry-item">
              <strong className="mono">{solveResult.nodes_expanded.toLocaleString()}</strong> nodes
            </span>
            <span className="telemetry-divider">&bull;</span>
            <span className="telemetry-item">
              <strong className="mono">{(solveResult.memory_bytes / (1024 * 1024)).toFixed(1)}</strong> MB
            </span>
          </div>

          {totalSteps === 0 ? (
            <div className="dock-status-msg success">
              <CheckCircleIcon size={16} />
              <span>Cube is already solved.</span>
            </div>
          ) : (
            <>
              {/* Active Step Presentation */}
              <div className="hero-step-box">
                <div className="hero-step-badge">
                  <span className="hero-badge-tag">
                    {isSolvedAtEnd ? 'STATE' : `MOVE ${stepIndex + 1} OF ${totalSteps}`}
                  </span>
                  <span className="hero-badge-move mono">
                    {isSolvedAtEnd ? 'SOLVED' : activeMove}
                  </span>
                </div>

                <div className="hero-step-details">
                  <p className="hero-instruction">
                    {isSolvedAtEnd
                      ? 'Cube is fully restored to identity state.'
                      : describeMove(activeMove)}
                  </p>
                  <div className="timeline-scrubber">
                    <input
                      type="range"
                      min="0"
                      max={totalSteps}
                      value={stepIndex}
                      onChange={(e) => handleStep(Number(e.target.value))}
                      className="scrubber-slider"
                      aria-label="Solution Timeline Scrubber"
                    />
                    <div
                      className="scrubber-fill"
                      style={{ width: `${(stepIndex / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Media Controls Row */}
              <div className="transport-deck">
                <div className="transport-group">
                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex === 0}
                    onClick={() => handleStep(0)}
                    title="Jump to start [Home]"
                  >
                    <SkipBackIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex === 0}
                    onClick={() => handleStep(Math.max(0, stepIndex - 1))}
                    title="Previous move [Left Arrow]"
                  >
                    <StepBackIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="transport-btn-play"
                    onClick={() => {
                      if (stepIndex >= totalSteps) onStepChange(0);
                      onTogglePlay(!isPlaying);
                    }}
                    title={isPlaying ? 'Pause [Space]' : 'Play [Space]'}
                  >
                    {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex >= totalSteps}
                    onClick={() => handleStep(Math.min(totalSteps, stepIndex + 1))}
                    title="Next move [Right Arrow]"
                  >
                    <StepForwardIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    disabled={stepIndex >= totalSteps}
                    onClick={() => handleStep(totalSteps)}
                    title="Jump to end [End]"
                  >
                    <SkipForwardIcon size={15} />
                  </button>
                </div>

                <div className="speed-segmented">
                  {SPEED_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`speed-btn ${speedMs === p.ms ? 'active' : ''}`}
                      onClick={() => onChangeSpeed(p.ms)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Move Tape Ribbon */}
              <div className="move-tape" ref={ribbonRef}>
                {moves.map((move, idx) => {
                  const isPast = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <button
                      key={`${move}-${idx}`}
                      type="button"
                      className={`tape-chip mono ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                      onClick={() => handleStep(idx)}
                      title={`Jump to step ${idx + 1}: ${move}`}
                    >
                      <span className="chip-idx">{idx + 1}</span>
                      <span className="chip-code">{move}</span>
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
