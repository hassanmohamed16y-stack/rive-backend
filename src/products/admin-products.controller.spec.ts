import { ProductStatus } from "@prisma/client";
import { AdminProductsController } from "./admin-products.controller";

describe("AdminProductsController", () => {
  it("lists all product statuses through the admin controller path", async () => {
    const productsService = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByIdForAdmin: jest
        .fn()
        .mockResolvedValue({ id: "product-1", status: ProductStatus.DRAFT }),
    };
    const controller = new AdminProductsController(productsService as any);

    await controller.findAll(ProductStatus.DRAFT, { page: 1, limit: 20 });
    await expect(controller.findOne("product-1")).resolves.toMatchObject({
      id: "product-1",
      status: ProductStatus.DRAFT,
    });
    expect(productsService.findAll).toHaveBeenCalledWith(
      { status: ProductStatus.DRAFT },
      { page: 1, limit: 20 },
      true,
    );
    expect(productsService.findByIdForAdmin).toHaveBeenCalledWith("product-1");
  });
});
