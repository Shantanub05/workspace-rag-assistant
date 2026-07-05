import { describe, expect, it } from 'vitest';
import { saveTaskSchema, saveWorkspaceNoteSchema, toolDeclarations } from '../src/tools/tool-definitions';

describe('tool definitions', () => {
  it('registers the required tools', () => {
    expect(toolDeclarations.map((tool) => tool.name)).toEqual([
      'save_task',
      'save_workspace_note',
    ]);
  });

  it('rejects malformed tool arguments', () => {
    expect(saveTaskSchema.safeParse({ description: 'missing title' }).success).toBe(false);
    expect(saveWorkspaceNoteSchema.safeParse({ title: 'Note' }).success).toBe(false);
  });
});
