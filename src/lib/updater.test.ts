import { describe, expect, it } from 'vitest';
import { whatsNew } from './updater';

describe('whatsNew', () => {
  it('keeps only the part before the install instructions', () => {
    expect(whatsNew('- نمودار مصرف\n- رفع اشکال\n\n---\n\n## نصب\n1. ...')).toBe('- نمودار مصرف\n- رفع اشکال');
  });

  it('handles empty notes', () => {
    expect(whatsNew(undefined)).toBe('');
    expect(whatsNew('---\n## نصب')).toBe('');
  });
});
