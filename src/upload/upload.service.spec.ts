import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

jest.mock('./file-type-loader', () => ({
  loadFileTypeFromBuffer: jest.fn().mockResolvedValue((buffer: Buffer) => {
    const isPng = buffer.slice(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    return Promise.resolve(isPng ? { ext: 'png', mime: 'image/png' } : undefined);
  }),
}));

// A minimal, valid 1x1 PNG (magic bytes: 89 50 4E 47 0D 0A 1A 0A).
const PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100af5b9c4a0000000049454e44ae426082',
  'hex',
);

describe('UploadService', () => {
  const service = new UploadService();

  it('accepts a genuine PNG buffer during magic-byte validation', async () => {
    await expect(
      (service as any).validateMimeType({ buffer: PNG_BUFFER, mimetype: 'image/png', size: PNG_BUFFER.length }),
    ).resolves.toBeUndefined();
  });

  it('rejects disallowed declared mimetypes before checking magic bytes', async () => {
    await expect(
      (service as any).validateMimeType({ buffer: PNG_BUFFER, mimetype: 'image/gif', size: PNG_BUFFER.length }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
