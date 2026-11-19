import React from 'react';
import { COLORS, getStickerCounts } from '../utils/cube';
import { PaletteIcon } from './Icons';

const NET_LAYOUT = [
  { code: 'U', offset: 0, row: 1, col: 2, name: 'Up (White)' },
  { code: 'L', offset: 36, row: 2, col: 1, name: 'Left (Orange)' },
  { code: 'F', offset: 18, row: 2, col: 2, name: 'Front (Green)' },
  { code: 'R', offset: 9, row: 2, col: 3, name: 'Right (Red)' },
  { code: 'B', offset: 45, row: 2, col: 4, name: 'Back (Blue)' },
  { code: 'D', offset: 27, row: 3, col: 2, name: 'Down (Yellow)' },
];

const CYCLE_ORDER = ['W', 'R', 'G', 'Y', 'O', 'B'];

export default function CubeNetEditor({
  facelets,
  activeColor,
  onSelectColor,
  onPaintSticker,
  readOnly = false,
  highlightFace = null,
}) {
  const counts = getStickerCounts(facelets);

  const handleStickerClick = (globalIdx, currentColor) => {
    if (readOnly) return;
    // If activeColor is selected, paint with active color;
    // If already that color, cycle to the next color for convenience.
    if (activeColor && activeColor !== currentColor) {
      onPaintSticker(globalIdx, activeColor);
    } else {
      const nextIdx = (CYCLE_ORDER.indexOf(currentColor) + 1) % CYCLE_ORDER.length;
      onPaintSticker(globalIdx, CYCLE_ORDER[nextIdx]);
    }
  };

  return (
    <div className="card net-editor-card">
      <div className="card-header">
        <div className="header-meta">
          <span className="card-tag">Manual Editor</span>
          <h2 className="card-title">2D Cube Net</h2>
        </div>
        {!readOnly && (
          <span className="header-hint">
            Tap swatch to paint, or tap stickers to cycle
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="palette-strip" role="group" aria-label="Color Palette">
          {Object.entries(COLORS).map(([code, info]) => {
            const count = counts[code] || 0;
            const isCountValid = count === 9;
            const isSelected = activeColor === code;

            return (
              <button
                key={code}
                type="button"
                className={`palette-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectColor(code)}
                title={`Select ${info.name} brush`}
              >
                <span
                  className="palette-swatch"
                  style={{ backgroundColor: info.hex }}
                />
                <span className="palette-label">{info.name}</span>
                <span
                  className={`palette-count ${isCountValid ? 'count-ok' : 'count-mismatch'}`}
                  title={`${count} of 9 stickers`}
                >
                  {count}/9
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="net-viewport">
        <div className="net-grid">
          {NET_LAYOUT.map(({ code, offset, row, col, name }) => {
            const isFaceActive = highlightFace === code;
            return (
              <div
                key={code}
                className={`net-face-plate ${isFaceActive ? 'face-active' : ''}`}
                style={{ gridRow: row, gridColumn: col }}
              >
                <div className="net-face-header">
                  <span className="net-face-code">{code}</span>
                  <span className="net-face-name">{name.split(' ')[0]}</span>
                </div>

                <div className="net-face-stickers">
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
                        className={`net-sticker-btn ${isCenter ? 'center-btn' : ''}`}
                        style={{
                          backgroundColor: colorInfo.hex,
                          color: colorInfo.text,
                        }}
                        onClick={() => handleStickerClick(globalIdx, colorCode)}
                        title={
                          isCenter
                            ? `Center ${code}: ${colorInfo.name} (Fixed)`
                            : `${code} ${localIdx + 1}: ${colorInfo.name} (Click to change)`
                        }
                      >
                        {isCenter ? <span className="center-glyph">{code}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
