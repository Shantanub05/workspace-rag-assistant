import type { JsonRecord } from '../common/json';

export interface AiToolDeclaration {
  name: string;
  description: string;
  parameters: JsonRecord;
}

export interface AiToolCall {
  id: string;
  name: string;
  args: JsonRecord;
}

export interface AiMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AiGenerateInput {
  system: string;
  messages: AiMessage[];
  tools: AiToolDeclaration[];
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiGenerateResult {
  text: string;
  toolCalls: AiToolCall[];
  usage?: AiUsage;
  model: string;
}

export interface AiProvider {
  embed(texts: string[]): Promise<number[][]>;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
