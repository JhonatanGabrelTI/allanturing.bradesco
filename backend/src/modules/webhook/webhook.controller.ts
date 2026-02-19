import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/prisma.service';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
    constructor(private prisma: PrismaService) { }

    @Post('bradesco')
    async receber(@Body() payload: any) {
        await this.prisma.webhookRecebido.create({
            data: {
                tipoEvento: payload.tipoEvento || 'desconhecido',
                payload: JSON.stringify(payload),
                nossoNumero: payload.nossoNumero,
            }
        });
        return { recebido: true };
    }

    @Get('logs')
    async logs() {
        return this.prisma.webhookRecebido.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
}
