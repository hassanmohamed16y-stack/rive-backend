import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

const importFileTypeModule = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<{
  fileTypeFromBuffer: (input: Uint8Array | ArrayBuffer) => Promise<{ mime: string } | undefined>;
}>;

export const fileTypeModuleLoader = {
  load: () => importFileTypeModule('file-type'),
};

@Injectable()
export class UploadService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  private async validateMimeType(file: UploadedFile) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file || !file.mimetype || !allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size must be 5MB or less.');
    }

    // Validate magic bytes to prevent spoofed file uploads
    const { fileTypeFromBuffer } = await fileTypeModuleLoader.load();
    const fileTypeResult = await fileTypeFromBuffer(file.buffer);
    if (!fileTypeResult || !allowed.includes(fileTypeResult.mime)) {
      throw new BadRequestException(
        'File magic bytes do not match declared MIME type. Only JPEG, PNG, and WEBP are allowed.',
      );
    }
  }

  async uploadImage(file: UploadedFile): Promise<{ url: string; public_id: string }> {
    await this.validateMimeType(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'rive-products',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error || !result) {
            reject(new BadRequestException('Failed to upload image to Cloudinary.'));
            return;
          }

          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      const bufferStream = streamifier.createReadStream(file.buffer);
      bufferStream.pipe(uploadStream);
    });
  }
}
