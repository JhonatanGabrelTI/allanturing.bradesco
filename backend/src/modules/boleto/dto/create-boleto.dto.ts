import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class CreateBoletoDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    clienteId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    seuNumero: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    valor: number;

    @ApiProperty({ description: 'Formato: YYYY-MM-DD' })
    @IsDateString()
    @IsNotEmpty()
    dataVencimento: string;

    @ApiProperty({ required: false, default: '02', description: '02=DM, 12=NP' })
    @IsString()
    @IsOptional()
    especie?: string;
}
