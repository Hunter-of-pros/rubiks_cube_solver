import React, { useRef, useState } from 'react';
import { COLORS } from '../utils/cube';

const FACE_TRANSFORMS = [
  { code: 'F', offset: 18, transform: 'rotateY(0deg) translateZ(84px)' },
  { code: 'R', offset: 9, transform: 'rotateY(90deg) translateZ(84px)' },
  { code: 'B', offset: 45, transform: 'rotateY(180deg) translateZ(84px)' },
  { code: 'L', offset: 36, transform: 'rotateY(-90deg) translateZ(84px)' },
  { code: 'U', offset: 0, transform: 'rotateX(90deg) translateZ(84px)' },
  { code: 'D', offset: 27, transform: 'rotateX(-90deg) translateZ(84px)' },
];

export default function Cube3DView({ facelets, activeMove = '' }) {
  const [rotX, setRotX] = useState(-26);
  const [rotY, setRotY] = useState(-34);
  const dragRef = useRef(null);

  const activeFace = activeMove ? activeMove[0] : null;
  const activeBadge = activeMove
    ? activeMove.endsWith('2')
      ? '180°'
      : activeMove.endsWith("'")
        ? '↺'
        : '↻'
    : '';

  const handlePointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, rotX, rotY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setRotY(dragRef.current.rotY + dx * 0.6);
    setRotX(Math.max(-85, Math.min(85, dragRef.current.rotX - dy * 0.6)));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>3D Cube View</h2>
        <div className="view-presets">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setRotX(-26);
              setRotY(-34);
            }}
          >
            Front / Top
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setRotX(25);
              setRotY(145);
            }}
          >
            Back / Bottom
          </button>
        </div>
      </div>

      <div
        className="cube-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="cube-3d"
          style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
        >
          {FACE_TRANSFORMS.map(({ code, offset, transform }) => {
            const isHighlighted = activeFace === code;
            return (
              <div
                key={code}
                className={`cube-3d-face ${isHighlighted ? 'cube-3d-face-active' : ''}`}
                style={{ transform }}
              >
                {Array.from({ length: 9 }, (_, i) => {
                  const colorCode = facelets[offset + i] || 'W';
                  const info = COLORS[colorCode] || COLORS.W;
                  return (
                    <div
                      key={i}
                      className="cube-3d-sticker"
                      style={{ backgroundColor: info.hex, color: info.text }}
                    >
                      {i === 4 ? (isHighlighted ? activeBadge : code) : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="muted center-text">Drag cube to rotate in 3D</p>
    </div>
  );
}
