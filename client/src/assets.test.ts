import { describe, expect, it } from 'vitest';
import { assetUrl, BUILD_INFO, TEST_BUILD } from './assets';

describe('assetUrl (normal build)', () => {
  it('a normal build loads the files by their paths; it is not the test build', () => {
    expect(assetUrl('assets/ships/sloop-player-32.png')).toBe('assets/ships/sloop-player-32.png');
    expect(TEST_BUILD).toBe(false);
    expect(BUILD_INFO).toBe('dev');
  });
});
