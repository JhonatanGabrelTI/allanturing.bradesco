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
    if (!config) throw new BadRequestException('ConfiguraÃ§Ã£o nÃ£o encontrada');

    const cliente = await this.prisma.clientePagador.findUnique({
      where: { id: dto.clienteId },
    });
    if (!cliente) throw new BadRequestException('Cliente nÃ£o encontrado');

    // Prepara payload Bradesco (Novo Schema do UsuÃ¡rio)
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
      // Se for R$ 60.50, entÃ£o Ã© centavos. Se for R$ 6050.00, Ã© valor direto.
      // CNAB geralmente Ã© centavos sem ponto. O retorno tem vlTitulo: 6050.
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

      // Mapeia retorno especÃ­fico do novo layout
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
        mensagem: 'Boleto registrado com sucesso na API Bradesco',
        // Resposta completa espelhando a API Bradesco (campos principais)
        registraTitulo: retorno.registraTitulo || 1,
        cdRetorno: retorno.cdRetorno || 0,
        dsRetorno: retorno.dsRetorno || 'OPERACAO REALIZADA COM SUCESSO',
        nuTituloGerado: String(nossoNumero),
        cdBarras: codigoBarras,
        linhaDigitavel: linhaDigitavel,
        // Objeto boleto â€” detalhado para o modal do frontend
        boleto: {
          id: boleto.id,
          nossoNumero: boleto.nossoNumero,
          seuNumero: boleto.seuNumero,
          linhaDigitavel: boleto.linhaDigitavel,
          codigoBarras: boleto.codigoBarras,
          // valor em reais (float) e centavos (int) â€” ambos disponÃ­veis
          valor: Number(boleto.valorNominal),
          valorNominal: Number(boleto.valorNominal),
          vlNominalTitulo: Math.round(Number(boleto.valorNominal) * 100),
          // datas
          vencimento: boleto.dataVencimento,
          dataVencimento: boleto.dataVencimento,
          dtVencimentoTitulo: format(boleto.dataVencimento, 'dd.MM.yyyy'),
          dataEmissao: boleto.dataEmissao,
          dtEmissaoTitulo: format(boleto.dataEmissao, 'dd.MM.yyyy'),
          // sacado
          cliente: boleto.cliente.nome,
          sacado: {
            nome: boleto.cliente.nome,
            documento: boleto.cliente.documento,
            email: boleto.cliente.email,
            endereco: `${boleto.cliente.logradouro}, ${boleto.cliente.numero} - ${boleto.cliente.bairro}`,
            cidade: boleto.cliente.cidade,
            uf: boleto.cliente.uf,
            cep: boleto.cliente.cep,
          },
          // status
          statusCodigo: boleto.statusCodigo,
          statusDescricao: boleto.statusDescricao,
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
      include: { configuracao: true, cliente: true }
    });

    if (!boleto) throw new BadRequestException('Boleto nÃ£o encontrado para consulta');

    return {
      titulo: {
        nossoNumero: boleto.nossoNumero,
        seuNumero: boleto.seuNumero,
        status: boleto.statusDescricao || 'A VENCER',
        codStatus: parseInt(boleto.statusCodigo) || 1,
        valMoeda: Math.round(Number(boleto.valorNominal) * 100),
        dataEmissao: boleto.dataEmissao,
        dataVencimento: boleto.dataVencimento,
        dataPagamento: boleto.dataPagamento,
        valorPago: boleto.valorPago,
        pagador: boleto.cliente.nome,
      }
    };
  }

  async alterar(nossoNumero: string, dadosAlteracao: any = {}) {
    const boleto = await this.prisma.boleto.findUnique({
      where: { nossoNumero },
      include: { configuracao: true, cliente: true }
    });

    if (!boleto) throw new BadRequestException('Boleto nÃ£o encontrado para alteraÃ§Ã£o');

    const config = boleto.configuracao;
    const cliente = boleto.cliente;

    // ConstrÃ³i payload hierÃ¡rquico
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
        nomeSacador: "", // NÃ£o temos sacador avalista no modelo simples
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
        // Campos opcionais/zerados por padrÃ£o para manutenÃ§Ã£o
        protesto: { codInstrucaoProtesto: 0, qtdeDiasProtesto: 0 },
        decurso: { codDecursoPrazo: 0, diasDecursoPrazo: 0 },
        abatimento: { tipoAbatimento: 0, valorAbatimento: 0 },
        dataDesc1: 0, valDesc1: 0, codValDe1: 0, tipoDesc1: 0,
        // ... incluir outros campos se necessÃ¡rio
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

    if (!boleto) throw new BadRequestException('Boleto nÃ£o encontrado para baixa/estorno');

    const config = boleto.configuracao;

    // ConstruÃ§Ã£o do payload conforme layout de estorno fornecido
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
      include: { cliente: true, configuracao: true },
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
      include: { cliente: true, configuracao: true },
    });
  }

  async simularPagamento(nossoNumero: string) {
    const boleto = await this.prisma.boleto.update({
      where: { nossoNumero },
      data: {
        statusCodigo: '61',
        statusDescricao: 'PAGO',
        dataPagamento: new Date(),
        valorPago: { increment: 0 }, // mantÃ©m valor original
      },
      include: { cliente: true },
    });

    // Dispara webhook local (simulaÃ§Ã£o)
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
    const boleto = await this.prisma.boleto.findUnique({
      where: { nossoNumero },
      include: { cliente: true, configuracao: true },
    });

    if (!boleto) throw new BadRequestException('Boleto nÃ£o encontrado');

    const config = boleto.configuracao;
    const cliente = boleto.cliente;

    const valorFormatado = Number(boleto.valorNominal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataVenc = format(boleto.dataVencimento, 'dd/MM/yyyy');
    const dataEmissao = format(boleto.dataEmissao, 'dd/MM/yyyy');
    const dataProcessamento = format(new Date(), 'dd/MM/yyyy');

    const docCliente = cliente.documento.replace(/\D/g, '');
    const docDisplay = docCliente.length === 11
      ? docCliente.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : docCliente.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

    const cepFormatado = cliente.cep.replace(/(\d{5})(\d{3})/, '$1-$2');
    const enderecoCompleto = `${cliente.logradouro}, ${cliente.numero}${cliente.complemento ? ' ' + cliente.complemento : ''} - ${cliente.bairro} - ${cliente.cidade}/${cliente.uf} - CEP: ${cepFormatado}`;

    const linhaDigitavel = boleto.linhaDigitavel || '23790.00000 00000.000000 00000.000000 0 00000000000000';
    const codigoBarras = boleto.codigoBarras || '';

    // Gera barcode SVG — Interleaved 2 of 5 (I2of5) padrão boleto brasileiro
    const barcodeNumFormatado = codigoBarras
      ? codigoBarras.replace(/(\d{5})(?=\d)/g, '$1 ').trim()
      : '';

    const barcodeSvg = (() => {
      const svgW = 560;
      const barH = 60;
      const code = codigoBarras || '00000000000000000000000000000000000000000000';

      // Tabela I2of5: true = Wide, false = Narrow
      const i2of5: Record<string, boolean[]> = {
        '0': [false, false, true, true, false],
        '1': [true, false, false, false, true],
        '2': [false, true, false, false, true],
        '3': [true, true, false, false, false],
        '4': [false, false, true, false, true],
        '5': [true, false, true, false, false],
        '6': [false, true, true, false, false],
        '7': [false, false, false, true, true],
        '8': [true, false, false, true, false],
        '9': [false, true, false, true, false],
      };

      const N = 1;    // unidade estreita
      const W = 2.5;  // unidade larga

      // Sequência: [isBlack, larguraEmUnidades]
      const elems: Array<[boolean, number]> = [];

      // Start guard: 4 narrow (barra espaço barra espaço)
      elems.push([true, N], [false, N], [true, N], [false, N]);

      // Dados — pares de dígitos
      const padded = code.length % 2 === 0 ? code : '0' + code;
      for (let i = 0; i < padded.length; i += 2) {
        const p1 = i2of5[padded[i]] || [false, false, true, true, false];
        const p2 = i2of5[padded[i + 1]] || [false, false, true, true, false];
        for (let j = 0; j < 5; j++) {
          elems.push([true, p1[j] ? W : N]); // barra
          elems.push([false, p2[j] ? W : N]); // espaço
        }
      }

      // End guard: wide bar, narrow space, narrow bar
      elems.push([true, W], [false, N], [true, N]);

      // Escala para caber em svgW
      const totalUnits = elems.reduce((s, [, w]) => s + w, 0);
      const scale = svgW / totalUnits;

      let x = 0;
      const rects: string[] = [];
      for (const [isBar, units] of elems) {
        const w = units * scale;
        if (isBar) {
          rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barH}" fill="#000"/>`);
        }
        x += w;
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${barH}" viewBox="0 0 ${svgW} ${barH}" style="display:block;margin:0 auto;">${rects.join('')}</svg>`;
    })();

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Boleto ${boleto.nossoNumero}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #000;
    background: #fff;
    padding: 8mm 10mm;
  }
  .boleto { width: 100%; max-width: 210mm; margin: 0 auto; }

  /* ── HEADER ── */
  .hdr {
    display: flex;
    align-items: stretch;
    border: 1.5px solid #000;
    border-bottom: none;
  }
  .hdr-logo {
    padding: 3px 10px;
    border-right: 1.5px solid #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 100px;
  }
  .logo-name {
    font-size: 15pt;
    font-weight: 900;
    color: #cc0000;
    letter-spacing: -1px;
    line-height: 1;
  }
  .logo-sub {
    font-size: 6pt;
    color: #666;
    margin-top: 1px;
  }
  .hdr-code {
    padding: 4px 12px;
    font-size: 14pt;
    font-weight: 700;
    border-right: 1.5px solid #000;
    display: flex;
    align-items: center;
  }
  .hdr-linha {
    flex: 1;
    padding: 4px 8px;
    font-size: 10pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    letter-spacing: 0.5px;
  }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; }
  td {
    border: 1px solid #000;
    padding: 2px 4px;
    vertical-align: top;
    font-size: 8.5pt;
  }
  .lbl {
    font-size: 6.5pt;
    color: #000;
    font-weight: normal;
    display: block;
    margin-bottom: 1px;
  }
  .val {
    font-size: 8.5pt;
    font-weight: bold;
    display: block;
  }
  .val-lg { font-size: 10pt; font-weight: bold; }
  .val-red { font-size: 11pt; font-weight: bold; color: #cc0000; }
  .val-mono { font-family: 'Courier New', monospace; font-size: 8.5pt; font-weight: bold; }
  .ta-right { text-align: right; }
  .td-right { text-align: right; }

  /* ── INSTRUCOES ── */
  .instrucoes td { height: 60px; vertical-align: top; }

  /* ── CUT LINE ── */
  .cut-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 0 4px;
    color: #555;
    font-size: 7pt;
  }
  .cut-line::before, .cut-line::after {
    content: '';
    flex: 1;
    border-top: 1px dashed #888;
  }

  /* ── BARCODE AREA ── */
  .barcode-area {
    border: 1px solid #000;
    border-top: none;
    padding: 10px 8px 6px;
    text-align: center;
  }
  .barcode-num {
    font-family: 'Courier New', monospace;
    font-size: 7pt;
    letter-spacing: 1.5px;
    word-spacing: 4px;
    margin-top: 5px;
    color: #333;
  }

  /* ── FOOTER ── */
  .auth-line {
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #555;
    border: 1px solid #000;
    border-top: none;
    padding: 3px 6px;
  }

  /* ── SECTION TAG ── */
  .section-tag {
    font-size: 7pt;
    text-align: right;
    padding: 2px 0;
    color: #444;
  }

  /* ── PRINT BUTTON ── */
  .print-btn {
    display: block;
    margin: 14px auto 0;
    padding: 8px 28px;
    background: #cc0000;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 11pt;
    font-weight: bold;
    cursor: pointer;
    font-family: Arial, sans-serif;
  }
  .print-btn:hover { background: #990000; }

  @media print {
    body { padding: 0; }
    .print-btn { display: none; }
    .cut-line { page-break-after: avoid; }
  }
</style>
</head>
<body>
<div class="boleto">

<!-- ==================== RECIBO DO SACADO ==================== -->
<div class="section-tag">Recibo do Sacado</div>

<!-- HEADER recibo -->
<div class="hdr">
  <div class="hdr-logo">
    <div class="logo-name">Bradesco</div>
    <div class="logo-sub">Boleto de Cobran&ccedil;a</div>
  </div>
  <div class="hdr-code">237-D</div>
  <div class="hdr-linha">${linhaDigitavel}</div>
</div>

<table>
  <!-- Local de Pagamento + Vencimento -->
  <tr>
    <td style="width:72%">
      <span class="lbl">Local de Pagamento</span>
      <span class="val">Pag&aacute;vel preferencialmente na Rede Bradesco ou no Bradesco Expresso</span>
    </td>
    <td style="width:28%" class="td-right">
      <span class="lbl">Vencimento</span>
      <span class="val val-lg">${dataVenc}</span>
    </td>
  </tr>
  <!-- Beneficiário + Agência/Código -->
  <tr>
    <td>
      <span class="lbl">Nome do Benefici&aacute;rio / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val">${config.descricao || 'BENEFICIÁRIO'}</span>
    </td>
    <td class="td-right">
      <span class="lbl">Ag&ecirc;ncia / C&oacute;digo do Benefici&aacute;rio</span>
      <span class="val">${config.agencia || '0000'} / ${config.conta || '00000'}</span>
    </td>
  </tr>
  <!-- Data Doc | Nº Doc | Espécie | Aceite | Data Proc | Nosso-Número -->
  <tr>
    <td style="width:11%">
      <span class="lbl">Data do Documento</span>
      <span class="val">${dataEmissao}</span>
    </td>
    <td style="width:14%">
      <span class="lbl">N&uacute;mero do Documento</span>
      <span class="val val-mono">${boleto.seuNumero || '—'}</span>
    </td>
    <td style="width:8%">
      <span class="lbl">Esp&eacute;cie Doc.</span>
      <span class="val">DM</span>
    </td>
    <td style="width:6%">
      <span class="lbl">Aceite</span>
      <span class="val">N</span>
    </td>
    <td style="width:13%">
      <span class="lbl">Data Processamento</span>
      <span class="val">${dataProcessamento}</span>
    </td>
    <td class="td-right">
      <span class="lbl">Nosso-N&uacute;mero</span>
      <span class="val val-red">${boleto.nossoNumero}</span>
    </td>
  </tr>
  <!-- Uso Banco | CIP | Carteira | Moeda | Qtd | Valor | Valor Doc -->
  <tr>
    <td><span class="lbl">Uso do Banco</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">CIP</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">Carteira</span><span class="val">${config.carteira || '09'}</span></td>
    <td><span class="lbl">Moeda</span><span class="val">R$</span></td>
    <td><span class="lbl">Quantidade</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">Valor</span><span class="val">&nbsp;</span></td>
    <td class="td-right">
      <span class="lbl">Valor do Documento</span>
      <span class="val val-red">R&nbsp;${valorFormatado}</span>
    </td>
  </tr>
  <!-- Instruções + Encargos -->
  <tr class="instrucoes">
    <td colspan="5" style="vertical-align:top; height:50px;">
      <span class="lbl">Instru&ccedil;&otilde;es (Texto de responsabilidade do Benefici&aacute;rio)</span>
    </td>
    <td colspan="2" style="vertical-align:top; padding:0;">
      <table style="width:100%; height:100%; border:none;">
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt"><span class="lbl">(-) Desconto / Abatimento</span></td></tr>
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt"><span class="lbl">(+) Juros / Multa</span></td></tr>
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt"><span class="lbl">(+) Outros Acr&eacute;scimos</span></td></tr>
        <tr><td style="border:none; font-size:7.5pt"><span class="lbl">(=) Valor Cobrado</span></td></tr>
      </table>
    </td>
  </tr>
  <!-- Pagador -->
  <tr>
    <td colspan="7">
      <span class="lbl">Nome do Pagador / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val">${cliente.nome} &mdash; ${docDisplay}</span>
      <span style="font-size:7.5pt; display:block;">${enderecoCompleto}</span>
    </td>
  </tr>
  <!-- Beneficiário Final -->
  <tr>
    <td colspan="5">
      <span class="lbl">Nome do <u>Benefici&aacute;rio Final</u> / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val" style="color:#333">${config.descricao || '—'}</span>
    </td>
    <td colspan="2" class="td-right">
      <span class="lbl">C&oacute;d. Baixa</span>
      <span class="val">&nbsp;</span>
    </td>
  </tr>
</table>

<!-- ===================== CORTE ===================== -->
<div class="cut-line">&#9988; Corte aqui</div>

<!-- ==================== FICHA DE COMPENSAÇÃO ==================== -->
<div class="section-tag">Ficha de Compensa&ccedil;&atilde;o</div>

<!-- HEADER ficha -->
<div class="hdr">
  <div class="hdr-logo">
    <div class="logo-name">Bradesco</div>
    <div class="logo-sub">Boleto de Cobran&ccedil;a</div>
  </div>
  <div class="hdr-code">237-D</div>
  <div class="hdr-linha">${linhaDigitavel}</div>
</div>

<table>
  <tr>
    <td style="width:72%">
      <span class="lbl">Local de Pagamento</span>
      <span class="val">Pag&aacute;vel preferencialmente na Rede Bradesco ou no Bradesco Expresso</span>
    </td>
    <td style="width:28%" class="td-right">
      <span class="lbl">Vencimento</span>
      <span class="val val-lg">${dataVenc}</span>
    </td>
  </tr>
  <tr>
    <td>
      <span class="lbl">Nome do Benefici&aacute;rio / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val">${config.descricao || 'BENEFICIÁRIO'}</span>
    </td>
    <td class="td-right">
      <span class="lbl">Ag&ecirc;ncia / C&oacute;digo do Benefici&aacute;rio</span>
      <span class="val">${config.agencia || '0000'} / ${config.conta || '00000'}</span>
    </td>
  </tr>
  <tr>
    <td style="width:11%">
      <span class="lbl">Data do Documento</span>
      <span class="val">${dataEmissao}</span>
    </td>
    <td style="width:14%">
      <span class="lbl">N&uacute;mero do Documento</span>
      <span class="val val-mono">${boleto.seuNumero || '—'}</span>
    </td>
    <td style="width:8%">
      <span class="lbl">Esp&eacute;cie Doc.</span>
      <span class="val">DM</span>
    </td>
    <td style="width:6%">
      <span class="lbl">Aceite</span>
      <span class="val">N</span>
    </td>
    <td style="width:13%">
      <span class="lbl">Data Processamento</span>
      <span class="val">${dataProcessamento}</span>
    </td>
    <td class="td-right">
      <span class="lbl">Nosso-N&uacute;mero</span>
      <span class="val val-red">${boleto.nossoNumero}</span>
    </td>
  </tr>
  <tr>
    <td><span class="lbl">Uso do Banco</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">CIP</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">Carteira</span><span class="val">${config.carteira || '09'}</span></td>
    <td><span class="lbl">Moeda</span><span class="val">R$</span></td>
    <td><span class="lbl">Quantidade</span><span class="val">&nbsp;</span></td>
    <td><span class="lbl">Valor</span><span class="val">&nbsp;</span></td>
    <td class="td-right">
      <span class="lbl">Valor do Documento</span>
      <span class="val val-red">R&nbsp;${valorFormatado}</span>
    </td>
  </tr>
  <!-- Instruções + Encargos -->
  <tr class="instrucoes">
    <td colspan="5" style="vertical-align:top; height:60px;">
      <span class="lbl">Instru&ccedil;&otilde;es (Texto de responsabilidade do Benefici&aacute;rio)</span>
    </td>
    <td colspan="2" style="vertical-align:top; padding:0;">
      <table style="width:100%; height:100%; border:none;">
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt;padding:3px 4px"><span class="lbl">(-) Desconto / Abatimento</span></td></tr>
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt;padding:3px 4px"><span class="lbl">(+) Juros / Multa</span></td></tr>
        <tr><td style="border:none; border-bottom:1px solid #000; font-size:7.5pt;padding:3px 4px"><span class="lbl">(+) Outros Acr&eacute;scimos</span></td></tr>
        <tr><td style="border:none; font-size:7.5pt;padding:3px 4px"><span class="lbl">(=) Valor Cobrado</span></td></tr>
      </table>
    </td>
  </tr>
  <!-- Pagador -->
  <tr>
    <td colspan="7">
      <span class="lbl">Nome do Pagador / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val">${cliente.nome} &mdash; ${docDisplay}</span>
      <span style="font-size:7.5pt; display:block;">${enderecoCompleto}</span>
    </td>
  </tr>
  <!-- Beneficiário Final -->
  <tr>
    <td colspan="5">
      <span class="lbl">Nome do <u>Benefici&aacute;rio Final</u> / CPF-CNPJ / Endere&ccedil;o</span>
      <span class="val" style="color:#333">${config.descricao || '—'}</span>
    </td>
    <td colspan="2" class="td-right">
      <span class="lbl">C&oacute;d. Baixa</span>
      <span class="val">&nbsp;</span>
    </td>
  </tr>
</table>

<!-- BARCODE -->
<div class="barcode-area">
  ${barcodeSvg}
  <div class="barcode-num">${barcodeNumFormatado}</div>
</div>

<div class="auth-line">
  <span>&larr;&mdash; 10mm</span>
  <span style="font-weight:bold;">Autentica&ccedil;&atilde;o Mec&acirc;nica &mdash; Ficha de Compensa&ccedil;&atilde;o</span>
  <span>10mm &mdash;&rarr;</span>
</div>

<button class="print-btn" onclick="window.print()">&#128438; Imprimir / Salvar PDF</button>

</div><!-- /.boleto -->
</body>
</html>`;
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box- sizing: border - box;
  }

    body {
  font - family: 'Inter', Arial, sans - serif;
  background: #f0f2f5;
  color: #111;
  padding: 24px 16px 40px;
  font - size: 11px;
  line - height: 1.4;
}

    /* ── PAGE WRAPPER ── */
    .page {
  max - width: 800px;
  margin: 0 auto;
}

    /* ── BOLETO CARD ── */
    .boleto - card {
  background: #fff;
  border: 1px solid #c8c8c8;
  border - radius: 6px;
  overflow: hidden;
  box - shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
}

    /* ── SECTION SEPARATOR ── */
    .section - tag {
  font - size: 9px;
  font - weight: 700;
  letter - spacing: 1.5px;
  text - align: right;
  padding: 3px 8px;
  color: #555;
  background: #f8f8f8;
  border - top: 1px solid #ddd;
}

    /* ── ROW ── */
    .row {
  display: flex;
  border - bottom: 1px solid #d0d0d0;
}
    .row: last - child { border - bottom: none; }

    /* ── CELL ── */
    .cell {
  padding: 5px 8px;
  border - right: 1px solid #d0d0d0;
  min - height: 36px;
  display: flex;
  flex - direction: column;
  justify - content: space - between;
}
    .cell: last - child { border - right: none; }

    .lbl {
  font - size: 8.5px;
  color: #777;
  font - weight: 500;
  white - space: nowrap;
  margin - bottom: 2px;
}
    .val {
  font - size: 11px;
  font - weight: 600;
  color: #111;
}
    .val - lg {
  font - size: 14px;
  font - weight: 700;
  color: #111;
}
    .val - xl {
  font - size: 17px;
  font - weight: 700;
  color: #c0001f;
}
    .val - mono {
  font - family: 'Courier New', monospace;
  font - size: 11px;
  font - weight: 600;
  letter - spacing: 0.5px;
}
    .val - right { text - align: right; }

    /* ── HEADER ── */
    .boleto - header {
  display: flex;
  align - items: stretch;
  border - bottom: 2px solid #c0001f;
  background: #fff;
}
    .header - logo {
  display: flex;
  align - items: center;
  padding: 10px 14px;
  border - right: 2px solid #c0001f;
  gap: 0;
  flex - shrink: 0;
}
    .logo - text {
  font - size: 22px;
  font - weight: 900;
  color: #c0001f;
  letter - spacing: -1.5px;
  font - family: Arial, sans - serif;
}
    .banco - code {
  border - left: 2px solid #111;
  border - right: 2px solid #111;
  padding: 2px 10px;
  font - size: 18px;
  font - weight: 700;
  margin: 0 8px;
  color: #111;
  align - self: center;
  line - height: 1;
}
    .header - linha {
  flex: 1;
  display: flex;
  align - items: center;
  justify - content: flex - end;
  padding: 8px 12px;
  font - family: 'Courier New', monospace;
  font - size: 14px;
  font - weight: 700;
  letter - spacing: 0.8px;
  color: #111;
}

    /* ── CUT LINE ── */
    .cut - line {
  display: flex;
  align - items: center;
  gap: 8px;
  padding: 10px 0 6px;
  color: #888;
  font - size: 10px;
}
    .cut - line:: before,
    .cut - line::after {
  content: '';
  flex: 1;
  border - top: 1.5px dashed #aaa;
}

    /* ── INSTRUCOES ── */
    .instrucoes - area {
  min - height: 70px;
  padding: 6px 8px;
  border - right: 1px solid #d0d0d0;
  flex: 1;
}

    /* ── ENCARGOS ── */
    .encargos {
  flex: 0 0 170px;
  display: flex;
  flex - direction: column;
}
    .encargo - row {
  border - bottom: 1px solid #d0d0d0;
  padding: 4px 8px;
}
    .encargo - row: last - child { border - bottom: none; }

    /* ── BARCODE ── */
    .barcode - area {
  padding: 18px 0 10px;
  text - align: center;
  border - top: 1px solid #d0d0d0;
}
    .barcode - num {
  font - family: 'Courier New', monospace;
  font - size: 9px;
  color: #555;
  margin - top: 6px;
  letter - spacing: 0.5px;
}

    /* ── FOOTER AUTH ── */
    .footer - auth {
  display: flex;
  justify - content: space - between;
  align - items: center;
  padding: 5px 10px;
  background: #f8f8f8;
  border - top: 1px dashed #bbb;
  font - size: 9px;
  color: #666;
}

    /* ── PRINT BUTTON ── */
    .print - btn {
  display: flex;
  align - items: center;
  gap: 8px;
  margin: 20px auto 0;
  padding: 11px 32px;
  background: #c0001f;
  color: white;
  border: none;
  border - radius: 6px;
  font - size: 14px;
  font - weight: 700;
  cursor: pointer;
  font - family: 'Inter', Arial, sans - serif;
  box - shadow: 0 2px 8px rgba(192, 0, 31, 0.3);
  transition: background 0.15s;
}
    .print - btn:hover { background: #9a0018; }

@media print {
      body { background: white; padding: 0; }
      .boleto - card { box - shadow: none; border - radius: 0; }
      .print - btn { display: none; }
      .cut - line { page -break-after: always; }
}
</style>
  </head>
  < body >
  <div class="page" >

    <!-- ========================= RECIBO DO SACADO ========================= -->
      <div class="boleto-card" >

        <!--HEADER -->
          <div class="boleto-header" >
            <div class="header-logo" >
              <span class="logo-text" > Bradesco </span>
                < span class="banco-code" > 237 - D </span>
                  </div>
                  < div class="header-linha" > ${ linhaDigitavel } </div>
                    </div>

                    < !--Local de Pagamento + Vencimento-- >
                      <div class="row" >
                        <div class="cell" style = "flex:1;" >
                          <div class="lbl" > Local de Pagamento </div>
                            < div class="val" > Pag & aacute;vel Preferencialmente na Rede Bradesco ou no Bradesco Expresso </div>
                              </div>
                              < div class="cell" style = "flex:0 0 160px; align-items:flex-end;" >
                                <div class="lbl" > Vencimento </div>
                                  < div class="val-lg val-right" > ${ dataVenc } </div>
                                    </div>
                                    </div>

                                    < !--Beneficiário + Agência-- >
                                    <div class="row" >
                                      <div class="cell" style = "flex:1;" >
                                        <div class="lbl" > Nome do Benefici & aacute;rio / CPF - CNPJ / Endere & ccedil; o </div>
                                          < div class="val" > ${ config.descricao || 'BENEFICI&Aacute;RIO' } </div>
                                            </div>
                                            < div class="cell" style = "flex:0 0 200px; align-items:flex-end;" >
                                              <div class="lbl" > Ag & ecirc; ncia / C & oacute;digo do Benefici & aacute;rio </div>
                                                < div class="val val-right" > ${ config.agencia || '0000' } / ${config.conta || '00000'}</div >
                                                  </div>
                                                  </div>

                                                  < !--Data | Número Documento | Espécie | Aceite | Data Proc | Nosso - Número-- >
                                                    <div class="row" >
                                                      <div class="cell" style = "flex:0 0 100px;" >
                                                        <div class="lbl" > Data do Documento </div>
                                                          < div class= "val" > ${ dataEmissao } </div>
                                                            </div>
                                                            < div class="cell" style = "flex:0 0 120px;" >
                                                              <div class="lbl" > N & uacute;mero do Documento </div>
                                                                < div class= "val val-mono" > ${ boleto.seuNumero || '&mdash;' } </div>
                                                                  </div>
                                                                  < div class="cell" style = "flex:0 0 70px;" >
                                                                    <div class="lbl" > Esp & eacute;cie Doc.</div>
                                                                      < div class="val" > ${ boleto.especieDocumento || 'DM' } </div>
                                                                        </div>
                                                                        < div class="cell" style = "flex:0 0 50px;" >
                                                                          <div class="lbl" > Aceite </div>
                                                                            < div class="val" > N </div>
                                                                              </div>
                                                                              < div class="cell" style = "flex:0 0 110px;" >
                                                                                <div class="lbl" > Data Processamento </div>
                                                                                  < div class="val" > ${ dataProcessamento } </div>
                                                                                    </div>
                                                                                    < div class="cell" style = "flex:1; align-items:flex-end;" >
                                                                                      <div class="lbl" > Nosso - N & uacute; mero </div>
                                                                                        < div class="val-xl" > ${ boleto.nossoNumero } </div>
                                                                                          </div>
                                                                                          </div>

                                                                                          < !--Uso Banco | CIP | Carteira | Moeda | Quantidade | Valor | Valor do Documento-- >
                                                                                            <div class= "row" >
                                                                                            <div class="cell" style = "flex:0 0 80px;" > <div class="lbl" > Uso do Banco < /div><div class="val">&nbsp;</div > </div>
                                                                                              < div class= "cell" style = "flex:0 0 50px;" > <div class="lbl" > CIP < /div><div class="val">&nbsp;</div > </div>
                                                                                                < div class="cell" style = "flex:0 0 70px;" > <div class="lbl" > Carteira < /div><div class="val">${config.carteira || '09'}</div > </div>
                                                                                                  < div class="cell" style = "flex:0 0 60px;" > <div class="lbl" > Moeda < /div><div class="val">R$</div > </div>
                                                                                                    < div class="cell" style = "flex:0 0 90px;" > <div class="lbl" > Quantidade < /div><div class="val">&nbsp;</div > </div>
                                                                                                      < div class="cell" style = "flex:0 0 90px;" > <div class="lbl" > Valor < /div><div class="val">&nbsp;</div > </div>
                                                                                                        < div class="cell" style = "flex:1; align-items:flex-end;" >
                                                                                                          <div class="lbl" > Valor do Documento </div>
                                                                                                            < div class= "val-xl" > R & nbsp;${ valorFormatado } </div>
                                                                                                              </div>
                                                                                                              </div>

                                                                                                              < !--Informações + Encargos-- >
                                                                                                              <div class="row" style = "align-items:stretch;" >
                                                                                                                <div class="instrucoes-area" >
                                                                                                                  <div class="lbl" > Informa & ccedil;& otilde;es de responsabilidade do benefici & aacute;rio </div>
                                                                                                                    </div>
                                                                                                                    < div class="encargos" >
                                                                                                                      <div class="encargo-row" > <div class="lbl" > (=) Desconto / Abatimento < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                        < div class="encargo-row" > <div class="lbl" > (+) Juros / Multa < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                          < div class="encargo-row" > <div class="lbl" > (+) Outros Acr & eacute; scimos < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                            < div class="encargo-row" > <div class="lbl" > (=) Valor Cobrado < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                              </div>
                                                                                                                              </div>

                                                                                                                              < !--Pagador -->
                                                                                                                                <div class="row" style = "border-top:1px solid #d0d0d0;" >
                                                                                                                                  <div class="cell" style = "flex:1;" >
                                                                                                                                    <div class="lbl" > Nome do Pagador / CPF - CNPJ / Endere & ccedil;o </div>
                                                                                                                                      < div class="val" style = "margin-top:3px;" > ${ cliente.nome } & mdash; ${ docDisplay } </div>
                                                                                                                                        < div style = "font-size:10px; color:#444; margin-top:2px;" > ${ enderecoCompleto } </div>
                                                                                                                                          </div>
                                                                                                                                          </div>

                                                                                                                                          < div class="section-tag" > RECIBO DO SACADO </div>
                                                                                                                                            </div>

                                                                                                                                            < !-- ========================= CUT LINE ========================= -->
                                                                                                                                              <div class="cut-line" >&#9988; recorte aqui </div>

                                                                                                                                                < !-- ========================= FICHA DE COMPENSAÇÃO ========================= -->
                                                                                                                                                  <div class="boleto-card" >

                                                                                                                                                    <!--HEADER -->
                                                                                                                                                      <div class="boleto-header" >
                                                                                                                                                        <div class="header-logo" >
                                                                                                                                                          <span class="logo-text" > Bradesco </span>
                                                                                                                                                            < span class="banco-code" > 237 - D </span>
                                                                                                                                                              </div>
                                                                                                                                                              < div class="header-linha" > ${ linhaDigitavel } </div>
                                                                                                                                                                </div>

                                                                                                                                                                < !--Local + Vencimento-- >
                                                                                                                                                                <div class="row" >
                                                                                                                                                                  <div class="cell" style = "flex:1;" >
                                                                                                                                                                    <div class="lbl" > Local de Pagamento </div>
                                                                                                                                                                      < div class="val" > Pag & aacute;vel Preferencialmente na Rede Bradesco ou no Bradesco Expresso </div>
                                                                                                                                                                        </div>
                                                                                                                                                                        < div class="cell" style = "flex:0 0 160px; align-items:flex-end;" >
                                                                                                                                                                          <div class="lbl" > Vencimento </div>
                                                                                                                                                                            < div class="val-lg val-right" > ${ dataVenc } </div>
                                                                                                                                                                              </div>
                                                                                                                                                                              </div>

                                                                                                                                                                              < !--Beneficiário + Agência-- >
                                                                                                                                                                              <div class="row" >
                                                                                                                                                                                <div class="cell" style = "flex:1;" >
                                                                                                                                                                                  <div class="lbl" > Nome do Benefici & aacute;rio / CPF - CNPJ / Endere & ccedil; o </div>
                                                                                                                                                                                    < div class="val" > ${ config.descricao || 'BENEFICI&Aacute;RIO' } </div>
                                                                                                                                                                                      </div>
                                                                                                                                                                                      < div class="cell" style = "flex:0 0 200px; align-items:flex-end;" >
                                                                                                                                                                                        <div class="lbl" > Ag & ecirc; ncia / C & oacute;digo do Benefici & aacute;rio </div>
                                                                                                                                                                                          < div class="val val-right" > ${ config.agencia || '0000' } / ${config.conta || '00000'}</div >
                                                                                                                                                                                            </div>
                                                                                                                                                                                            </div>

                                                                                                                                                                                            < !--Datas / Nosso Número-- >
                                                                                                                                                                                              <div class="row" >
                                                                                                                                                                                                <div class="cell" style = "flex:0 0 100px;" >
                                                                                                                                                                                                  <div class="lbl" > Data do Documento </div>
                                                                                                                                                                                                    < div class= "val" > ${ dataEmissao } </div>
                                                                                                                                                                                                      </div>
                                                                                                                                                                                                      < div class="cell" style = "flex:0 0 120px;" >
                                                                                                                                                                                                        <div class="lbl" > N & uacute;mero do Documento </div>
                                                                                                                                                                                                          < div class= "val val-mono" > ${ boleto.seuNumero || '&mdash;' } </div>
                                                                                                                                                                                                            </div>
                                                                                                                                                                                                            < div class="cell" style = "flex:0 0 70px;" >
                                                                                                                                                                                                              <div class="lbl" > Esp & eacute;cie Doc.</div>
                                                                                                                                                                                                                < div class="val" > ${ boleto.especieDocumento || 'DM' } </div>
                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                  < div class="cell" style = "flex:0 0 50px;" >
                                                                                                                                                                                                                    <div class="lbl" > Aceite </div>
                                                                                                                                                                                                                      < div class="val" > N </div>
                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                        < div class="cell" style = "flex:0 0 110px;" >
                                                                                                                                                                                                                          <div class="lbl" > Data Processamento </div>
                                                                                                                                                                                                                            < div class="val" > ${ dataProcessamento } </div>
                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                              < div class="cell" style = "flex:1; align-items:flex-end;" >
                                                                                                                                                                                                                                <div class="lbl" > Nosso - N & uacute; mero </div>
                                                                                                                                                                                                                                  < div class="val-xl" > ${ boleto.nossoNumero } </div>
                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                    </div>

                                                                                                                                                                                                                                    < !--Uso Banco etc + Valor-- >
                                                                                                                                                                                                                                      <div class="row" >
                                                                                                                                                                                                                                        <div class="cell" style = "flex:0 0 80px;" > <div class="lbl" > Uso do Banco < /div><div class="val">&nbsp;</div > </div>
                                                                                                                                                                                                                                          < div class= "cell" style = "flex:0 0 50px;" > <div class="lbl" > CIP < /div><div class="val">&nbsp;</div > </div>
                                                                                                                                                                                                                                            < div class="cell" style = "flex:0 0 70px;" > <div class="lbl" > Carteira < /div><div class="val">${config.carteira || '09'}</div > </div>
                                                                                                                                                                                                                                              < div class="cell" style = "flex:0 0 60px;" > <div class="lbl" > Moeda < /div><div class="val">R$</div > </div>
                                                                                                                                                                                                                                                < div class="cell" style = "flex:0 0 90px;" > <div class="lbl" > Quantidade < /div><div class="val">&nbsp;</div > </div>
                                                                                                                                                                                                                                                  < div class="cell" style = "flex:0 0 90px;" > <div class="lbl" > Valor < /div><div class="val">&nbsp;</div > </div>
                                                                                                                                                                                                                                                    < div class="cell" style = "flex:1; align-items:flex-end;" >
                                                                                                                                                                                                                                                      <div class="lbl" > Valor do Documento </div>
                                                                                                                                                                                                                                                        < div class= "val-xl" > R & nbsp;${ valorFormatado } </div>
                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                          </div>

                                                                                                                                                                                                                                                          < !--Instruções + Encargos-- >
                                                                                                                                                                                                                                                          <div class="row" style = "align-items:stretch;" >
                                                                                                                                                                                                                                                            <div class="instrucoes-area" >
                                                                                                                                                                                                                                                              <div class="lbl" > Instru & ccedil;& otilde; es(Texto de responsabilidade do Benefici & aacute;rio)</div>
                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                < div class="encargos" >
                                                                                                                                                                                                                                                                  <div class="encargo-row" > <div class="lbl" > (=) Desconto / Abatimento < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                                                                                                                                                                    < div class="encargo-row" > <div class="lbl" > (+) Juros / Multa < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                                                                                                                                                                      < div class="encargo-row" > <div class="lbl" > (+) Outros Acr & eacute; scimos < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                                                                                                                                                                        < div class="encargo-row" > <div class="lbl" > (=) Valor Cobrado < /div><div class="val val-right">&nbsp;</div > </div>
                                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                                          </div>

                                                                                                                                                                                                                                                                          < !--Pagador -->
                                                                                                                                                                                                                                                                            <div class="row" style = "border-top:1px solid #d0d0d0;" >
                                                                                                                                                                                                                                                                              <div class="cell" style = "flex:1;" >
                                                                                                                                                                                                                                                                                <div class="lbl" > Nome do Pagador / CPF - CNPJ / Endere & ccedil;o </div>
                                                                                                                                                                                                                                                                                  < div class="val" style = "margin-top:3px;" > ${ cliente.nome } & mdash; ${ docDisplay } </div>
                                                                                                                                                                                                                                                                                    < div style = "font-size:10px; color:#444; margin-top:2px;" > ${ enderecoCompleto } </div>
                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                      </div>

                                                                                                                                                                                                                                                                                      < !--Beneficiário Final-- >
                                                                                                                                                                                                                                                                                        <div class="row" >
                                                                                                                                                                                                                                                                                          <div class="cell" style = "flex:1;" >
                                                                                                                                                                                                                                                                                            <div class="lbl" > Nome do <u>Benefici & aacute;rio Final < /u> / CPF - CNPJ / Endere & ccedil; o </div>
                                                                                                                                                                                                                                                                                              < div class="val" style = "color:#555;" > ${ config.descricao || '&mdash;' } </div>
                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                </div>

                                                                                                                                                                                                                                                                                                < !--BARCODE -->
                                                                                                                                                                                                                                                                                                  <div class="barcode-area" >
                                                                                                                                                                                                                                                                                                    ${ barcodeSvg }
<div style="font-family:'Courier New',monospace;font-size:11px;color:#444;text-align:center;margin-top:8px;letter-spacing:2px;word-spacing:6px;max-width:580px;margin-left:auto;margin-right:auto;" > ${ barcodeNumFormatado } </div>
  </div>

  < div class="footer-auth" >
    <span style="letter-spacing:1px;" >& larr;& mdash; 10mm </span>
      < span style = "font-weight:700; font-size:10px;" > Autentica & ccedil;& atilde;o Mec & acirc; nica & mdash; Ficha de Compensa & ccedil;& atilde; o </span>
        < span style = "letter-spacing:1px;" > 10mm & mdash;& rarr; </span>
          </div>

          </div>

          < !--PRINT BUTTON-- >
            <button class="print-btn" onclick = "window.print()" >
  &#128438; Imprimir / Salvar PDF
  </button>

  < /div><!-- /.page-- >
  </body>
  </html>`;

return Buffer.from(html);
  }

}
