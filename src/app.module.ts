import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    UploadModule,
    PaymentModule,
  ],
})
export class AppModule {}
