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
        const nossoNumero = Math.floor(10000000000 + Math.random() * 90000000000);
        // Gera linha digitável e código de barras fictícios compatíveis com o layout
        const valor = payload.vnmnalTitloCobr ? payload.vnmnalTitloCobr.toString().padStart(10, '0') : '0000000000';

        return {
            cidtfdProdCobr: payload.cidtfdProdCobr,
            cnegocCobr: payload.cnegocCobr,
            nuTituloGerado: nossoNumero, // Mantendo propriedade interna para compatibilidade, mas o real vem abaixo
            // Campos específicos do layout do usuário
            cdBarras: `237912340${valor}08560912345678901234567890`, // Mapped to internal interface
            linhaDigitavel: `23791.23456 ${nossoNumero.toString().substring(0, 5)}.${nossoNumero.toString().substring(5)} 89012.345678 1 1234${valor}`,

            // Exemplo de resposta (JSON) fornecido pelo usuário
            codBarras10: `237912340${valor}08560912345678901234567890`,
            linhaDig10: `23791.23456 ${nossoNumero.toString().substring(0, 5)}.${nossoNumero.toString().substring(5)} 89012.345678 1 1234${valor}`,
            wqrcdPdraoMercd: "00020101021226840014br.gov.bcb.pix...",

            // Demais campos zerados ou mockados conforme exemplo
            tp08Reg1: 0,
            status10: "REGISTRADO",
            codStatus10: 0,
            nomeSacado10: payload.nomeSacado10 || "CLIENTE TESTE",
            valMoeda10: payload.vnmnalTitloCobr,
            dataVencto10: payload.dvctoTitloCobr,
            nossoNumero: nossoNumero.toString() // Adicionado para facilitar mapeamento
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
