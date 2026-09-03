import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
