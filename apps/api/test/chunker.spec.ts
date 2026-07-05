import { describe, expect, it } from 'vitest';
import { chunkDocumentText, sha256 } from '../src/documents/chunker';

describe('chunkDocumentText', () => {
  it('creates deterministic chunks with hashes', () => {
    const text = `# Launch Notes

Atlas launch code is ATLAS-POLARIS-47.

${'The rollout owner is Maya Chen. '.repeat(120)}`;

    const first = chunkDocumentText(text);
    const second = chunkDocumentText(text);

    expect(first.length).toBeGreaterThan(1);
    expect(first).toEqual(second);
    expect(first[0]?.section).toBe('Launch Notes');
    expect(first[0]?.contentHash).toBe(sha256(first[0]?.content ?? ''));
  });
});
