import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { HttpService } from '@nestjs/axios';
import { CreateBoletoDto } from './dto/create-boleto.dto';
import { BradescoApiService } from './bradesco-api.service';
import { firstValueFrom } from 'rxjs';
import { addDays, format } from 'date-fns';

@Injectable()
export class BoletoService {
    private readonly logger = new Logger(BoletoService.name);

    constructor(
        private prisma: PrismaService,
        private bradescoApi: BradescoApiService,
    ) { }

    async emitir(dto: CreateBoletoDto, configId: string = 'default') {
        const config = await this.prisma.configuracaoCobranca.findFirst();
        if (!config) throw new BadRequestException('Configuração não encontrada');

        const cliente = await this.prisma.clientePagador.findUnique({
            where: { id: dto.clienteId },
        });
        if (!cliente) throw new BadRequestException('Cliente não encontrado');

        // Prepara payload Bradesco (Novo Schema do Usuário)
        const payload = {
            registraTitulo: 1,
            nuCPFCNPJ: parseInt(config.cnpjRaiz || '0'),
            filialCPFCNPJ: parseInt(config.filial || '0'),
            ctrlCPFCNPJ: parseInt(config.controle || '0'),
            cdTipoAcesso: 2,
            clubBanco: 0,
            cdTipoContrato: 0,
            nuSequenciaContrato: 0,
            idProduto: parseInt(config.carteira || '9'), // 9 conforme exemplo
            nuNegociacao: parseInt(config.negociacao || '0'), // ex: 399500000000075557
            cdBanco: 237,
            nuSequenciaContrato2: 0,
            tpRegistro: 1,
            cdProduto: 1730, // fixo conforme exemplo ou config?
            nuTitulo: 0, // 0 para gerar novo
            nuCliente: dto.seuNumero || "WEBSERVICE",
            dtEmissaoTitulo: format(new Date(), 'dd.MM.yyyy'),
            dtVencimentoTitulo: format(new Date(dto.dataVencimento), 'dd.MM.yyyy'),
            tpVencimento: 0,
            vlNominalTitulo: Math.round(dto.valor * 100), // Valor em centavos? Exemplo mostra 6050 para R$ 60,50? 
            // O exemplo mostra vlNominalTitulo: 6050, e vlTitulo: 6050 na resposta.
            // Se for R$ 60.50, então é centavos. Se for R$ 6050.00, é valor direto.
            // CNAB geralmente é centavos sem ponto. O retorno tem vlTitulo: 6050.
            // Vamos assumir centavos.
            cdEspecieTitulo: parseInt(dto.especie || '01'), // 01=CH, 02=DM
            tpProtestoAutomaticoNegativacao: 0,
            prazoProtestoAutomaticoNegativacao: 0,
            controleParticipante: "",
            cdPagamentoParcial: "",
            qtdePagamentoParcial: 0,
            percentualJuros: 0,
            vlJuros: 0,
            qtdeDiasJuros: 0,
            percentualMulta: 0,
            vlMulta: 0,
            qtdeDiasMulta: 0,
            percentualDesconto1: 0,
            vlDesconto1: 0,
            dataLimiteDesconto1: "",
            percentualDesconto2: 0,
            vlDesconto2: 0,
            dataLimiteDesconto2: "",
            percentualDesconto3: 0,
            vlDesconto3: 0,
            dataLimiteDesconto3: "",
            prazoBonificacao: 0,
            percentualBonificacao: 0,
            vlBonificacao: 0,
            dtLimiteBonificacao: "",
            vlAbatimento: 0,
            vlIOF: 0,
            nomePagador: cliente.nome.substring(0, 70),
            logradouroPagador: cliente.logradouro.substring(0, 40),
            nuLogradouroPagador: cliente.numero.substring(0, 10),
            complementoLogradouroPagador: cliente.complemento?.substring(0, 15) || "",
            cepPagador: parseInt(cliente.cep.substring(0, 5)),
            complementoCepPagador: parseInt(cliente.cep.substring(5, 8) || '000'),
            bairroPagador: cliente.bairro.substring(0, 40),
            municipioPagador: cliente.cidade.substring(0, 30),
            ufPagador: cliente.uf,
            cdIndCpfcnpjPagador: cliente.tipoDocumento === '1' ? 1 : 2, // 1=CPF
            nuCpfcnpjPagador: parseInt(cliente.documento.replace(/\D/g, '')),
            endEletronicoPagador: cliente.email || "",
            nomeSacadorAvalista: "",
            logradouroSacadorAvalista: "",
            nuLogradouroSacadorAvalista: "",
            complementoLogradouroSacadorAvalista: "",
            cepSacadorAvalista: 0,
            complementoCepSacadorAvalista: 0,
            bairroSacadorAvalista: "",
            municipioSacadorAvalista: "",
            ufSacadorAvalista: "",
            cdIndCpfcnpjSacadorAvalista: 0,
            nuCpfcnpjSacadorAvalista: 0,
            enderecoSacadorAvalista: ""
        };

        try {
            const retorno = await this.bradescoApi.registrarBoleto(payload);

            // Mapeia retorno específico do novo layout
            const linhaDigitavel = retorno.linhaDigitavel;
            const codigoBarras = retorno.cdBarras || retorno.codigoBarras; // Fallback
            const nossoNumero = retorno.nuTituloGerado;

            const boleto = await this.prisma.boleto.create({
                data: {
                    configuracaoId: config.id,
                    clienteId: cliente.id,
                    nossoNumero: String(nossoNumero),
                    seuNumero: dto.seuNumero,
                    valorNominal: dto.valor,
                    dataEmissao: new Date(),
                    dataVencimento: new Date(dto.dataVencimento),
                    especieDocumento: dto.especie || '02',
                    linhaDigitavel: linhaDigitavel,
                    codigoBarras: codigoBarras,
                    statusCodigo: '01',
                    statusDescricao: 'A VENCER',
                    notificadoEmissao: true,
                },
                include: { cliente: true, configuracao: true },
            });

            return {
                sucesso: true,
                boleto: {
                    id: boleto.id,
                    nossoNumero: boleto.nossoNumero,
                    linhaDigitavel: boleto.linhaDigitavel,
                    valor: boleto.valorNominal,
                    vencimento: boleto.dataVencimento,
                    cliente: boleto.cliente.nome,
                    qrCode: "" // Específico se houver Pix
                }
            };

        } catch (error) {
            this.logger.error('Erro ao emitir boleto', error);
            throw error;
        }
    }

