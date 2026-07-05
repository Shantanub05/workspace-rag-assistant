import { BadRequestException } from '@nestjs/common';

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'application/octet-stream']);

export async function parseUploadedDocument(file: Express.Multer.File): Promise<string> {
  const lowerName = file.originalname.toLowerCase();

  if (TEXT_MIME_TYPES.has(file.mimetype) || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    return file.buffer.toString('utf8');
  }

  if (file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: file.buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  throw new BadRequestException('Only .txt, .md, and .pdf documents are supported.');
}
