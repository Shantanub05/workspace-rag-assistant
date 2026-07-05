import { describe, expect, it } from 'vitest';
import { isFullyUnsupportedAnswer, selectCitationChunks } from '../src/chat/chat.service';

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

  it('keeps referenced document citations even when tools were also used', () => {
    const chunks = [
      { chunkId: 'atlas-1', documentName: 'atlas-research.md', section: 'Atlas' },
      { chunkId: 'resume-1', documentName: 'resume.pdf', section: null },
    ];

    expect(
      selectCitationChunks('Based on atlas-research.md, the owner is Maya Chen.', chunks, true),
    ).toEqual([chunks[0]]);
  });

  it('does not attach document citations to pure tool results', () => {
    const chunks = [{ chunkId: 'atlas-1', documentName: 'atlas-research.md', section: 'Atlas' }];

    expect(selectCitationChunks('I saved that task in the active workspace.', chunks, true)).toEqual([]);
  });
});
