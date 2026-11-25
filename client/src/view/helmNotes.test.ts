import { describe, expect, it } from 'vitest';
import { autoNote, bosunNote, newBosunMemory } from './helmNotes';

describe('helm notes', () => {
  it('AUTO, and the headwind note while beating (D73)', () => {
    expect(autoNote(false, false)).toBe('');
    expect(autoNote(true, false)).toBe('AUTO');
    expect(autoNote(true, true)).toBe('AUTO  HEADWIND - TACKING');
  });

  it('the bosun speaks for a while at each new tenth below half, not while mending', () => {
    const m = newBosunMemory();
    expect(bosunNote(m, 0.6, false, 0, 0.5, 10)).toBe('');
    expect(bosunNote(m, 0.48, false, 1, 0.5, 10)).toContain('HULL 48%');
    expect(bosunNote(m, 0.45, false, 12, 0.5, 10)).toBe(''); // same tenth, time is up
    expect(bosunNote(m, 0.39, false, 13, 0.5, 10)).toContain('HULL 39%'); // a lower tenth
    expect(bosunNote(m, 0.39, true, 14, 0.5, 10)).toBe(''); // mending already
    expect(bosunNote(m, 0.7, false, 30, 0.5, 10)).toBe(''); // mended: it may speak again later
    expect(bosunNote(m, 0.49, false, 31, 0.5, 10)).toContain('HULL 49%');
  });
});
