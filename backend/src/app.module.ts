import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { BoletoModule } from './modules/boleto/boleto.module';
import { ClienteModule } from './modules/cliente/cliente.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PrismaService } from './shared/prisma.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        BullModule.forRoot({
            redis: {
                host: 'redis',
                port: 6379,
            },
        }),
        BoletoModule,
        ClienteModule,
        WebhookModule,
    ],
    providers: [PrismaService],
})
export class AppModule { }
