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

  it("updates product image and retrieves price history", async () => {
    const productsService = {
      updateImage: jest.fn().mockResolvedValue({ id: "img-1", altText: "New Alt", isPrimary: true }),
      getPriceHistory: jest.fn().mockResolvedValue([{ id: "ph-1", oldPrice: 100, newPrice: 120 }]),
    };
    const controller = new AdminProductsController(productsService as any);

    const req = { user: { id: "user-1" } } as any;
    const imgRes = await controller.updateImage("prod-1", "img-1", { altText: "New Alt", isPrimary: true }, req);
    expect(productsService.updateImage).toHaveBeenCalledWith("prod-1", "img-1", { altText: "New Alt", isPrimary: true }, "user-1");
    expect(imgRes).toEqual({ id: "img-1", altText: "New Alt", isPrimary: true });

    const phRes = await controller.getPriceHistory("prod-1");
    expect(productsService.getPriceHistory).toHaveBeenCalledWith("prod-1");
    expect(phRes).toEqual([{ id: "ph-1", oldPrice: 100, newPrice: 120 }]);
  });
});
