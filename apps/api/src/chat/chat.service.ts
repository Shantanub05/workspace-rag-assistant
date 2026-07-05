import { Inject, Injectable } from '@nestjs/common';
import type {
  ChatStreamEventDto,
  CitationDto,
  MessageDto,
  RetrievalDebugChunkDto,
  TaskDto,
  ToolCallDto,
} from '@workspace-rag/shared';
import { Prisma } from '@prisma/client';
import { AI_PROVIDER, type AiMessage, type AiProvider, type AiToolCall } from '../ai/types';
import { isRecord, type JsonRecord } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import { RetrievalService, type RetrievedChunk } from '../retrieval/retrieval.service';
import { ToolsService } from '../tools/tools.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { parseDirectToolRequest } from './direct-tool-request';
import { buildRagSystemPrompt, formatRetrievedContext } from './prompt';

type StreamWriter = (event: ChatStreamEventDto) => void | Promise<void>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly retrieval: RetrievalService,
    private readonly tools: ToolsService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async listMessages(userId: string, workspaceId: string): Promise<MessageDto[]> {
    await this.workspaces.assertMember(userId, workspaceId);
    const messages = await this.prisma.message.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return messages.map(toMessageDto);
  }

  async listToolCalls(userId: string, workspaceId: string): Promise<ToolCallDto[]> {
    await this.workspaces.assertMember(userId, workspaceId);
    const toolCalls = await this.prisma.toolCall.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return toolCalls.map(toToolCallDto);
  }

  async listTasks(userId: string, workspaceId: string): Promise<TaskDto[]> {
    await this.workspaces.assertMember(userId, workspaceId);
    const tasks = await this.prisma.task.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return tasks.map((task) => ({
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  async getRetrievalDebug(
    userId: string,
    workspaceId: string,
    messageId: string,
  ): Promise<RetrievalDebugChunkDto[]> {
    await this.workspaces.assertMember(userId, workspaceId);
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        workspaceId,
      },
      select: { retrieval: true },
    });
    if (!message?.retrieval || !Array.isArray(message.retrieval)) {
      return [];
    }
    return message.retrieval as RetrievalDebugChunkDto[];
  }

  async handleChat(
    userId: string,
    workspaceId: string,
    content: string,
    write: StreamWriter,
  ): Promise<void> {
    const startedAt = Date.now();
    await this.workspaces.assertMember(userId, workspaceId);

    const userMessage = await this.prisma.message.create({
      data: {
        workspaceId,
        userId,
        role: 'USER',
        content,
      },
    });
    await write({ type: 'message_saved', messageId: userMessage.id });

    const directToolCall = parseDirectToolRequest(content);
    if (directToolCall) {
      await this.handleDirectToolCall(userId, workspaceId, userMessage.id, directToolCall, startedAt, write);
      return;
    }

    const retrieved = await this.retrieval.retrieve(workspaceId, content);
    const retrievalDebug = retrieved.map(toRetrievalDebugChunk);
    await write({ type: 'retrieval', chunks: retrievalDebug });

    const history = await this.loadRecentHistory(workspaceId, userMessage.id);
    const aiMessages = this.buildInitialAiMessages(history, content, retrieved);
    const executedToolCallIds: string[] = [];
    let result = await this.ai.generate({
      system: buildRagSystemPrompt(),
      messages: aiMessages,
      tools: this.tools.declarations,
    });

    for (let step = 0; step < 3 && result.toolCalls.length > 0; step += 1) {
      const toolSummaries: string[] = [];
      for (const toolCall of result.toolCalls) {
        const logged = await this.executeAndLogTool(workspaceId, userId, userMessage.id, toolCall, result.model);
        executedToolCallIds.push(logged.id);
        await write({ type: 'tool_call', toolCall: logged });
        toolSummaries.push(
          `${toolCall.name}: ${logged.status} ${JSON.stringify(logged.result ?? logged.error)}`,
        );
      }

      aiMessages.push({
        role: 'user',
        content: `Tool execution results:\n${toolSummaries.join('\n')}\nContinue with the final answer. If more action is needed, request another registered tool.`,
      });

      result = await this.ai.generate({
        system: buildRagSystemPrompt(),
        messages: aiMessages,
        tools: this.tools.declarations,
      });
    }

    const finalText = this.finalizeAnswer(result.text, retrieved, executedToolCallIds.length > 0);
    const citations = this.buildCitations(finalText, retrieved, executedToolCallIds.length > 0);
    for (const token of tokenizeForStreaming(finalText)) {
      await write({ type: 'token', token });
    }

    const assistantMessage = await this.prisma.message.create({
      data: {
        workspaceId,
        userId,
        role: 'ASSISTANT',
        content: finalText,
        citations,
        retrieval: retrievalDebug,
        toolCalls: executedToolCallIds,
      },
    });

    await this.prisma.toolCall.updateMany({
      where: {
        id: { in: executedToolCallIds },
      },
      data: {
        messageId: assistantMessage.id,
      },
    });

    await this.prisma.requestLog.create({
      data: {
        workspaceId,
        operation: 'chat.stream',
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        retrievalCount: retrieved.length,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      },
    });

    await write({
      type: 'done',
      message: toMessageDto(assistantMessage),
      retrieval: retrievalDebug,
    });
  }

  private async handleDirectToolCall(
    userId: string,
    workspaceId: string,
    userMessageId: string,
    toolCall: AiToolCall,
    startedAt: number,
    write: StreamWriter,
  ): Promise<void> {
    const logged = await this.executeAndLogTool(workspaceId, userId, userMessageId, toolCall, 'server-direct');
    await write({ type: 'tool_call', toolCall: logged });

    const finalText = this.buildToolOnlyAnswer(logged);
    for (const token of tokenizeForStreaming(finalText)) {
      await write({ type: 'token', token });
    }

    const assistantMessage = await this.prisma.message.create({
      data: {
        workspaceId,
        userId,
        role: 'ASSISTANT',
        content: finalText,
        citations: [],
        retrieval: [],
        toolCalls: [logged.id],
      },
    });

    await this.prisma.toolCall.update({
      where: { id: logged.id },
      data: { messageId: assistantMessage.id },
    });

    await this.prisma.requestLog.create({
      data: {
        workspaceId,
        operation: 'chat.tool.direct',
        model: 'server-direct',
        inputTokens: null,
        outputTokens: null,
        retrievalCount: 0,
        latencyMs: Date.now() - startedAt,
        status: logged.status === 'SUCCESS' ? 'success' : 'failed',
        error: logged.error,
      },
    });

    await write({
      type: 'done',
      message: toMessageDto(assistantMessage),
      retrieval: [],
    });
  }

  private async loadRecentHistory(workspaceId: string, excludeMessageId: string): Promise<AiMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        workspaceId,
        id: { not: excludeMessageId },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    return messages
      .reverse()
      .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
      .map((message) => ({
        role: message.role === 'USER' ? 'user' : 'model',
        content: message.content,
      }));
  }

  private buildInitialAiMessages(
    history: AiMessage[],
    content: string,
    retrieved: RetrievedChunk[],
  ): AiMessage[] {
    return [
      ...history,
      {
        role: 'user',
        content: [
          `User question or request:\n${content}`,
          `Retrieved context for active workspace:\n${formatRetrievedContext(retrieved)}`,
          'Use only this active-workspace context for document answers.',
        ].join('\n\n'),
      },
    ];
  }

  private async executeAndLogTool(
    workspaceId: string,
    userId: string,
    messageId: string,
    toolCall: AiToolCall,
    model: string,
  ): Promise<ToolCallDto> {
    const startedAt = Date.now();
    let status: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'FAILED';
    let result: JsonRecord | null = null;
    let error: string | null = null;

    try {
      const execution = await this.tools.execute(toolCall.name, toolCall.args, {
        workspaceId,
        userId,
      });
      status = execution.status;
      result = execution.result;
      error = execution.error;
    } catch (executionError) {
      error = executionError instanceof Error ? executionError.message : 'Tool execution failed.';
    }

    const logged = await this.prisma.toolCall.create({
      data: {
        workspaceId,
        userId,
        messageId,
        toolName: toolCall.name,
        status,
        args: toolCall.args as Prisma.InputJsonValue,
        result: result as Prisma.InputJsonValue,
        error,
        latencyMs: Date.now() - startedAt,
        model,
      },
    });

    return toToolCallDto(logged);
  }

  private finalizeAnswer(text: string, retrieved: RetrievedChunk[], hadToolCalls: boolean): string {
    const cleanText = text.trim();
    if (cleanText) {
      if (!hadToolCalls && retrieved.length === 0 && !containsDontKnow(cleanText)) {
        return "I don't know from this workspace's documents.";
      }
      return cleanText;
    }

    if (hadToolCalls) {
      return 'Done. I recorded that in the active workspace.';
    }

    return "I don't know from this workspace's documents.";
  }

  private buildCitations(
    finalText: string,
    retrieved: RetrievedChunk[],
    hadToolCalls: boolean,
  ): CitationDto[] {
    if (retrieved.length === 0 || isFullyUnsupportedAnswer(finalText)) {
      return [];
    }

    return selectCitationChunks(finalText, retrieved, hadToolCalls).map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      section: chunk.section,
      pageNumber: chunk.pageNumber,
      quote: chunk.preview.slice(0, 360),
    }));
  }

  private buildToolOnlyAnswer(toolCall: ToolCallDto): string {
    if (toolCall.status !== 'SUCCESS') {
      return `I could not run ${toolCall.toolName}: ${toolCall.error ?? 'Tool validation failed.'}`;
    }

    const title = readStringField(toolCall.result, 'title') ?? readStringField(toolCall.args, 'title');
    if (toolCall.toolName === 'save_task') {
      return title
        ? `Saved task "${title}" in the active workspace.`
        : 'Saved the task in the active workspace.';
    }

    if (toolCall.toolName === 'save_workspace_note') {
      return title
        ? `Saved workspace note "${title}" in the active workspace.`
        : 'Saved the workspace note in the active workspace.';
    }

    return 'Done. I recorded that in the active workspace.';
  }
}

