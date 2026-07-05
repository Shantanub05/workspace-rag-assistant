import {
  BadRequestException,
  Controller,
  Get,
  Param,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentDto } from '@workspace-rag/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/authenticated-request';
import type { AppEnv } from '../config/env';
import { DocumentsService } from './documents.service';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ): Promise<DocumentDto[]> {
    return this.documents.list(user.id, workspaceId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentDto> {
    if (!file) {
      throw new BadRequestException('Document file is required.');
    }
    const maxBytes = this.config.get('MAX_UPLOAD_BYTES');
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(`File exceeds ${maxBytes} byte upload limit.`);
    }
    return this.documents.ingest(user.id, workspaceId, file);
  }
}