    async consultar(nossoNumero: string) {
        const boleto = await this.prisma.boleto.findUnique({
            where: { nossoNumero },
            include: { configuracao: true }
        });

        if (!boleto) throw new BadRequestException('Boleto não encontrado para consulta');

        const config = boleto.configuracao;
        const payload = {
            cpfCnpj: {
                cpfCnpj: parseInt(config.cnpjRaiz || '0'),
                filial: parseInt(config.filial || '0'),
                controle: parseInt(config.controle || '0')
            },
            produto: parseInt(config.carteira || '9'),
            negociacao: parseInt(config.negociacao || '0'),
            nossoNumero: parseInt(boleto.nossoNumero),
            sequencia: 0,
            status: 0
        };

        return this.bradescoApi.consultarBoleto(payload);
    }

    async alterar(nossoNumero: string, dadosAlteracao: any = {}) {
        const boleto = await this.prisma.boleto.findUnique({
            where: { nossoNumero },
            include: { configuracao: true, cliente: true }
        });

        if (!boleto) throw new BadRequestException('Boleto não encontrado para alteração');

        const config = boleto.configuracao;
        const cliente = boleto.cliente;

        // Constrói payload hierárquico
        const payload = {
            cpfCnpj: {
                cpfCnpj: parseInt(config.cnpjRaiz || '0'),
                filial: parseInt(config.filial || '0'),
                controle: parseInt(config.controle || '0')
            },
            produto: parseInt(config.carteira || '9'),
            negociacao: parseInt(config.negociacao || '0'),
            nossoNumero: parseInt(boleto.nossoNumero),
            dadosPagador: {
                sacado: cliente.nome.substring(0, 40),
                cpfCnpjSacado: {
                    cpfCnpj: parseInt(cliente.documento.replace(/\D/g, '')),
                    filial: 0,
                    controle: 0 // Simplificado
                },
                endereco: cliente.logradouro.substring(0, 40),
                cep: parseInt(cliente.cep.replace(/\D/g, '')),
                sufixo: 0, // Sufixo CEP?
                nomeSacador: "", // Não temos sacador avalista no modelo simples
                aceite: "S",
                cpfCnpjSacador: { cpfCnpj: 0, filial: 0, controle: 0 },
                emailSacado: cliente.email || ""
            },
            dadosTitulo: {
                seuNumero: boleto.seuNumero,
                dataEmissao: parseInt(format(boleto.dataEmissao, 'ddMMyyyy')),
                especie: boleto.especieDocumento,
                vencimento: {
                    dataVencimento: parseInt(format(dadosAlteracao.vencimento ? new Date(dadosAlteracao.vencimento) : boleto.dataVencimento, 'ddMMyyyy')),
                    tipoVencimento: 0
                },
                // Campos opcionais/zerados por padrão para manutenção
                protesto: { codInstrucaoProtesto: 0, qtdeDiasProtesto: 0 },
                decurso: { codDecursoPrazo: 0, diasDecursoPrazo: 0 },
                abatimento: { tipoAbatimento: 0, valorAbatimento: 0 },
                dataDesc1: 0, valDesc1: 0, codValDe1: 0, tipoDesc1: 0,
                // ... incluir outros campos se necessário
                codigoControleParticipante: "",
                indicadorAvisoSacado: "",
                comissaoPermanencia: { diasComissaoPermanencia: 0, valorComissaoPermanencia: 0, codigoComissaoPermanencia: 0 },
                codigoMulta: 0, diasMulta: 0, valorMulta: 0,
                codigoNegativacao: 0, diasNegativacao: 0,
                pagamentoParcial: "", qtdePagamentoParcial: 0
            }
        };

        return this.bradescoApi.alterarBoleto(payload);
    }

