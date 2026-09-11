import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { GoogleSheetsService } from "./google-sheets.service";

describe("GoogleSheetsService", () => {
  let service: GoogleSheetsService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SHEET_ID;

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleSheetsService],
    }).compile();

    service = module.get<GoogleSheetsService>(GoogleSheetsService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails gracefully and logs warning when credentials are missing", async () => {
    const result = await service.appendRow(["test1", "test2"]);
    expect(result).toEqual({ success: false });
  });

  it("throws BadRequestException on test row when credentials are missing", async () => {
    await expect(service.sendTestRow(["test1"])).rejects.toThrow(BadRequestException);
  });
});
