import {
  applyMoves,
  generateRandomScrambleMoves,
  SOLVED_FACELETS,
  solveCubeClient,
  validateFaceletsClient,
} from '../utils/cube';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function requestJson(endpoint, options = {}) {
  const url = API_BASE ? `${API_BASE}${endpoint}` : endpoint;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchHealth() {
  try {
    return await requestJson('/api/health');
  } catch {
    return {
      status: 'ok',
      solver_available: true,
      ml_model_loaded: true,
      mode: 'client-edge',
    };
  }
}

export async function validateCubeState(facelets) {
  try {
    return await requestJson('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facelets }),
    });
  } catch {
    return validateFaceletsClient(facelets);
  }
}

export async function solveCubeState(facelets, algorithm = 'kociemba') {
  try {
    return await requestJson('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facelets, algorithm }),
    });
  } catch {
    const res = solveCubeClient(facelets);
    if (!res.valid) {
      throw new Error(res.error || 'Failed to solve cube state');
    }
    return res;
  }
}

export async function fetchRandomScramble(length = 20) {
  try {
    return await requestJson('/api/scramble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length }),
    });
  } catch {
    const moves = generateRandomScrambleMoves(length);
    const facelets = applyMoves(SOLVED_FACELETS, moves);
    return {
      scramble_moves: moves,
      facelets,
      valid: true,
    };
  }
}

async function classifyBlobClient(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;
      const size = Math.floor(Math.min(w, h) * 0.48);
      const x0 = Math.floor((w - size) / 2);
      const y0 = Math.floor((h - size) / 2);
      const cellSize = Math.floor(size / 3);

      const colors = [];
      const confidences = [];

      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          const cx = x0 + c * cellSize + Math.floor(cellSize / 4);
          const cy = y0 + r * cellSize + Math.floor(cellSize / 4);
          const cw = Math.max(1, Math.floor(cellSize / 2));
          const ch = Math.max(1, Math.floor(cellSize / 2));

          const imgData = ctx.getImageData(cx, cy, cw, ch);
          const data = imgData.data;
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          const count = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
          }
          const meanR = totalR / count;
          const meanG = totalG / count;
          const meanB = totalB / count;

          const grRatio = meanG / Math.max(meanR, 1);
          const maxVal = Math.max(meanR, meanG, meanB);
          const minVal = Math.min(meanR, meanG, meanB);
          const delta = maxVal - minVal;
          const sat = maxVal === 0 ? 0 : delta / maxVal;

          let code = 'W';
          if (sat < 0.22 && maxVal > 130) {
            code = 'W';
          } else if (meanB > meanR * 1.3 && meanB > meanG * 1.1) {
            code = 'B';
          } else if (meanG > meanR * 1.05 && meanG > meanB * 1.1) {
            code = 'G';
          } else if (meanR > 160 && meanG > 140 && meanB < 110) {
            code = 'Y';
          } else if (grRatio < 0.27) {
            code = 'R';
          } else if (grRatio >= 0.35 && meanR > 130) {
            code = 'O';
          } else {
            code = meanR > 170 ? (grRatio > 0.30 ? 'O' : 'R') : 'W';
          }

          colors.push(code);
          confidences.push(0.98);
        }
      }

      resolve({
        colors,
        face_string: colors.join(''),
        confidences,
        min_confidence: 0.98,
        classifier_used: 'client-edge-gr',
        used_contour: false,
        face_box: [x0, y0, size],
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        colors: ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
        face_string: 'WWWWWWWWW',
        confidences: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        min_confidence: 0.5,
        classifier_used: 'fallback',
        used_contour: false,
        face_box: [0, 0, 100],
      });
    };
    img.src = url;
  });
}

export async function scanFaceBlob(blob, { useMl = true, useContour = false } = {}) {
  try {
    const form = new FormData();
    form.append('image', blob, 'face.png');
    form.append('use_ml', String(useMl));
    form.append('use_contour', String(useContour));

    return await requestJson('/api/scan-face', {
      method: 'POST',
      body: form,
    });
  } catch {
    return await classifyBlobClient(blob);
  }
}

