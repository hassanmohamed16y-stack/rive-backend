import { Reflector } from '@nestjs/core';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('UploadController', () => {
  it('delegates a successful upload to the service', async () => {
    const uploadService = {
      uploadImage: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/image.jpg', public_id: 'rive-products/image' }),
    };
    const controller = new UploadController(uploadService as any);
    const file = { buffer: Buffer.from('fake-image-bytes'), mimetype: 'image/jpeg', size: 1024 };

    await expect(controller.uploadImage(file as any)).resolves.toMatchObject({
      url: 'https://cdn.example.com/image.jpg',
      public_id: 'rive-products/image',
    });
    expect(uploadService.uploadImage).toHaveBeenCalledWith(file);
  });

  it('propagates a BadRequestException from the service for an invalid file (e.g. wrong MIME type or oversized)', async () => {
    const uploadService = { uploadImage: jest.fn().mockRejectedValue(new BadRequestException('Only JPEG, PNG, and WEBP images are allowed')) };
    const controller = new UploadController(uploadService as any);
    const file = { buffer: Buffer.from('not-an-image'), mimetype: 'application/pdf', size: 10 };

    await expect(controller.uploadImage(file as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the ADMIN role (guarded route metadata) for the upload endpoint', () => {
    const reflector = new Reflector();

    expect(reflector.get(ROLES_KEY, UploadController.prototype.uploadImage)).toEqual(['ADMIN']);
  });
});
