import React, { useRef, useState } from 'react';
import { COLORS } from '../utils/cube';
import { RotateCcwIcon } from './Icons';

// Cube width = 216px, half-width = 108px
const CUBE_SIZE = 216;
const HALF_SIZE = CUBE_SIZE / 2;

const FACE_CONFIGS = [
  { code: 'F', offset: 18, name: 'Front', transform: `rotateY(0deg) translateZ(${HALF_SIZE}px)`, light: 1.02 },
  { code: 'R', offset: 9, name: 'Right', transform: `rotateY(90deg) translateZ(${HALF_SIZE}px)`, light: 0.96 },
  { code: 'B', offset: 45, name: 'Back', transform: `rotateY(180deg) translateZ(${HALF_SIZE}px)`, light: 0.80 },
  { code: 'L', offset: 36, name: 'Left', transform: `rotateY(-90deg) translateZ(${HALF_SIZE}px)`, light: 0.86 },
  { code: 'U', offset: 0, name: 'Top', transform: `rotateX(90deg) translateZ(${HALF_SIZE}px)`, light: 1.08 },
  { code: 'D', offset: 27, name: 'Bottom', transform: `rotateX(-90deg) translateZ(${HALF_SIZE}px)`, light: 0.74 },
];

export default function Cube3DView({ facelets, activeMove = '' }) {
  const [rotX, setRotX] = useState(-24);
  const [rotY, setRotY] = useState(-32);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const activeFace = activeMove ? activeMove[0] : null;
  const isDouble = activeMove?.endsWith('2');
  const isPrime = activeMove?.endsWith("'");

  const handlePointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, rotX, rotY };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    // Rotate smoothly with natural sensitivity
    setRotY(dragRef.current.rotY + dx * 0.55);
    setRotX(Math.max(-85, Math.min(85, dragRef.current.rotX - dy * 0.55)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <div className="card cube-3d-card">
      <div className="card-header">
        <div className="header-meta">
          <span className="card-tag">3D Studio</span>
          <h2 className="card-title">Interactive View</h2>
        </div>
        <div className="preset-chip-group">
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              setRotX(-24);
              setRotY(-32);
            }}
            title="Front, Top, and Right view"
          >
            Isometric
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              setRotX(28);
              setRotY(148);
            }}
            title="Back, Bottom, and Left view"
          >
            Reverse
          </button>
          <button
            type="button"
            className="chip-btn icon-only"
            onClick={() => {
              setRotX(-24);
              setRotY(-32);
            }}
            title="Reset view orientation"
          >
            <RotateCcwIcon size={14} />
          </button>
        </div>
      </div>

      <div
        className={`cube-viewport ${isDragging ? 'dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {activeMove && (
          <div className="active-move-hud" role="status">
            <span className="hud-move-badge">{activeMove}</span>
            <span className="hud-move-desc">
              {isDouble ? '180° Half Turn' : isPrime ? '90° Counter-Clockwise' : '90° Clockwise'}
            </span>
          </div>
        )}

        <div className="cube-scene">
          <div
            className="cube-3d"
            style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
          >
            {FACE_CONFIGS.map(({ code, offset, transform, light, name }) => {
              const isTurnActive = activeFace === code;
              return (
                <div
                  key={code}
                  className={`cube-face ${isTurnActive ? 'face-highlighted' : ''}`}
                  style={{
                    transform,
                    filter: `brightness(${light})`,
                  }}
                  data-face={code}
                >
                  {Array.from({ length: 9 }, (_, i) => {
                    const colorCode = facelets[offset + i] || 'W';
                    const colorInfo = COLORS[colorCode] || COLORS.W;
                    const isCenter = i === 4;

                    return (
                      <div
                        key={i}
                        className={`cube-sticker ${isCenter ? 'center-sticker' : ''}`}
                        style={{
                          backgroundColor: colorInfo.hex,
                          color: colorInfo.text,
                        }}
                      >
                        {isCenter && (
                          <span className="center-glyph" title={`${name} face center`}>
                            {code === 'U' ? '●' : code}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="cube-floor-shadow" aria-hidden="true" />
        </div>

        <div className="viewport-hint">
          <span>Click &amp; drag to rotate in 3D</span>
        </div>
      </div>
    </div>
  );
}
