import { Test, TestingModule } from "@nestjs/testing";
import { AdminIntegrationsController } from "./admin-integrations.controller";
import { GoogleSheetsService } from "./google-sheets.service";

describe("AdminIntegrationsController", () => {
  let controller: AdminIntegrationsController;
  let googleSheetsService: { sendTestRow: jest.Mock };

  beforeEach(async () => {
    googleSheetsService = {
      sendTestRow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminIntegrationsController],
      providers: [{ provide: GoogleSheetsService, useValue: googleSheetsService }],
    }).compile();

    controller = module.get<AdminIntegrationsController>(AdminIntegrationsController);
  });

  it("delegates test row appending to GoogleSheetsService", async () => {
    googleSheetsService.sendTestRow.mockResolvedValue({ success: true, updatedRange: "Sheet1!A1:C1" });

    const result = await controller.testGoogleSheets({ rowData: ["Col1", "Col2"] });

    expect(googleSheetsService.sendTestRow).toHaveBeenCalledWith(["Col1", "Col2"]);
    expect(result).toEqual({ success: true, updatedRange: "Sheet1!A1:C1" });
  });
});
