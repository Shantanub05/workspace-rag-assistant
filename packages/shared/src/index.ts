import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(2).max(80),
});

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(['owner', 'member']),
  createdAt: z.string(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
});

export const documentStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

export const documentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  byteSize: z.number(),
  sha256: z.string(),
  status: documentStatusSchema,
  chunkCount: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const citationSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  chunkId: z.string(),
  chunkIndex: z.number(),
  section: z.string().nullable(),
  pageNumber: z.number().nullable(),
  quote: z.string().max(360),
});

export const messageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']);

export const messageSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  citations: z.array(citationSchema),
  createdAt: z.string(),
});

export const chatRequestSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const retrievalDebugChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  chunkIndex: z.number(),
  section: z.string().nullable(),
  pageNumber: z.number().nullable(),
  similarity: z.number(),
  preview: z.string(),
});

export const toolCallStatusSchema = z.enum(['SUCCESS', 'FAILED', 'SKIPPED']);

export const toolCallSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  messageId: z.string().nullable(),
  toolName: z.string(),
  status: toolCallStatusSchema,
  args: z.unknown(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  latencyMs: z.number().nullable(),
  model: z.string().nullable(),
  createdAt: z.string(),
});

export const taskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const workspaceNoteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const chatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message_saved'), messageId: z.string() }),
  z.object({ type: z.literal('retrieval'), chunks: z.array(retrievalDebugChunkSchema) }),
  z.object({ type: z.literal('tool_call'), toolCall: toolCallSchema }),
  z.object({ type: z.literal('token'), token: z.string() }),
  z.object({
    type: z.literal('done'),
    message: messageSchema,
    retrieval: z.array(retrievalDebugChunkSchema),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type DocumentDto = z.infer<typeof documentSchema>;
export type CitationDto = z.infer<typeof citationSchema>;
export type MessageDto = z.infer<typeof messageSchema>;
export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type RetrievalDebugChunkDto = z.infer<typeof retrievalDebugChunkSchema>;
export type ToolCallDto = z.infer<typeof toolCallSchema>;
export type TaskDto = z.infer<typeof taskSchema>;
export type WorkspaceNoteDto = z.infer<typeof workspaceNoteSchema>;
export type ChatStreamEventDto = z.infer<typeof chatStreamEventSchema>;
