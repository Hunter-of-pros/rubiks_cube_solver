async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function fetchHealth() {
  return requestJson('/api/health');
}

export function validateCubeState(facelets) {
  return requestJson('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facelets }),
  });
}

export function solveCubeState(facelets, algorithm = 'kociemba') {
  return requestJson('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facelets, algorithm }),
  });
}

export function fetchRandomScramble(length = 20) {
  return requestJson('/api/scramble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ length }),
  });
}

export async function scanFaceBlob(blob, { useMl = true, useContour = false } = {}) {
  const form = new FormData();
  form.append('image', blob, 'face.png');
  form.append('use_ml', String(useMl));
  form.append('use_contour', String(useContour));

  return requestJson('/api/scan-face', {
    method: 'POST',
    body: form,
  });
}
