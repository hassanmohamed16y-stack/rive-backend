import { Test, TestingModule } from "@nestjs/testing";
import { AdminOrdersController } from "./admin-orders.controller";
import { OrdersService } from "./orders.service";
import { PaymobService } from "../payment/paymob.service";

describe("AdminOrdersController Refund Route", () => {
  let controller: AdminOrdersController;
  let ordersService: { findAll: jest.Mock; findByIdForAdmin: jest.Mock; transitionStatus: jest.Mock };
  let paymobService: { refundTransaction: jest.Mock };

  beforeEach(async () => {
    ordersService = {
      findAll: jest.fn(),
      findByIdForAdmin: jest.fn(),
      transitionStatus: jest.fn(),
    };
    paymobService = {
      refundTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymobService, useValue: paymobService },
      ],
    }).compile();

    controller = module.get<AdminOrdersController>(AdminOrdersController);
  });

  it("delegates refund request to PaymobService refundTransaction", async () => {
    paymobService.refundTransaction.mockResolvedValue({
      orderId: "order-123",
      refundedAmount: 150.0,
      paymobResponse: { success: true },
    });

    const result = await controller.refundOrder("order-123", { amount: 150.0 });

    expect(paymobService.refundTransaction).toHaveBeenCalledWith("order-123", 150.0);
    expect(result).toEqual({
      orderId: "order-123",
      refundedAmount: 150.0,
      paymobResponse: { success: true },
    });
  });
});
