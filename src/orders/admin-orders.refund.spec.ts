import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus } from "@prisma/client";
import { AdminOrdersController } from "./admin-orders.controller";
import { OrdersService } from "./orders.service";
import { PaymobService } from "../payment/paymob.service";

describe("AdminOrdersController", () => {
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

  it("delegates admin order detail and status changes to the centralized state machine", async () => {
    ordersService.findByIdForAdmin.mockResolvedValue({ id: "order-1", status: OrderStatus.PENDING });
    ordersService.transitionStatus.mockResolvedValue({ id: "order-1", status: OrderStatus.SHIPPED });

    await expect(controller.findOne("order-1")).resolves.toMatchObject({
      status: OrderStatus.PENDING,
    });
    await expect(
      controller.updateStatus("order-1", { status: OrderStatus.SHIPPED }, {
        user: { id: "admin-1" },
      } as any),
    ).resolves.toMatchObject({ status: OrderStatus.SHIPPED });
    expect(ordersService.findByIdForAdmin).toHaveBeenCalledWith("order-1");
    expect(ordersService.transitionStatus).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.SHIPPED,
      "admin-1",
    );
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
