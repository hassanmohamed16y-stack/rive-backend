import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: 'cm123abc456def',
    description: 'The unique order ID to create a checkout session for',
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  orderId!: string;
}
