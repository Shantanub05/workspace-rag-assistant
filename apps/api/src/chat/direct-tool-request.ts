import { nanoid } from 'nanoid';
import type { AiToolCall } from '../ai/types';

const TASK_INTENT = /\b(?:create|save|add|record)\b.*\btask\b/i;
const NOTE_INTENT = /\b(?:create|save|add|record)\b.*\b(?:workspace\s+)?note\b/i;
const SUPPORTED_TOOL_NAMES = new Set(['save_task', 'save_workspace_note']);

export function getToolExecutionSkipReason(content: string, toolName: string): string | null {
  if (!SUPPORTED_TOOL_NAMES.has(toolName)) {
    return `Unknown tool: ${toolName}`;
  }

  if (toolName === 'save_task' && TASK_INTENT.test(normalizeContent(content))) {
    return null;
  }

  if (toolName === 'save_workspace_note' && NOTE_INTENT.test(normalizeContent(content))) {
    return null;
  }

  return 'Tool call skipped because the latest user message did not explicitly request this side effect.';
}

export function parseDirectToolRequest(content: string): AiToolCall | null {
  const normalized = normalizeContent(content);
  if (!normalized) {
    return null;
  }

  if (TASK_INTENT.test(normalized)) {
    const title =
      extractLabeledValue(normalized, ['title', 'titled', 'called', 'named'], ['description', 'desc', 'details']) ??
      extractObjectValue(normalized, 'task', ['description', 'desc', 'details']);
    if (!title) {
      return null;
    }

    return {
      id: nanoid(12),
      name: 'save_task',
      args: {
        title,
        ...optionalField(
          'description',
          extractLabeledValue(normalized, ['description', 'desc', 'details'], []),
        ),
      },
    };
  }

  if (NOTE_INTENT.test(normalized)) {
    const title = extractLabeledValue(normalized, ['title', 'titled', 'called', 'named'], [
      'body',
      'content',
      'details',
    ]);
    const body =
      extractLabeledValue(normalized, ['body', 'content', 'details'], []) ??
      extractObjectValue(normalized, 'note', []);
    if (!title || !body) {
      return null;
    }

    return {
      id: nanoid(12),
      name: 'save_workspace_note',
      args: {
        title,
        body,
      },
    };
  }

  return null;
}

function optionalField(key: string, value: string | null): Record<string, string> {
  return value ? { [key]: value } : {};
}

function extractLabeledValue(
  content: string,
  labels: string[],
  stopLabels: string[],
): string | null {
  for (const label of labels) {
    const match = new RegExp(`\\b${escapeRegex(label)}\\b\\s*:?\\s*`, 'i').exec(content);
    if (match?.index !== undefined) {
      return readValue(content, match.index + match[0].length, stopLabels);
    }
  }
  return null;
}

function extractObjectValue(content: string, objectName: 'task' | 'note', stopLabels: string[]): string | null {
  const match = new RegExp(
    `\\b${objectName}\\b(?:\\s+(?:to|for|that|called|named|titled)|\\s*:)\\s*`,
    'i',
  ).exec(content);
  if (match?.index === undefined) {
    return null;
  }
  return readValue(content, match.index + match[0].length, stopLabels);
}

function readValue(content: string, startIndex: number, stopLabels: string[]): string | null {
  const remaining = content.slice(startIndex).trim();
  if (!remaining) {
    return null;
  }

  const quoted = readQuotedValue(remaining);
  if (quoted) {
    return quoted;
  }

  const stopIndex = findStopIndex(remaining, stopLabels);
  const raw = stopIndex === -1 ? remaining : remaining.slice(0, stopIndex);
  const cleaned = cleanValue(raw);
  return cleaned.length > 0 ? cleaned : null;
}

function readQuotedValue(value: string): string | null {
  const quote = value[0];
  if (!quote || !['"', "'", '`'].includes(quote)) {
    return null;
  }

  const closingIndex = value.indexOf(quote, 1);
  if (closingIndex === -1) {
    return null;
  }

  const cleaned = value.slice(1, closingIndex).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function findStopIndex(value: string, stopLabels: string[]): number {
  if (stopLabels.length === 0) {
    return -1;
  }

  const stopPattern = stopLabels.map(escapeRegex).join('|');
  const match = new RegExp(`\\s+(?:with\\s+|and\\s+)?(?:${stopPattern})\\b\\s*:?`, 'i').exec(value);
  return match?.index ?? -1;
}

function cleanValue(value: string): string {
  return value.trim().replace(/[.;,\s]+$/g, '').replace(/^['"`]|['"`]$/g, '').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}
