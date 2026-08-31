import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: 'cm123abc456def',
    description: 'The unique order ID to create a checkout session for',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
