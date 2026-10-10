import { describe, expect, it } from 'vitest';
import { pauseReasons } from '../src/game/ui/pauseReasons';

describe('pauseReasons', () => {
  it('steps only when no reason is held; sources do not overwrite each other', () => {
    pauseReasons.clear();
    pauseReasons.add('user');
    pauseReasons.add('portrait');
    pauseReasons.add('portrait'); // duplicate event
    pauseReasons.remove('user'); // Resume
    expect(pauseReasons.any).toBe(true);
    pauseReasons.remove('portrait');
    pauseReasons.remove('portrait'); // out-of-order duplicate
    expect(pauseReasons.any).toBe(false);
  });
  it('resetRun keeps environment reasons', () => {
    pauseReasons.clear();
    pauseReasons.add('user');
    pauseReasons.add('settings');
    pauseReasons.add('hidden');
    pauseReasons.resetRun();
    expect(pauseReasons.has('user')).toBe(false);
    expect(pauseReasons.has('hidden')).toBe(true);
    pauseReasons.clear();
  });
});
