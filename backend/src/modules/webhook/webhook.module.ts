import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../../shared/prisma.service';

@Module({
    controllers: [WebhookController],
    providers: [PrismaService],
})
export class WebhookModule { }
