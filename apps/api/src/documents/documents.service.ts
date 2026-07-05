import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { DocumentDto } from '@workspace-rag/shared';
import { AI_PROVIDER, type AiProvider } from '../ai/types';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { chunkDocumentText, sha256, type TextChunk } from './chunker';
import { parseUploadedDocument } from './document-parser';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async list(userId: string, workspaceId: string): Promise<DocumentDto[]> {
    await this.workspaces.assertMember(userId, workspaceId);
    const documents = await this.prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toDocumentDto);
  }

  async ingest(userId: string, workspaceId: string, file: Express.Multer.File): Promise<DocumentDto> {
    await this.workspaces.assertMember(userId, workspaceId);

    if (!file) {
      throw new BadRequestException('Document file is required.');
    }

    const fileHash = sha256(file.buffer);
    const existing = await this.prisma.document.findUnique({
      where: {
        workspaceId_sha256: {
          workspaceId,
          sha256: fileHash,
        },
      },
    });

    if (existing?.status === 'COMPLETED') {
      return toDocumentDto(existing);
    }

    const document =
      existing ??
      (await this.prisma.document.create({
        data: {
          workspaceId,
          filename: `${Date.now()}-${file.originalname}`,
          originalName: file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
          byteSize: file.size,
          sha256: fileHash,
          status: 'PENDING',
        },
      }));

    await this.prisma.document.update({
      where: { id: document.id },
      data: { status: 'PROCESSING', error: null, chunkCount: 0 },
    });
    await this.prisma.documentChunk.deleteMany({ where: { documentId: document.id } });

    try {
      const text = await parseUploadedDocument(file);
      const chunks = chunkDocumentText(text);
      if (chunks.length === 0) {
        throw new BadRequestException('Document did not contain extractable text.');
      }

      const embeddings = await this.ai.embed(chunks.map((chunk) => chunk.content));
      await this.insertChunks(workspaceId, document.id, chunks, embeddings);

      const completed = await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'COMPLETED',
          chunkCount: chunks.length,
          error: null,
        },
      });

      return toDocumentDto(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ingestion failure.';
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'FAILED',
          error: message.slice(0, 1000),
        },
      });

      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(message);
    }
  }

  private async insertChunks(
    workspaceId: string,
    documentId: string,
    chunks: TextChunk[],
    embeddings: number[][],
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new ServiceUnavailableException('Embedding count did not match chunk count.');
    }

    for (const chunk of chunks) {
      const embedding = embeddings[chunk.chunkIndex];
      if (!embedding) {
        throw new ServiceUnavailableException('Missing embedding for document chunk.');
      }
      const vectorLiteral = `[${embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO document_chunks (
          id,
          workspace_id,
          document_id,
          chunk_index,
          content,
          token_estimate,
          page_number,
          section,
          content_hash,
          embedding,
          created_at,
          updated_at
        )
        VALUES (
          ${nanoid(21)},
          ${workspaceId},
          ${documentId},
          ${chunk.chunkIndex},
          ${chunk.content},
          ${chunk.tokenEstimate},
          ${null},
          ${chunk.section},
          ${chunk.contentHash},
          ${vectorLiteral}::vector,
          now(),
          now()
        )
        ON CONFLICT (document_id, chunk_index) DO NOTHING
      `;
    }
  }
}

export function toDocumentDto(document: {
  id: string;
  workspaceId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  status: DocumentDto['status'];
  chunkCount: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentDto {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    filename: document.filename,
    originalName: document.originalName,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    sha256: document.sha256,
    status: document.status,
    chunkCount: document.chunkCount,
    error: document.error,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
