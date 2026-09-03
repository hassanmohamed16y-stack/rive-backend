import { BadRequestException } from '@nestjs/common';
import { fileTypeModuleLoader, UploadService } from './upload.service';

const pngBuffer = Buffer.from('89504e470d0a1a0a', 'hex');

describe('UploadService MIME validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a valid PNG upload', async () => {
    const service = new UploadService();
    jest.spyOn(fileTypeModuleLoader, 'load').mockResolvedValue({
      fileTypeFromBuffer: jest.fn().mockResolvedValue({ mime: 'image/png' }),
    });

    await expect(
      (service as any).validateMimeType({
        buffer: pngBuffer,
        mimetype: 'image/png',
        size: pngBuffer.length,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects spoofed uploads when magic bytes do not match the declared MIME type', async () => {
    const service = new UploadService();
    jest.spyOn(fileTypeModuleLoader, 'load').mockResolvedValue({
      fileTypeFromBuffer: jest.fn().mockResolvedValue({ mime: 'application/pdf' }),
    });

    await expect(
      (service as any).validateMimeType({
        buffer: Buffer.from('%PDF-1.7'),
        mimetype: 'image/png',
        size: 8,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
