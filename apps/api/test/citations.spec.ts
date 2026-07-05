import { describe, expect, it } from 'vitest';
import { isFullyUnsupportedAnswer } from '../src/chat/chat.service';

describe('citation suppression', () => {
  it('suppresses citations for a fully unsupported answer', () => {
    expect(isFullyUnsupportedAnswer("I don't know from this workspace's documents.")).toBe(true);
  });

  it('keeps citations for partial answers with an unsupported detail', () => {
    const answer = [
      'Owner: Maya Chen.',
      "Escalation window: I don't know from this workspace's documents.",
    ].join('\n');

    expect(isFullyUnsupportedAnswer(answer)).toBe(false);
  });
});
