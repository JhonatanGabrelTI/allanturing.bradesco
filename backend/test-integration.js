const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const baseURL = 'http://localhost:3000';

async function runTest() {
    try {
        console.log('--- PREPARANDO AMBIENTE ---');

        // 0. Garantir Configuracao
        const configCount = await prisma.configuracaoCobranca.count();
        if (configCount === 0) {
            console.log('Criando Configuracao Padrao...');
            await prisma.configuracaoCobranca.create({
                data: {
                    descricao: "Config Teste",
                    cnpjRaiz: "12345678",
                    filial: "0001",
                    controle: "99"
                }
            });
        } else {
            console.log('Configuracao ja existe.');
        }

        console.log('\n--- INICIANDO TESTE DE API ---');

        // 1. Criar Cliente
        console.log('\n1. Criando Cliente...');
        const randomDoc = "123" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const clientePayload = {
            nome: "TESTE INTEGRACAO " + randomDoc,
            documento: randomDoc,
            email: `teste${randomDoc}@teste.com`,
            telefone: "11999999999",
            logradouro: "Rua Teste",
            numero: "123",
            complemento: "Apto 1",
            bairro: "Centro",
            cidade: "Sao Paulo",
            uf: "SP",
            cep: "01001000"
        };
        const clienteRes = await axios.post(`${baseURL}/clientes`, clientePayload);
        const clienteId = clienteRes.data.id;
        console.log('Cliente criado com ID:', clienteId);

        // 2. Registrar Boleto (Emitir)
        console.log('\n2. Registrando Boleto...');
        const boletoPayload = {
            clienteId: clienteId,
            valor: 60.50, // Testando valor que user mencionou
            dataVencimento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            seuNumero: "TESTE-" + Date.now(),
            especie: "01", // CH
            mensagem: "Teste de emissao"
        };
        const registroRes = await axios.post(`${baseURL}/boletos`, boletoPayload);
        console.log('Boleto registrado:', JSON.stringify(registroRes.data, null, 2));

        const boleto = registroRes.data.boleto;
        const nossoNumero = boleto.nossoNumero;

        if (!nossoNumero) {
            console.error('ERRO: Nosso Numero nao retornado!');
            return;
        }

        // 3. Consultar Boleto
        console.log('\n3. Consultando Boleto...');
        const consultaRes = await axios.get(`${baseURL}/boletos/${nossoNumero}/status`);
        console.log('Status do Boleto:', JSON.stringify(consultaRes.data, null, 2));

        // 4. Alterar Boleto
        console.log('\n4. Alterando Boleto...');
        const alteracaoPayload = {
            vencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        };
        const alteracaoRes = await axios.post(`${baseURL}/boletos/${nossoNumero}/alterar`, alteracaoPayload);
        console.log('Resultado Alteracao:', JSON.stringify(alteracaoRes.data, null, 2));

        // 5. Baixar/Cancelar Boleto
        console.log('\n5. Baixando Boleto...');
        const baixaRes = await axios.post(`${baseURL}/boletos/${nossoNumero}/cancelar`);
        console.log('Resultado Baixa:', JSON.stringify(baixaRes.data, null, 2));

        console.log('\n--- TESTES DE ERRO (BRUTE FORCE) ---');

        // 6. Teste de Erro: Consultar Boleto Inexistente
        console.log('\n6. Teste: Consultar Boleto Inexistente...');
        try {
            await axios.get(`${baseURL}/boletos/99999999999/status`);
        } catch (error) {
            console.log('Erro esperado capturado:', error.response?.status, error.response?.data?.message || 'Boleto não encontrado');
        }

        // 7. Teste de Erro: Registrar sem Cliente
        console.log('\n7. Teste: Registrar sem Cliente...');
        try {
            await axios.post(`${baseURL}/boletos`, { valor: 100 });
        } catch (error) {
            console.log('Erro esperado capturado:', error.response?.status, error.response?.data?.message || 'Dados inválidos');
        }

        console.log('\n--- TESTE FINALIZADO COM SUCESSO ---');

    } catch (error) {
        console.error('ERRO NO TESTE:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
