import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}
