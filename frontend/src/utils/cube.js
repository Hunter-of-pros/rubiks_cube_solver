export const SOLVED_FACELETS =
  'WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB';

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

export const COLORS = {
  W: { name: 'White', hex: '#f8fafc', text: '#0f172a' },
  R: { name: 'Red', hex: '#dc2626', text: '#ffffff' },
  G: { name: 'Green', hex: '#16a34a', text: '#ffffff' },
  Y: { name: 'Yellow', hex: '#facc15', text: '#0f172a' },
  O: { name: 'Orange', hex: '#f97316', text: '#0f172a' },
  B: { name: 'Blue', hex: '#2563eb', text: '#ffffff' },
};

// Natural hand-turn order with neighbor colors from the user's mirrored-preview view.
export const SCAN_PROMPTS = [
  {
    code: 'F',
    label: 'Front (Green center)',
    hint: 'Hold Green facing camera, White on top',
    top: 'W',
    bottom: 'Y',
    userLeft: 'R',
    userRight: 'O',
  },
  {
    code: 'R',
    label: 'Right (Red center)',
    hint: 'Turn 90° to show Red center, White on top',
    top: 'W',
    bottom: 'Y',
    userLeft: 'B',
    userRight: 'G',
  },
  {
    code: 'B',
    label: 'Back (Blue center)',
    hint: 'Turn 90° again to show Blue center, White on top',
    top: 'W',
    bottom: 'Y',
    userLeft: 'O',
    userRight: 'R',
  },
  {
    code: 'L',
    label: 'Left (Orange center)',
    hint: 'Turn 90° again to show Orange center, White on top',
    top: 'W',
    bottom: 'Y',
    userLeft: 'G',
    userRight: 'B',
  },
  {
    code: 'U',
    label: 'Up (White center)',
    hint: 'From Green front, tilt TOP toward camera for White',
    top: 'B',
    bottom: 'G',
    userLeft: 'R',
    userRight: 'O',
  },
  {
    code: 'D',
    label: 'Down (Yellow center)',
    hint: 'From Green front, tilt BOTTOM toward camera for Yellow',
    top: 'G',
    bottom: 'B',
    userLeft: 'R',
    userRight: 'O',
  },
];

const FACE_OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

const idx = (face, local) => FACE_OFFSET[face] + local;

// Matches cpp/src/cube.cpp kAdjacentRings exactly.
const ADJACENT_RINGS = {
  U: [
    idx('F', 0), idx('F', 1), idx('F', 2),
    idx('L', 0), idx('L', 1), idx('L', 2),
    idx('B', 0), idx('B', 1), idx('B', 2),
    idx('R', 0), idx('R', 1), idx('R', 2),
  ],
  R: [
    idx('U', 8), idx('U', 5), idx('U', 2),
    idx('B', 0), idx('B', 3), idx('B', 6),
    idx('D', 8), idx('D', 5), idx('D', 2),
    idx('F', 8), idx('F', 5), idx('F', 2),
  ],
  F: [
    idx('U', 6), idx('U', 7), idx('U', 8),
    idx('R', 0), idx('R', 3), idx('R', 6),
    idx('D', 2), idx('D', 1), idx('D', 0),
    idx('L', 8), idx('L', 5), idx('L', 2),
  ],
  D: [
    idx('F', 6), idx('F', 7), idx('F', 8),
    idx('R', 6), idx('R', 7), idx('R', 8),
    idx('B', 6), idx('B', 7), idx('B', 8),
    idx('L', 6), idx('L', 7), idx('L', 8),
  ],
  L: [
    idx('U', 0), idx('U', 3), idx('U', 6),
    idx('F', 0), idx('F', 3), idx('F', 6),
    idx('D', 0), idx('D', 3), idx('D', 6),
    idx('B', 8), idx('B', 5), idx('B', 2),
  ],
  B: [
    idx('U', 2), idx('U', 1), idx('U', 0),
    idx('L', 0), idx('L', 3), idx('L', 6),
    idx('D', 6), idx('D', 7), idx('D', 8),
    idx('R', 8), idx('R', 5), idx('R', 2),
  ],
};

function cycleFour(arr, a, b, c, d) {
  const tmp = arr[d];
  arr[d] = arr[c];
  arr[c] = arr[b];
  arr[b] = arr[a];
  arr[a] = tmp;
}

function rotateCW(arr, face) {
  const base = FACE_OFFSET[face];
  cycleFour(arr, base + 0, base + 2, base + 8, base + 6);
  cycleFour(arr, base + 1, base + 5, base + 7, base + 3);
  const ring = ADJACENT_RINGS[face];
  for (let offset = 0; offset < 3; offset += 1) {
    cycleFour(arr, ring[offset], ring[offset + 3], ring[offset + 6], ring[offset + 9]);
  }
}

export function applyMove(facelets, moveToken) {
  const token = moveToken.trim();
  if (!token) return facelets;
  const face = token[0].toUpperCase();
  if (!(face in FACE_OFFSET)) {
    throw new Error(`Invalid move: ${moveToken}`);
  }
  const suffix = token.slice(1);
  const turns = suffix === '' ? 1 : suffix === '2' ? 2 : suffix === "'" ? 3 : 0;
  if (turns === 0) {
    throw new Error(`Invalid move suffix: ${moveToken}`);
  }

  const arr = facelets.split('');
  for (let t = 0; t < turns; t += 1) {
    rotateCW(arr, face);
  }
  return arr.join('');
}

export function applyMoves(facelets, moves) {
  const list = Array.isArray(moves)
    ? moves
    : moves.trim().split(/\s+/).filter(Boolean);
  let state = facelets;
  for (const m of list) {
    state = applyMove(state, m);
  }
  return state;
}

export function buildPlaybackStates(initialFacelets, moveList) {
  const states = [initialFacelets];
  let curr = initialFacelets;
  for (const move of moveList) {
    curr = applyMove(curr, move);
    states.push(curr);
  }
  return states;
}

const FACE_FULL_NAMES = {
  U: 'Top (White center)',
  R: 'Right (Red center)',
  F: 'Front (Green center)',
  D: 'Bottom (Yellow center)',
  L: 'Left (Orange center)',
  B: 'Back (Blue center)',
};

export function describeMove(moveToken) {
  if (!moveToken) return '';
  const face = moveToken[0];
  const suffix = moveToken.slice(1);
  const name = FACE_FULL_NAMES[face] || face;
  if (suffix === '2') return `Turn ${name} 180°`;
  if (suffix === "'") return `Turn ${name} 90° counterclockwise (looking at that face)`;
  return `Turn ${name} 90° clockwise (looking at that face)`;
}
