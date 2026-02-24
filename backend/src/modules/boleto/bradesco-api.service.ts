import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../shared/prisma.service';
import { firstValueFrom } from 'rxjs';
import { format } from 'date-fns';

@Injectable()
export class BradescoApiService {
    private readonly logger = new Logger(BradescoApiService.name);
    private readonly baseUrl = 'https://openapi.bradesco.com.br'; // Prod/Homolog base URL
    // Em sandbox/mock pode ser diferente, mas vamos estruturar para o real.

    constructor(
        private http: HttpService,
        private prisma: PrismaService,
    ) { }

    private async getHeaders() {
        // TODO: Implementar autenticação real (JWT / mTLS)
        // Por enquanto retorna headers básicos ou de mock
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.BRADESCO_TOKEN || 'mock-token'}`,
        };
    }

    async registrarBoleto(payload: any) {
        try {
            if (process.env.MOCK_BRADESCO === 'true') {
                return this.mockRegistrar(payload);
            }

            const headers = await this.getHeaders();
            const response = await firstValueFrom(
                this.http.post(`${this.baseUrl}/v1/boleto-hibrido/registrar-boleto`, payload, { headers })
            );
            return response.data;
        } catch (error) {
            this.logger.error('Erro ao registrar boleto na API Bradesco', error.response?.data || error.message);
            throw new BadRequestException('Erro ao registrar boleto no banco: ' + (error.response?.data?.message || error.message));
        }
    }

    async consultarBoleto(payload: any) {
        try {
            if (process.env.MOCK_BRADESCO === 'true') {
                return this.mockConsultar(payload);
            }

            const headers = await this.getHeaders();
            const response = await firstValueFrom(
                this.http.post(`${this.baseUrl}/v1/boleto/titulo-consultar`, payload, { headers })
            );
            return response.data;
        } catch (error) {
            throw new BadRequestException('Erro ao consultar boleto: ' + (error.response?.data?.message || error.message));
        }
    }

    async baixarBoleto(payload: any) {
        try {
            if (process.env.MOCK_BRADESCO === 'true') {
                return this.mockBaixar(payload);
            }

            const headers = await this.getHeaders();
            const response = await firstValueFrom(
                this.http.post(`${this.baseUrl}/v1/boleto/titulo-estorno`, payload, { headers })
            );
            return response.data;
        } catch (error) {
            throw new BadRequestException('Erro ao solicitar estorno/baixa: ' + (error.response?.data?.message || error.message));
        }
    }

    async alterarBoleto(payload: any) {
        try {
            if (process.env.MOCK_BRADESCO === 'true') {
                return this.mockAlterar(payload);
            }

            const headers = await this.getHeaders();
            const response = await firstValueFrom(
                // Endpoint hipotético para alteração, user não forneceu URL exata, assumindo algo similar
                this.http.post(`${this.baseUrl}/v1/boleto/titulo-alterar`, payload, { headers })
            );
            return response.data;
        } catch (error) {
            throw new BadRequestException('Erro ao alterar boleto: ' + (error.response?.data?.message || error.message));
        }
    }

    // --- MOCKS ---

    // ... existing mocks ...

    private mockAlterar(payload: any) {
        return {
            status: 200,
            transacao: "CBTTIAGP",
            mensagem: "CBTT0445 - ALTERACAO EFETUADA",
            causa: "CBTT0000 - OPERAÇÃO REALIZADA COM SUCESSO"
        };
    }

    private mockRegistrar(payload: any) {
        // Gera um nosso número fictício de 10 dígitos (padrão Bradesco)
        const nossoNumero = Math.floor(1000000000 + Math.random() * 9000000000);
        const nossoNumeroStr = nossoNumero.toString().padStart(10, '0');

        // Valor em centavos enviado pelo service (vlNominalTitulo)
        const valorCentavos = payload.vlNominalTitulo || 0;
        const valorPadded = valorCentavos.toString().padStart(10, '0');

        // Fator de vencimento (dias desde 07/10/1997 até hoje, simplificado)
        const base = new Date('1997-10-07').getTime();
        const fatorVencimento = Math.floor((Date.now() - base) / (1000 * 60 * 60 * 24));

        // Código de barras fictício: BBBMC.NNNNN NNNNN.BBBBBB BBBBB.BBBBB D FFFFF$$$$$$$$$$$
        const cdBarras = `23791${fatorVencimento}${valorPadded}2345${nossoNumeroStr}8901234567`;

        // Linha digitável no formato Bradesco: CAMPO1.DV CAMPO2.DV CAMPO3.DV DV FATORVALOR
        const linhaDigitavel = `23790.${nossoNumeroStr.substring(0, 5)}0 ${nossoNumeroStr.substring(5)}.901180 28009.${fatorVencimento} ${fatorVencimento % 10} ${fatorVencimento}${valorPadded}`;

        return {
            // Campos principais consumidos pelo boleto.service.ts
            nuTituloGerado: nossoNumero,
            cdBarras,
            linhaDigitavel,

            // Campos extras do formato Bradesco Open API (response real)
            registraTitulo: 1,
            cdRetorno: 0,
            dsRetorno: 'OPERACAO REALIZADA COM SUCESSO',
            status: 'REGISTRADO',
            codStatus: 0,

            // Dados do sacado (espelho do payload enviado)
            nomePagador: payload.nomePagador,
            nuCpfcnpjPagador: payload.nuCpfcnpjPagador,

            // Dados financeiros
            vlNominalTitulo: payload.vlNominalTitulo,
            dtEmissaoTitulo: payload.dtEmissaoTitulo,
            dtVencimentoTitulo: payload.dtVencimentoTitulo,
        };
    }

    private mockConsultar(payload: any) {
        return {
            status: 200,
            transacao: "CBTTIAGS",
            mensagem: "Operação realizada com sucesso.",
            causa: "CBTT0000 - OPERAÇÃO REALIZADA COM SUCESSO",
            titulo: {
                agencCred: 3987,
                ctaCred: 321,
                digCred: "2",
                razCredt: 7005,
                cip: 164,
                codStatus: 11,
                status: "COM BAIXA SOLICITADA",
                cedente: {
                    cnpj: payload.cpfCnpj?.cpfCnpj || 114383908000007,
                    nome: "ANTONIO DAS NEVES",
                    endereco: "TB02-RUA TEIXEIRA",
                    numero: "10",
                    complemento: "CASA AMARELA",
                    bairro: "TB02-VILA OLIMPIA",
                    cep: 4550,
                    cepc: "10",
                    cidade: "SAO PAULO",
                    uf: "SP"
                },
                sacado: {
                    cnpj: 340266998000062,
                    nome: "TESTE",
                    endereco: "TESTE",
                    bairro: "CENTRO",
                    cep: 6018,
                    cepc: "030",
                    cidade: "OSASCO",
                    uf: "SP"
                },
                enderecoEma: "",
                cebp: "N",
                debitoAuto: "N",
                aceite: "S",
                sacador: {
                    cnpj: 0,
                    nome: "",
                    endereco: "",
                    cep: 0,
                    cepc: "0",
                    cidade: "OSASCO",
                    uf: "SP"
                },
                cense: 2856,
                agenOper: 2856,
                bcoDepos: 237,
                agenDepos: 4152,
                snumero: "1",
                especDocto: "DM",
                descrEspec: "DUPLICATA DE VENDA MERCANTIL",
                dataReg: "21112022",
                dataEmis: "21112022",
                dataVencto: "29/01/2023",
                especMoeda: "R$",
                qtdeMoeda: 0,
                qtdeCas: 2,
                descrMoeda: "R$",
                valMoeda: 9000,
                valorIof: 0,
                valAbat: 50,
                dataMulta: "",
                diasMulta: 0,
                valMulta: 0,
                qtdeCasMul: 2,
                codValMul: 0,
                descrMulta: "",
                dataPerm: "",
                diasJuros: 0,
                valPerm: 0,
                codComisPerm: 0,
                dataDesc1: "10012023",
                valDesc1: 100,
                qtdeCasDe1: 2,
                codValDe1: 1,
                descrDesc1: "VALOR FIXO POR ANTECIPACAO ATE A DATA",
                dataDesc2: "",
                valDesc2: 0,
                qtdeCasDe2: 2,
                codValDe2: 0,
                descrDesc2: "",
                dataDesc3: "",
                valDesc3: 0,
                qtdeCasDe3: 2,
                codValDe3: 0,
                descrDesc3: "",
                dataInstr: "",
                diasProt: 15,
                dataCartor: "",
                numCartor: "",
                numProtoc: "",
                dataPedSus: "",
                dataSust: "",
                despCart: 0,
                bcoCentr: 0,
                ageCentr: 0,
                acessEsc: 0,
                tipEndo: "M",
                oriProt: 0,
                corige35: "N",
                ctpoVencto: 0,
                codInscrProt: 7,
                qtdDiasDecurPrz: 10,
                ctrlPartic: "",
                diasComisPerm: 0,
                qmoedaComisPerm: 0,
                indTitParceld: "N",
                indParcelaPrin: "N",
                indBoletoDda: "S",
                codBarras: "<NWnnwnNnWwwNnNwNnWnwnwWNnnnWWnnnWWnNnwWnNwNwnnNwwNWnNwnnwWNnnwNWnNNwwnnWnWnNwnwNwWnnNwnWNnnNwwNwwNNnWnnnWnnWNw>",
                linhaDig: "23792.85600 90039.991329 50023.011401 1 94560000008950",
                valorMoedaBol: 8950,
                dataVenctoBol: "28/08/2023",
                dataLimitePgt: "17/02/2023",
                dataImpressao: 28082023,
                horaImpressao: 185208,
                identTitDda: 0,
                exibeLinDig: "S",
                permitePgtoParcial: "N",
                qtdePgtoParcial: 0,
                dtPagto: 0,
                vlrPagto: 0.00,
                qtdPagto: 0,
                bcoProc: 0,
                ageProc: 0,
                baixa: {
                    codigo: 0,
                    descricao: "",
                    data: 0
                }
            }
        };
    }

    private mockBaixar(payload: any) {
        return {
            status: 200,
            transacao: "CBTTIAGR",
            mensagem: "CBTT0710 - SOLICITACAO DE ESTORNO EFETUADA COM SUCESSO"
        };
    }
}
