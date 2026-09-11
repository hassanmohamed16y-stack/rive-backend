import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleSheetsService } from "./google-sheets.service";

describe("GoogleSheetsService", () => {
  let service: GoogleSheetsService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT;
    delete process.env.GOOGLE_SHEET_ID;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleSheetsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<GoogleSheetsService>(GoogleSheetsService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws BadRequestException on append row when credentials are missing", async () => {
    await expect(service.appendRow(["test1", "test2"])).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException on test row when credentials are missing", async () => {
    await expect(service.sendTestRow(["test1"])).rejects.toThrow(BadRequestException);
  });
});
