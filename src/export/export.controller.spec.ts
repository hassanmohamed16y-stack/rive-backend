import { Response } from "express";
import { CustomersExportController, OrdersExportController, PaymentsExportController } from "./export.controller";
import { ExportService } from "./export.service";

describe("ExportControllers", () => {
  let exportService: jest.Mocked<ExportService>;
  let ordersController: OrdersExportController;
  let customersController: CustomersExportController;
  let paymentsController: PaymentsExportController;

  let mockResponse: Partial<Response>;

  beforeEach(() => {
    exportService = {
      exportOrders: jest.fn().mockResolvedValue({
        buffer: Buffer.from("csv,data"),
        filename: "orders-export.csv",
        mimeType: "text/csv",
      }),
      exportCustomers: jest.fn().mockResolvedValue({
        buffer: Buffer.from("csv,data"),
        filename: "customers-export.csv",
        mimeType: "text/csv",
      }),
      exportPayments: jest.fn().mockResolvedValue({
        buffer: Buffer.from("csv,data"),
        filename: "payments-export.csv",
        mimeType: "text/csv",
      }),
    } as any;

    ordersController = new OrdersExportController(exportService);
    customersController = new CustomersExportController(exportService);
    paymentsController = new PaymentsExportController(exportService);

    mockResponse = {
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("OrdersExportController", () => {
    it("delegates to exportService and sets response headers for orders", async () => {
      const req = { user: { id: "admin-1" } } as any;
      await ordersController.exportOrders({ format: "csv" }, req, mockResponse as Response);

      expect(exportService.exportOrders).toHaveBeenCalledWith({ format: "csv" }, "admin-1");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="orders-export.csv"');
      expect(mockResponse.send).toHaveBeenCalledWith(Buffer.from("csv,data"));
    });
  });

  describe("CustomersExportController", () => {
    it("delegates to exportService and sets response headers for customers", async () => {
      const req = { user: { id: "admin-1" } } as any;
      await customersController.exportCustomers({ format: "csv" }, req, mockResponse as Response);

      expect(exportService.exportCustomers).toHaveBeenCalledWith({ format: "csv" }, "admin-1");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="customers-export.csv"');
      expect(mockResponse.send).toHaveBeenCalledWith(Buffer.from("csv,data"));
    });
  });

  describe("PaymentsExportController", () => {
    it("delegates to exportService and sets response headers for payments", async () => {
      const req = { user: { id: "admin-1" } } as any;
      await paymentsController.exportPayments({ format: "pdf" }, req, mockResponse as Response);

      expect(exportService.exportPayments).toHaveBeenCalledWith({ format: "pdf" }, "admin-1");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="payments-export.csv"');
      expect(mockResponse.send).toHaveBeenCalledWith(Buffer.from("csv,data"));
    });
  });
});
