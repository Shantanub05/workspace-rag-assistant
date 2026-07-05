import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type {
  MessageDto,
  RetrievalDebugChunkDto,
  TaskDto,
  ToolCallDto,
} from '@workspace-rag/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto';

@Controller('workspaces/:workspaceId')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ): Promise<MessageDto[]> {
    return this.chat.listMessages(user.id, workspaceId);
  }

  @Get('tool-calls')
  listToolCalls(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ): Promise<ToolCallDto[]> {
    return this.chat.listToolCalls(user.id, workspaceId);
  }

  @Get('tasks')
  listTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ): Promise<TaskDto[]> {
    return this.chat.listTasks(user.id, workspaceId);
  }

  @Get('retrieval-debug/:messageId')
  retrievalDebug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('messageId') messageId: string,
  ): Promise<RetrievalDebugChunkDto[]> {
    return this.chat.getRetrievalDebug(user.id, workspaceId, messageId);
  }

  @Post('chat/stream')
  async streamChat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const write = (event: unknown): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.chat.handleChat(user.id, workspaceId, dto.content, write);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat failed.';
      write({ type: 'error', message });
    } finally {
      res.end();
    }
  }
}
