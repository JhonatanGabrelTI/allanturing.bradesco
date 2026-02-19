import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BoletoController } from './boleto.controller';
import { BoletoService } from './boleto.service';
import { PrismaService } from '../../shared/prisma.service';
import { BradescoApiService } from './bradesco-api.service';

@Module({
    imports: [HttpModule],
    controllers: [BoletoController],
    providers: [BoletoService, PrismaService, BradescoApiService],
})
export class BoletoModule { }
