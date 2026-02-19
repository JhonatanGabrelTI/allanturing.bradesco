import { Module } from '@nestjs/common';
import { ClienteController } from './cliente.controller';
import { PrismaService } from '../../shared/prisma.service';

@Module({
    controllers: [ClienteController],
    providers: [PrismaService],
})
export class ClienteModule { }
