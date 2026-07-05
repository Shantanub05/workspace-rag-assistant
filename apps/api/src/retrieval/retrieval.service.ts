import { Inject, Injectable } from '@nestjs/common';
import type { RetrievalDebugChunkDto } from '@workspace-rag/shared';
import { AI_PROVIDER, type AiProvider } from '../ai/types';
import { PrismaService } from '../prisma/prisma.service';

export const WORKSPACE_VECTOR_SEARCH_SQL = `
SELECT
  dc.id AS "chunkId",
  dc.document_id AS "documentId",
  d.original_name AS "documentName",
  dc.chunk_index AS "chunkIndex",
  dc.section AS "section",
  dc.page_number AS "pageNumber",
  (1 - (dc.embedding <=> $2::vector))::float AS "similarity",
  left(dc.content, 420) AS "preview",
  dc.content AS "content"
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE dc.workspace_id = $1
ORDER BY dc.embedding <=> $2::vector
LIMIT $3
`;

export interface RetrievedChunk extends RetrievalDebugChunkDto {
  content: string;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async retrieve(workspaceId: string, query: string, limit = 6): Promise<RetrievedChunk[]> {
    const [embedding] = await this.ai.embed([query]);
    if (!embedding) {
      return [];
    }
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows = await this.prisma.$queryRawUnsafe<RetrievedChunk[]>(
      WORKSPACE_VECTOR_SEARCH_SQL,
      workspaceId,
      vectorLiteral,
      limit,
    );

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentName: row.documentName,
      chunkIndex: row.chunkIndex,
      section: row.section,
      pageNumber: row.pageNumber,
      similarity: Number(row.similarity),
      preview: row.preview,
      content: row.content,
    }));
  }
}
