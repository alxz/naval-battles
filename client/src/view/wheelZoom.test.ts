import { describe, expect, it } from 'vitest';
import { wheelAction } from './wheelZoom';

describe('wheelAction', () => {
  it('does nothing without a roll', () => expect(wheelAction(0, false, true)).toBeNull());
  it('rolls in: a zoom step, or the spyglass put away', () => {
    expect(wheelAction(-100, false, true)).toBe('zoomIn');
    expect(wheelAction(-100, true, true)).toBe('spyglassOff');
  });
  it('rolls out: a zoom step, and at the lowest zoom the spyglass', () => {
    expect(wheelAction(100, false, false)).toBe('zoomOut');
    expect(wheelAction(100, false, true)).toBe('spyglassOn');
  });
  it('keeps the spyglass open (time restarts) while rolling out', () => expect(wheelAction(100, true, false)).toBe('spyglassOn'));
});
