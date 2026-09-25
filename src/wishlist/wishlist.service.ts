import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(customerId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { customerId },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async addToWishlist(customerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }

    try {
      return await this.prisma.wishlistItem.create({
        data: {
          customerId,
          productId,
        },
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1 },
              category: true,
            },
          },
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("Product is already in wishlist");
      }
      throw error;
    }
  }

  async removeFromWishlist(customerId: string, productId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        customerId_productId: {
          customerId,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Product ${productId} was not found in user wishlist`,
      );
    }

    await this.prisma.wishlistItem.delete({
      where: { id: item.id },
    });

    return { success: true };
  }
}
