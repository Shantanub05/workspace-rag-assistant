import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env';
import { AI_PROVIDER } from './types';
import { GeminiProvider } from './gemini.provider';

@Module({
  providers: [
    GeminiProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, GeminiProvider],
      useFactory: (config: ConfigService<AppEnv, true>, gemini: GeminiProvider) => {
        const provider = config.get('AI_PROVIDER');
        if (provider !== 'gemini') {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
        return gemini;
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
