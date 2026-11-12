import React from 'react';
import { COLORS } from '../utils/cube';

const NET_LAYOUT = [
  { code: 'U', offset: 0, row: 1, col: 2 },
  { code: 'L', offset: 36, row: 2, col: 1 },
  { code: 'F', offset: 18, row: 2, col: 2 },
  { code: 'R', offset: 9, row: 2, col: 3 },
  { code: 'B', offset: 45, row: 2, col: 4 },
  { code: 'D', offset: 27, row: 3, col: 2 },
];

export default function CubeNetEditor({
  facelets,
  activeColor,
  onSelectColor,
  onPaintSticker,
  readOnly = false,
  highlightFace = null,
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>2D Cube Net</h2>
        {!readOnly && <span className="muted">Click a color, then tap stickers</span>}
      </div>

      {!readOnly && (
        <div className="palette" role="group" aria-label="Sticker color palette">
          {Object.entries(COLORS).map(([code, info]) => (
            <button
              key={code}
              type="button"
              className={`swatch-btn ${activeColor === code ? 'selected' : ''}`}
              style={{ backgroundColor: info.hex, color: info.text }}
              onClick={() => onSelectColor(code)}
              title={`${info.name} (${code})`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      <div className="cube-net-grid">
        {NET_LAYOUT.map(({ code, offset, row, col }) => (
          <div
            key={code}
            className={`net-face ${highlightFace === code ? 'face-active' : ''}`}
            style={{ gridRow: row, gridColumn: col }}
          >
            <div className="net-face-label">{code}</div>
            <div className="net-stickers">
              {Array.from({ length: 9 }, (_, localIdx) => {
                const globalIdx = offset + localIdx;
                const colorCode = facelets[globalIdx] || 'W';
                const colorInfo = COLORS[colorCode] || COLORS.W;
                const isCenter = localIdx === 4;
                const disabled = readOnly || isCenter;

                return (
                  <button
                    key={globalIdx}
                    type="button"
                    disabled={disabled}
                    className={`sticker-cell ${isCenter ? 'is-center' : ''}`}
                    style={{ backgroundColor: colorInfo.hex, color: colorInfo.text }}
                    onClick={() => !disabled && onPaintSticker(globalIdx, activeColor)}
                    title={
                      isCenter
                        ? `${code} center (${colorInfo.name})`
                        : `${code}[${localIdx}] (${colorInfo.name})`
                    }
                  >
                    {isCenter ? code : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
