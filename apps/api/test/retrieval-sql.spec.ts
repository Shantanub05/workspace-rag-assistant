import { describe, expect, it } from 'vitest';
import { WORKSPACE_VECTOR_SEARCH_SQL } from '../src/retrieval/retrieval.service';

describe('workspace vector search SQL', () => {
  it('filters by workspace inside the vector search query', () => {
    const normalized = WORKSPACE_VECTOR_SEARCH_SQL.replace(/\s+/g, ' ').trim().toLowerCase();

    expect(normalized).toContain('from document_chunks dc');
    expect(normalized).toContain('where dc.workspace_id = $1');
    expect(normalized.indexOf('where dc.workspace_id = $1')).toBeLessThan(
      normalized.indexOf('order by dc.embedding <=> $2::vector'),
    );
  });
});
