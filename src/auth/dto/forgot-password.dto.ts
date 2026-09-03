import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'aisha@example.com', maxLength: 254 })
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email!: string;
}
