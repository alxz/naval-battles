import { describe, expect, it } from 'vitest';
import { PerfMeter } from './perfMeter';

describe('PerfMeter', () => {
  it('averages frames and shows the worst of the last 2 seconds', () => {
    const m = new PerfMeter();
    for (let i = 0; i < 200; i++) m.note(16.7, i === 50 ? 9 : 0.5);
    const line = m.line(60);
    expect(line).toContain('fps 60');
    expect(line).toContain('frame 16.7 ms');
    expect(line).toContain('sim 0.5 ms (max 9.0)');
  });
});
