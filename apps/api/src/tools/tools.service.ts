import { Injectable } from '@nestjs/common';
import type { JsonRecord } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import {
  saveTaskSchema,
  saveWorkspaceNoteSchema,
  toolDeclarations,
} from './tool-definitions';

export interface ToolExecutionContext {
  workspaceId: string;
  userId: string;
}

export interface ToolExecutionResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  result: JsonRecord | null;
  error: string | null;
}

@Injectable()
export class ToolsService {
  readonly declarations = toolDeclarations;

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    name: string,
    args: JsonRecord,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (name === 'save_task') {
      const parsed = saveTaskSchema.safeParse(args);
      if (!parsed.success) {
        return {
          status: 'FAILED',
          result: null,
          error: parsed.error.issues.map((issue) => issue.message).join('; '),
        };
      }

      const task = await this.prisma.task.create({
        data: {
          workspaceId: context.workspaceId,
          createdById: context.userId,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
        },
      });

      return {
        status: 'SUCCESS',
        result: {
          id: task.id,
          title: task.title,
          status: task.status,
        },
        error: null,
      };
    }

    if (name === 'save_workspace_note') {
      const parsed = saveWorkspaceNoteSchema.safeParse(args);
      if (!parsed.success) {
        return {
          status: 'FAILED',
          result: null,
          error: parsed.error.issues.map((issue) => issue.message).join('; '),
        };
      }

      const note = await this.prisma.workspaceNote.create({
        data: {
          workspaceId: context.workspaceId,
          createdById: context.userId,
          title: parsed.data.title,
          body: parsed.data.body,
        },
      });

      return {
        status: 'SUCCESS',
        result: {
          id: note.id,
          title: note.title,
        },
        error: null,
      };
    }

    return {
      status: 'SKIPPED',
      result: null,
      error: `Unknown tool: ${name}`,
    };
  }
}
