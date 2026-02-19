import { Controller, Get, Post, Body, Param, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BoletoService } from './boleto.service';
import { CreateBoletoDto } from './dto/create-boleto.dto';
import { Response } from 'express';

@ApiTags('Boletos')
@Controller('boletos')
export class BoletoController {
    constructor(private readonly service: BoletoService) { }

    @Post()
    @ApiOperation({ summary: 'Emitir novo boleto' })
    async create(@Body() dto: CreateBoletoDto) {
        return this.service.emitir(dto);
    }

    @Get('pendentes')
    @ApiOperation({ summary: 'Listar boletos a vencer' })
    async pendentes() {
        return this.service.listarPendentes();
    }

    @Get('atrasados')
    @ApiOperation({ summary: 'Listar boletos vencidos' })
    async atrasados() {
        return this.service.listarAtrasados();
    }

    @Post(':nossoNumero/pagar')
    @ApiOperation({ summary: '[SIMULAÇÃO] Pagar boleto' })
    async pagar(@Param('nossoNumero') nossoNumero: string) {
        return this.service.simularPagamento(nossoNumero);
    }

    @Get(':nossoNumero/pdf')
    @ApiOperation({ summary: 'Visualizar boleto (HTML)' })
    async pdf(@Param('nossoNumero') nossoNumero: string, @Res() res: Response) {
        const buffer = await this.service.gerarPdf(nossoNumero);
        res.setHeader('Content-Type', 'text/html');
        res.send(buffer.toString());
    }

    @Get(':nossoNumero/status')
    @ApiOperation({ summary: 'Consultar status no Bradesco' })
    async consultar(@Param('nossoNumero') nossoNumero: string) {
        return this.service.consultar(nossoNumero);
    }

    @Post(':nossoNumero/alterar') // ou PUT
    @ApiOperation({ summary: 'Alterar/Manutenção boleto' })
    async alterar(@Param('nossoNumero') nossoNumero: string, @Body() body: any) {
        return this.service.alterar(nossoNumero, body);
    }

    @Post(':nossoNumero/cancelar')
    @ApiOperation({ summary: 'Baixar/Cancelar boleto' })
    async cancelar(@Param('nossoNumero') nossoNumero: string) {
        return this.service.baixar(nossoNumero, '20'); // 20 = Solicitacao do Beneficiario
    }
}
