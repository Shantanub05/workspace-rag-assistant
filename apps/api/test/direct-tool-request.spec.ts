import { describe, expect, it } from 'vitest';
import { getToolExecutionSkipReason, parseDirectToolRequest } from '../src/chat/direct-tool-request';

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

  it('allows matching tool calls only when the user requests the side effect', () => {
    expect(getToolExecutionSkipReason('Please create a task to review launch readiness.', 'save_task')).toBeNull();
    expect(getToolExecutionSkipReason('Please save a workspace note about the launch.', 'save_workspace_note')).toBeNull();
  });

  it('skips tool calls caused by document content instead of user intent', () => {
    expect(getToolExecutionSkipReason('What does this document say about launch readiness?', 'save_task')).toBe(
      'Tool call skipped because the latest user message did not explicitly request this side effect.',
    );
  });

  it('skips unknown tools safely', () => {
    expect(getToolExecutionSkipReason('Please create a task to review launch readiness.', 'delete_everything')).toBe(
      'Unknown tool: delete_everything',
    );
  });
});
