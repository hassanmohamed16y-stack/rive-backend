import * as crypto from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(userId: string): string {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    const shortUser = userId.slice(-4).toUpperCase();
    return `REF-${shortUser}${randomHex}`;
  }

  async getMyCode(userId: string) {
    let ref = await this.prisma.referralCode.findFirst({
      where: { customerId: userId },
    });

    if (!ref) {
      ref = await this.prisma.referralCode.create({
        data: {
          customerId: userId,
          code: this.generateCode(userId),
        },
      });
    }

    return ref;
  }

  async validateCode(code: string, currentUserId?: string) {
    const normalizedCode = code.trim().toUpperCase();
    const ref = await this.prisma.referralCode.findUnique({
      where: { code: normalizedCode },
      include: { customer: true },
    });

    if (!ref) {
      throw new NotFoundException(`Referral code "${normalizedCode}" is invalid`);
    }

    if (currentUserId && ref.customerId === currentUserId) {
      throw new BadRequestException("You cannot use your own referral code");
    }

    return {
      valid: true,
      discountPercent: 10,
      fixedDiscountAmount: 50,
      code: ref.code,
      referrerName: ref.customer?.fullName ?? "Friend",
    };
  }

  async recordReward(code: string, orderId?: string, discountAmount = 50) {
    const normalizedCode = code.trim().toUpperCase();
    const ref = await this.prisma.referralCode.findUnique({
      where: { code: normalizedCode },
    });

    if (!ref) return null;

    const [updatedRef, reward] = await this.prisma.$transaction([
      this.prisma.referralCode.update({
        where: { id: ref.id },
        data: { usesCount: { increment: 1 } },
      }),
      this.prisma.referralReward.create({
        data: {
          referralCodeId: ref.id,
          orderId,
          discountAmount,
        },
      }),
    ]);

    return { updatedRef, reward };
  }
}
