import { describe, expect, it } from 'vitest';
import { withOnePirate } from './nation';

describe('withOnePirate (24 Nov: at least one pirate in a battle)', () => {
  it('no pirate: the first warship hoists the black flag', () => {
    expect(withOnePirate(['spain', 'france', 'england'], [true, false, false])).toEqual(['spain', 'pirates', 'england']);
  });
  it('only traders: the first bot', () => {
    expect(withOnePirate(['spain', 'france'], [true, true])).toEqual(['pirates', 'france']);
  });
  it('a pirate trader trades flags with a warship; a pirate warship stays as it is', () => {
    expect(withOnePirate(['pirates', 'france'], [true, false])).toEqual(['france', 'pirates']);
    expect(withOnePirate(['pirates', 'pirates', 'spain'], [true, false, false])).toEqual(['pirates', 'pirates', 'spain']);
  });
  it('no bots: nothing', () => {
    expect(withOnePirate([], [])).toEqual([]);
  });
});
