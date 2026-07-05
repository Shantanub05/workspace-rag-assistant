import { describe, expect, it } from 'vitest';
import { parseDirectToolRequest } from '../src/chat/direct-tool-request';

describe('direct tool request parser', () => {
  it('parses explicit task creation requests', () => {
    const parsed = parseDirectToolRequest(
      "Please create a task titled 'Verify release' with description 'Check the release checklist.'",
    );

    expect(parsed).toMatchObject({
      name: 'save_task',
      args: {
        title: 'Verify release',
        description: 'Check the release checklist.',
      },
    });
  });

  it('parses explicit workspace note requests', () => {
    const parsed = parseDirectToolRequest(
      'Save a workspace note titled "Release decision" with body "Ship after QA signs off."',
    );

    expect(parsed).toMatchObject({
      name: 'save_workspace_note',
      args: {
        title: 'Release decision',
        body: 'Ship after QA signs off.',
      },
    });
  });

  it('ignores ordinary document questions', () => {
    expect(parseDirectToolRequest('What does the Atlas document say about rollout ownership?')).toBeNull();
  });
});
