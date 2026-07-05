import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [AiModule],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
