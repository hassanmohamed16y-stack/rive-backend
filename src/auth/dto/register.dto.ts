import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum UserRoleType {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export class RegisterDto {
  @ApiProperty({ example: 'Aisha Rahman' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'aisha@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: UserRoleType, example: UserRoleType.CUSTOMER, required: false })
  @IsOptional()
  @IsEnum(UserRoleType)
  role?: UserRoleType;
}
