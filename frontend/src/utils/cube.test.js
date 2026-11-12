import { describe, expect, it } from 'vitest';
import {
  FACES,
  SOLVED_FACELETS,
  applyMove,
  applyMoves,
  buildPlaybackStates,
} from './cube';

describe('client-side cube rotation helpers', () => {
  it('restores solved state after 4 clockwise turns of any face', () => {
    for (const face of FACES) {
      let state = SOLVED_FACELETS;
      for (let i = 0; i < 4; i += 1) {
        state = applyMove(state, face);
      }
      expect(state).toBe(SOLVED_FACELETS);
    }
  });

  it('matches group orders (R U R\' U\')^6 and (R U)^105', () => {
    let sexy = SOLVED_FACELETS;
    for (let i = 0; i < 6; i += 1) {
      sexy = applyMoves(sexy, "R U R' U'");
      if (i < 5) expect(sexy).not.toBe(SOLVED_FACELETS);
    }
    expect(sexy).toBe(SOLVED_FACELETS);

    let ru = SOLVED_FACELETS;
    for (let i = 0; i < 105; i += 1) {
      ru = applyMoves(ru, 'R U');
      if (i < 104) expect(ru).not.toBe(SOLVED_FACELETS);
    }
    expect(ru).toBe(SOLVED_FACELETS);
  });

  it('builds step-by-step playback states cleanly', () => {
    const scramble = "R U F'";
    const scrambled = applyMoves(SOLVED_FACELETS, scramble);
    const solution = ['F', "U'", "R'"];
    const states = buildPlaybackStates(scrambled, solution);
    expect(states).toHaveLength(4);
    expect(states[0]).toBe(scrambled);
    expect(states[3]).toBe(SOLVED_FACELETS);
  });
});
