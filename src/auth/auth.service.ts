import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type UserRole = 'ADMIN' | 'CUSTOMER';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email: dto.email.toLowerCase(),
        passwordHash: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { passwordHash, ...safeUser } = user;

    return {
      accessToken: token,
      user: safeUser,
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordIsValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { passwordHash, ...safeUser } = user;

    return {
      accessToken: token,
      user: safeUser,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
