import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { asNumber, isRecord, type JsonRecord } from '../common/json';
import type { AppEnv } from '../config/env';
import type { AiGenerateInput, AiGenerateResult, AiProvider, AiToolCall } from './types';

interface GeminiPart {
  text?: string;
  functionCall?: {
    name?: string;
    args?: JsonRecord;
  };
}

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly embeddingDimensions: number;

  constructor(private readonly config: ConfigService<AppEnv, true>) {
    this.apiKey = config.get('GEMINI_API_KEY');
    this.chatModel = config.get('GEMINI_CHAT_MODEL');
    this.embeddingModel = config.get('GEMINI_EMBEDDING_MODEL');
    this.embeddingDimensions = config.get('GEMINI_EMBEDDING_DIMENSIONS');
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.assertConfigured();
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await this.postGemini(`models/${this.embeddingModel}:embedContent`, {
        model: `models/${this.embeddingModel}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: this.embeddingDimensions,
      });

      const values = this.extractEmbeddingValues(response);
      if (values.length !== this.embeddingDimensions) {
        throw new ServiceUnavailableException('Embedding provider returned unexpected dimensions.');
      }
      embeddings.push(values);
    }

    return embeddings;
  }

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    this.assertConfigured();
    const payload: JsonRecord = {
      systemInstruction: {
        parts: [{ text: input.system }],
      },
      contents: input.messages.map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.2,
      },
    };

    if (input.tools.length > 0) {
      payload.tools = [
        {
          functionDeclarations: input.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
      payload.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      };
    }

    const response = await this.postGemini(`models/${this.chatModel}:generateContent`, payload);
    const parts = this.extractParts(response);
    const text = parts
      .map((part) => part.text)
      .filter((partText): partText is string => typeof partText === 'string')
      .join('\n')
      .trim();

    const usage = this.extractUsage(response);
    return {
      text,
      toolCalls: parts.flatMap((part): AiToolCall[] => {
        if (!part.functionCall?.name) {
          return [];
        }
        return [
          {
            id: nanoid(12),
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          },
        ];
      }),
      ...(usage ? { usage } : {}),
      model: this.chatModel,
    };
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured. Add a free Google AI Studio key to use AI features.',
      );
    }
  }

  private async postGemini(path: string, body: JsonRecord): Promise<unknown> {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${path}`);
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(
        `Gemini request failed with ${response.status}: ${detail.slice(0, 300)}`,
      );
    }

    return response.json() as Promise<unknown>;
  }

  private extractEmbeddingValues(response: unknown): number[] {
    if (!isRecord(response) || !isRecord(response.embedding)) {
      throw new ServiceUnavailableException('Embedding provider returned malformed response.');
    }

    const values = response.embedding.values;
    if (!Array.isArray(values)) {
      throw new ServiceUnavailableException('Embedding provider returned no values.');
    }

    return values.map((value) => {
      const numberValue = asNumber(value);
      if (numberValue === null) {
        throw new ServiceUnavailableException('Embedding provider returned a non-number value.');
      }
      return numberValue;
    });
  }

  private extractParts(response: unknown): GeminiPart[] {
    if (!isRecord(response) || !Array.isArray(response.candidates)) {
      return [];
    }

    const firstCandidate = response.candidates[0];
    if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) {
      return [];
    }

    const parts = firstCandidate.content.parts;
    if (!Array.isArray(parts)) {
      return [];
    }

    return parts.filter(isRecord).map((part) => {
      const geminiPart: GeminiPart = {};
      if (typeof part.text === 'string') {
        geminiPart.text = part.text;
      }
      const functionCall = this.extractFunctionCall(part.functionCall);
      if (functionCall) {
        geminiPart.functionCall = functionCall;
      }
      return geminiPart;
    });
  }

  private extractFunctionCall(value: unknown): GeminiPart['functionCall'] {
    if (!isRecord(value) || typeof value.name !== 'string') {
      return undefined;
    }
    return {
      name: value.name,
      args: isRecord(value.args) ? value.args : {},
    };
  }

  private extractUsage(response: unknown): AiGenerateResult['usage'] {
    if (!isRecord(response) || !isRecord(response.usageMetadata)) {
      return undefined;
    }
    const inputTokens = asNumber(response.usageMetadata.promptTokenCount);
    const outputTokens = asNumber(response.usageMetadata.candidatesTokenCount);
    return {
      ...(inputTokens === null ? {} : { inputTokens }),
      ...(outputTokens === null ? {} : { outputTokens }),
    };
  }
}