function tokenizeForStreaming(text: string): string[] {
  const tokens = text.match(/\S+\s*/g);
  return tokens ?? [text];
}

function containsDontKnow(text: string): boolean {
  return text.toLowerCase().includes("don't know") || text.toLowerCase().includes('do not know');
}

export function isFullyUnsupportedAnswer(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase();
  return (
    normalized === "i don't know from this workspace's documents" ||
    normalized === 'i do not know from this workspace\'s documents'
  );
}

export function selectCitationChunks<T extends Pick<RetrievedChunk, 'chunkId' | 'documentName' | 'section'>>(
  finalText: string,
  retrieved: T[],
  hadToolCalls: boolean,
): T[] {
  const referenced = retrieved.filter((chunk) => isChunkReferenced(finalText, chunk));
  if (referenced.length > 0) {
    return referenced.slice(0, 3);
  }

  return hadToolCalls ? [] : retrieved.slice(0, 3);
}

function isChunkReferenced(
  finalText: string,
  chunk: Pick<RetrievedChunk, 'chunkId' | 'documentName' | 'section'>,
): boolean {
  const normalizedText = finalText.toLowerCase();
  return [chunk.documentName, chunk.chunkId, chunk.section]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizedText.includes(value.toLowerCase()));
}

function readStringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === 'string' ? field : null;
}

