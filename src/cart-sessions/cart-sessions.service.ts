import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { SyncCartDto } from "./dto/sync-cart.dto";

@Injectable()
export class CartSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncCart(dto: SyncCartDto, customerId?: string) {
    if (dto.sessionId) {
      const existing = await this.prisma.cartSession.findUnique({
        where: { id: dto.sessionId },
      });

      if (existing) {
        return this.prisma.cartSession.update({
          where: { id: dto.sessionId },
          data: {
            items: dto.items as unknown as Prisma.InputJsonValue,
            lastActivityAt: new Date(),
            ...(customerId ? { customerId } : {}),
          },
        });
      }
    }

    return this.prisma.cartSession.create({
      data: {
        customerId: customerId || null,
        items: dto.items as unknown as Prisma.InputJsonValue,
        lastActivityAt: new Date(),
      },
    });
  }

  async getAbandonedCarts(inactivityMinutes = 30, pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const where = {
      lastActivityAt: { lte: cutoffDate },
    };

    const [data, total] = await Promise.all([
      this.prisma.cartSession.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { lastActivityAt: "desc" },
        skip,
        take,
      }),
      this.prisma.cartSession.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }
}
