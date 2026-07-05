import { createHash } from 'node:crypto';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  section: string | null;
  contentHash: string;
}

const TARGET_CHARS = 1100;
const OVERLAP_CHARS = 180;

export function chunkDocumentText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n\s*\n/).map((paragraph) => paragraph.trim());
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      continue;
    }

    if (current.length + paragraph.length + 2 <= TARGET_CHARS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= TARGET_CHARS) {
      current = overlapTail(current) + paragraph;
      continue;
    }

    for (let start = 0; start < paragraph.length; start += TARGET_CHARS - OVERLAP_CHARS) {
      chunks.push(paragraph.slice(start, start + TARGET_CHARS).trim());
    }
    current = '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks
    .filter((content) => content.length > 0)
    .map((content, index) => ({
      chunkIndex: index,
      content,
      tokenEstimate: estimateTokens(content),
      section: detectSection(content),
      contentHash: sha256(content),
    }));
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function detectSection(content: string): string | null {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+/.test(line));

  return heading ? heading.replace(/^#{1,6}\s+/, '').slice(0, 120) : null;
}

function overlapTail(previous: string): string {
  if (!previous) {
    return '';
  }
  const tail = previous.slice(Math.max(0, previous.length - OVERLAP_CHARS)).trim();
  return tail ? `${tail}\n\n` : '';
}
