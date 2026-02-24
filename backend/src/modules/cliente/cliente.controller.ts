import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../shared/prisma.service';

import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateClienteDto {
    @IsString()
    @IsNotEmpty()
    nome: string;

    @IsString()
    @IsNotEmpty()
    documento: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    telefone?: string;

    @IsString()
    @IsNotEmpty()
    logradouro: string;

    @IsString()
    @IsNotEmpty()
    numero: string;

    @IsString()
    @IsOptional()
    complemento?: string;

    @IsString()
    @IsNotEmpty()
    bairro: string;

    @IsString()
    @IsNotEmpty()
    cidade: string;

    @IsString()
    @IsNotEmpty()
    uf: string;

    @IsString()
    @IsNotEmpty()
    cep: string;
}

@ApiTags('Clientes (Pagadores)')
@Controller('clientes')
export class ClienteController {
    constructor(private prisma: PrismaService) { }

    @Post()
    @ApiOperation({ summary: 'Cadastrar novo pagador' })
    async create(@Body() data: CreateClienteDto) {
        return this.prisma.clientePagador.create({ data });
    }

    @Get()
    @ApiOperation({ summary: 'Listar pagadores' })
    async findAll() {
        return this.prisma.clientePagador.findMany({
            include: { _count: { select: { boletos: true } } }
        });
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.prisma.clientePagador.findUnique({
            where: { id },
            include: { boletos: true },
        });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remover um pagador' })
    async remove(@Param('id') id: string) {
        // First delete related boletos history, then boletos, then the client
        const boletos = await this.prisma.boleto.findMany({ where: { clienteId: id } });
        for (const boleto of boletos) {
            await this.prisma.historicoStatus.deleteMany({ where: { boletoId: boleto.id } });
        }
        await this.prisma.boleto.deleteMany({ where: { clienteId: id } });
        return this.prisma.clientePagador.delete({ where: { id } });
    }

    @Delete()
    @ApiOperation({ summary: 'Remover todos os pagadores' })
    async removeAll() {
        await this.prisma.historicoStatus.deleteMany({});
        await this.prisma.boleto.deleteMany({});
        return this.prisma.clientePagador.deleteMany({});
    }
}
