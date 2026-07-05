import { z } from 'zod';
import type { AiToolDeclaration } from '../ai/types';

export const saveTaskSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional(),
});

export const saveWorkspaceNoteSchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(2).max(3000),
});

export const toolDeclarations: AiToolDeclaration[] = [
  {
    name: 'save_task',
    description:
      'Save an actionable task in the active workspace when the user asks to create, remember, or track a task.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short task title.',
        },
        description: {
          type: 'string',
          description: 'Optional task detail.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'save_workspace_note',
    description:
      'Save a durable note in the active workspace when the user asks to record a summary, note, or decision.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short note title.',
        },
        body: {
          type: 'string',
          description: 'Note body to save.',
        },
      },
      required: ['title', 'body'],
    },
  },
];
