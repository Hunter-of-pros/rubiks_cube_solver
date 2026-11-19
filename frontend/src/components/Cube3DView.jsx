import React, { useEffect, useState } from 'react';
import Cube3DWebGL from './Cube3DWebGL';
import { COLORS } from '../utils/cube';

// WebGL availability check
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const CUBE_SIZE = 216;
const HALF_SIZE = CUBE_SIZE / 2;

const CSS_FACES = [
  { code: 'F', offset: 18, transform: `rotateY(0deg) translateZ(${HALF_SIZE}px)`, light: 1.02 },
  { code: 'R', offset: 9, transform: `rotateY(90deg) translateZ(${HALF_SIZE}px)`, light: 0.96 },
  { code: 'B', offset: 45, transform: `rotateY(180deg) translateZ(${HALF_SIZE}px)`, light: 0.80 },
  { code: 'L', offset: 36, transform: `rotateY(-90deg) translateZ(${HALF_SIZE}px)`, light: 0.86 },
  { code: 'U', offset: 0, transform: `rotateX(90deg) translateZ(${HALF_SIZE}px)`, light: 1.08 },
  { code: 'D', offset: 27, transform: `rotateX(-90deg) translateZ(${HALF_SIZE}px)`, light: 0.74 },
];

export default function Cube3DView({ facelets, activeMove = '' }) {
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
  }, []);

  if (hasWebGL) {
    return <Cube3DWebGL facelets={facelets} activeMove={activeMove} />;
  }

  // Fallback CSS 3D representation
  return (
    <div className="three-viewport-wrap fallback-css">
      <div className="cube-scene">
        <div className="cube-3d" style={{ transform: 'rotateX(-24deg) rotateY(-32deg)' }}>
          {CSS_FACES.map(({ code, offset, transform, light }) => (
            <div
              key={code}
              className="cube-face"
              style={{ transform, filter: `brightness(${light})` }}
            >
              {Array.from({ length: 9 }, (_, i) => {
                const colorCode = facelets[offset + i] || 'W';
                const colorInfo = COLORS[colorCode] || COLORS.W;
                return (
                  <div
                    key={i}
                    className="cube-sticker"
                    style={{ backgroundColor: colorInfo.hex }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