    async baixar(nossoNumero: string, motivo: string) {
        const boleto = await this.prisma.boleto.findUnique({
            where: { nossoNumero },
            include: { configuracao: true }
        });

        if (!boleto) throw new BadRequestException('Boleto não encontrado para baixa/estorno');

        const config = boleto.configuracao;

        // Construção do payload conforme layout de estorno fornecido
        const payload = {
            cpfCnpj: {
                cpfCnpj: parseInt(config.cnpjRaiz || '0'),
                filial: parseInt(config.filial || '0'),
                controle: parseInt(config.controle || '0')
            },
            produto: parseInt(config.carteira || '9'),
            negociacao: parseInt(config.negociacao || '0'),
            nossoNumero: parseInt(boleto.nossoNumero),
            sequencia: 0,
            horaSolicitacao: format(new Date(), 'yyyy-MM-dd-HH.mm.ss.SSSSSS'), // Ex: "2023-07-26-11.24.21.752018"
            status: 57, // Conforme exemplo
            statusAnterior: 1 // Conforme exemplo
        };

        return this.bradescoApi.baixarBoleto(payload);
    }

    async listarPendentes() {
        return this.prisma.boleto.findMany({
            where: {
                statusCodigo: '01',
                baixado: false,
                dataVencimento: { gte: new Date() },
            },
            include: { cliente: true },
            orderBy: { dataVencimento: 'asc' },
        });
    }

    async listarAtrasados() {
        return this.prisma.boleto.findMany({
            where: {
                statusCodigo: '01',
                dataVencimento: { lt: new Date() },
                baixado: false,
            },
            include: { cliente: true },
        });
    }

    async simularPagamento(nossoNumero: string) {
        const boleto = await this.prisma.boleto.update({
            where: { nossoNumero },
            data: {
                statusCodigo: '61',
                statusDescricao: 'PAGO',
                dataPagamento: new Date(),
                valorPago: { increment: 0 }, // mantém valor original
            },
            include: { cliente: true },
        });

        // Dispara webhook local (simulação)
        await this.prisma.webhookRecebido.create({
            data: {
                tipoEvento: 'liquidacao',
                nossoNumero,
                payload: JSON.stringify({ nossoNumero, valorPago: boleto.valorNominal, data: new Date() }),
            }
        });

        return { mensagem: 'Pagamento simulado com sucesso', boleto };
    }

    async gerarPdf(nossoNumero: string): Promise<Buffer> {
        // Simplificado: retorna um PDF dummy ou HTML
        const boleto = await this.prisma.boleto.findUnique({
            where: { nossoNumero },
            include: { cliente: true, configuracao: true },
        });

        if (!boleto) throw new BadRequestException('Boleto não encontrado');

        // Aqui você integraria o Puppeteer para gerar PDF real
        // Por ora, retornamos um HTML simples que o frontend pode exibir
        const html = `
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h1>Boleto de Cobrança</h1>
          <hr>
          <p><strong>Beneficiário:</strong> ${boleto.configuracao.descricao}</p>
          <p><strong>CNPJ:</strong> ${boleto.configuracao.cnpjRaiz}.${boleto.configuracao.filial}/${boleto.configuracao.controle}</p>
          <br>
          <p><strong>Pagador:</strong> ${boleto.cliente.nome}</p>
          <p><strong>Documento:</strong> ${boleto.cliente.documento}</p>
          <br>
          <p><strong>Nosso Número:</strong> ${boleto.nossoNumero}</p>
          <p><strong>Valor:</strong> R$ ${boleto.valorNominal}</p>
          <p><strong>Vencimento:</strong> ${format(boleto.dataVencimento, 'dd/MM/yyyy')}</p>
          <br>
          <p><strong>Linha Digitável:</strong></p>
          <p style="font-size: 18px; letter-spacing: 2px;">${boleto.linhaDigitavel}</p>
        </body>
      </html>
    `;

        return Buffer.from(html);
    }
}
