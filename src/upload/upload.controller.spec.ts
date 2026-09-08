import { Test, TestingModule } from "@nestjs/testing";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { UploadedImageFile } from "./uploaded-image-file.type";

describe("UploadController", () => {
  let controller: UploadController;
  let uploadService: jest.Mocked<UploadService>;

  beforeEach(async () => {
    const mockUploadService = {
      uploadImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: mockUploadService }],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadImage", () => {
    it("delegates image upload to UploadService", async () => {
      const mockFile: UploadedImageFile = {
        originalname: "test.png",
        mimetype: "image/png",
        buffer: Buffer.from("test-image"),
        size: 100,
      };

      const mockResponse = {
        public_id: "rive/test-public-id",
        url: "https://res.cloudinary.com/demo/image/upload/v123456/test.png",
      };

      uploadService.uploadImage.mockResolvedValue(mockResponse);

      const res = await controller.uploadImage(mockFile);

      expect(uploadService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(res).toBe(mockResponse);
    });
  });
});