function toRetrievalDebugChunk(chunk: RetrievedChunk): RetrievalDebugChunkDto {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkIndex: chunk.chunkIndex,
    section: chunk.section,
    pageNumber: chunk.pageNumber,
    similarity: chunk.similarity,
    preview: chunk.preview,
  };
}

export function toMessageDto(message: {
  id: string;
  workspaceId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  citations: Prisma.JsonValue | null;
  createdAt: Date;
}): MessageDto {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    role: message.role,
    content: message.content,
    citations: Array.isArray(message.citations) ? (message.citations as CitationDto[]) : [],
    createdAt: message.createdAt.toISOString(),
  };
}

export function toToolCallDto(toolCall: {
  id: string;
  workspaceId: string;
  messageId: string | null;
  toolName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  args: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  error: string | null;
  latencyMs: number | null;
  model: string | null;
  createdAt: Date;
}): ToolCallDto {
  return {
    id: toolCall.id,
    workspaceId: toolCall.workspaceId,
    messageId: toolCall.messageId,
    toolName: toolCall.toolName,
    status: toolCall.status,
    args: toolCall.args,
    result: toolCall.result,
    error: toolCall.error,
    latencyMs: toolCall.latencyMs,
    model: toolCall.model,
    createdAt: toolCall.createdAt.toISOString(),
  };
}
