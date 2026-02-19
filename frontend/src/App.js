import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

function App() {
    const [clientes, setClientes] = useState([]);
    const [boletos, setBoletos] = useState([]);
    const [activeTab, setActiveTab] = useState('emitir');

    // Form states
    const [clienteForm, setClienteForm] = useState({
        nome: '', documento: '', email: '', telefone: '',
        logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: ''
    });

    const [boletoForm, setBoletoForm] = useState({
        clienteId: '', seuNumero: '', valor: '', dataVencimento: ''
    });

    useEffect(() => {
        carregarDados();
        const interval = setInterval(carregarDados, 5000); // Atualiza a cada 5s
        return () => clearInterval(interval);
    }, []);

    const carregarDados = async () => {
        try {
            const [cliRes, bolRes] = await Promise.all([
                axios.get(`${API_URL}/clientes`),
                axios.get(`${API_URL}/boletos/pendentes`)
            ]);
            setClientes(cliRes.data);
            setBoletos(bolRes.data);
        } catch (e) {
            console.error('Erro ao carregar:', e);
        }
    };

    const criarCliente = async (e) => {
        e.preventDefault();
        await axios.post(`${API_URL}/clientes`, clienteForm);
        alert('Cliente cadastrado!');
        setClienteForm({ nome: '', documento: '', email: '', telefone: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' });
        carregarDados();
    };

    const emitirBoleto = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...boletoForm,
                valor: parseFloat(boletoForm.valor)
            };
            const res = await axios.post(`${API_URL}/boletos`, payload);
            alert(`Boleto emitido! Nosso Número: ${res.data.boleto.nossoNumero}`);
            setBoletoForm({ clienteId: '', seuNumero: '', valor: '', dataVencimento: '' });
            carregarDados();
        } catch (e) {
            alert('Erro ao emitir: ' + (e.response?.data?.message || e.message));
        }
    };

    const simularPagamento = async (nossoNumero) => {
        await axios.post(`${API_URL}/boletos/${nossoNumero}/pagar`);
        alert('Pagamento simulado!');
        carregarDados();
    };

    const verBoleto = (nossoNumero) => {
        window.open(`${API_URL}/boletos/${nossoNumero}/pdf`, '_blank');
    };

    const consultarBoleto = async (nossoNumero) => {
        try {
            const res = await axios.get(`${API_URL}/boletos/${nossoNumero}/status`);
            // Ajuste para novo schema de resposta
            const status = res.data.titulo?.status || res.data.status;
            const valor = res.data.titulo?.valMoeda ? (res.data.titulo.valMoeda / 100).toFixed(2) : '0.00';
            alert(`Status: ${status}\nValor: R$ ${valor}\nMensagem: ${res.data.mensagem}`);
        } catch (e) {
            alert('Erro ao consultar: ' + (e.response?.data?.message || e.message));
        }
    };

    const alterarBoleto = async (nossoNumero) => {
        const novaData = prompt("Informe a nova data de vencimento (YYYY-MM-DD):");
        if (!novaData) return;

        try {
            await axios.post(`${API_URL}/boletos/${nossoNumero}/alterar`, { vencimento: novaData });
            alert('Alteração solicitada com sucesso!');
            carregarDados();
        } catch (e) {
            alert('Erro ao alterar: ' + (e.response?.data?.message || e.message));
        }
    };

    const cancelarBoleto = async (nossoNumero) => {
        if (!window.confirm('Tem certeza que deseja cancelar este boleto?')) return;
        try {
            await axios.post(`${API_URL}/boletos/${nossoNumero}/cancelar`);
            alert('Cancelamento solicitado com sucesso!');
            carregarDados();
        } catch (e) {
            alert('Erro ao cancelar: ' + (e.response?.data?.message || e.message));
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <h1>🚀 Sistema de Cobrança Bradesco (Teste)</h1>

            <div style={{ marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
                <button onClick={() => setActiveTab('emitir')} style={{ padding: '10px 20px', marginRight: '10px', background: activeTab === 'emitir' ? '#007bff' : '#ccc', color: 'white', border: 'none' }}>Emitir Boleto</button>
                <button onClick={() => setActiveTab('clientes')} style={{ padding: '10px 20px', marginRight: '10px', background: activeTab === 'clientes' ? '#007bff' : '#ccc', color: 'white', border: 'none' }}>Cadastrar Cliente</button>
                <button onClick={() => setActiveTab('lista')} style={{ padding: '10px 20px', background: activeTab === 'lista' ? '#007bff' : '#ccc', color: 'white', border: 'none' }}>Boletos Emitidos</button>
            </div>

            {activeTab === 'clientes' && (
                <form onSubmit={criarCliente} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
                    <h3>Novo Pagador</h3>
                    <input placeholder="Nome completo" value={clienteForm.nome} onChange={e => setClienteForm({ ...clienteForm, nome: e.target.value })} required />
                    <input placeholder="CPF/CNPJ (somente números)" value={clienteForm.documento} onChange={e => setClienteForm({ ...clienteForm, documento: e.target.value })} required />
                    <input placeholder="Email" type="email" value={clienteForm.email} onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })} />
                    <input placeholder="Telefone (DDD+Número)" value={clienteForm.telefone} onChange={e => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
                    <input placeholder="Logradouro" value={clienteForm.logradouro} onChange={e => setClienteForm({ ...clienteForm, logradouro: e.target.value })} required />
                    <input placeholder="Número" value={clienteForm.numero} onChange={e => setClienteForm({ ...clienteForm, numero: e.target.value })} required />
                    <input placeholder="Bairro" value={clienteForm.bairro} onChange={e => setClienteForm({ ...clienteForm, bairro: e.target.value })} required />
                    <input placeholder="Cidade" value={clienteForm.cidade} onChange={e => setClienteForm({ ...clienteForm, cidade: e.target.value })} required />
                    <input placeholder="UF" maxLength="2" value={clienteForm.uf} onChange={e => setClienteForm({ ...clienteForm, uf: e.target.value })} required />
                    <input placeholder="CEP" value={clienteForm.cep} onChange={e => setClienteForm({ ...clienteForm, cep: e.target.value })} required />
                    <button type="submit" style={{ padding: '10px', background: '#28a745', color: 'white', border: 'none' }}>Cadastrar Cliente</button>
                </form>
            )}

            {activeTab === 'emitir' && (
                <form onSubmit={emitirBoleto} style={{ maxWidth: '500px' }}>
                    <h3>Emitir Novo Boleto</h3>
                    <select value={boletoForm.clienteId} onChange={e => setBoletoForm({ ...boletoForm, clienteId: e.target.value })} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                        <option value="">Selecione o cliente...</option>
                        {clientes.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} - {c.documento}</option>
                        ))}
                    </select>
                    <input placeholder="Seu Número (controle interno)" value={boletoForm.seuNumero} onChange={e => setBoletoForm({ ...boletoForm, seuNumero: e.target.value })} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                    <input placeholder="Valor (ex: 1500.50)" type="number" step="0.01" value={boletoForm.valor} onChange={e => setBoletoForm({ ...boletoForm, valor: e.target.value })} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                    <input placeholder="Data Vencimento (YYYY-MM-DD)" type="date" value={boletoForm.dataVencimento} onChange={e => setBoletoForm({ ...boletoForm, dataVencimento: e.target.value })} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                    <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', width: '100%' }}>Emitir Boleto</button>
                </form>
            )}

            {activeTab === 'lista' && (
                <div>
                    <h3>Boletos Pendentes</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f0f0f0' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Nosso Número</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Cliente</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Valor</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Vencimento</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boletos.map(b => (
                                <tr key={b.id}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{b.nossoNumero}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{b.cliente.nome}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>R$ {b.valorNominal}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{new Date(b.dataVencimento).toLocaleDateString()}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        <button onClick={() => verBoleto(b.nossoNumero)} style={{ marginRight: '5px', padding: '5px 10px', background: '#17a2b8', color: 'white', border: 'none' }}>Ver</button>
                                        <button onClick={() => simularPagamento(b.nossoNumero)} style={{ marginRight: '5px', padding: '5px 10px', background: '#28a745', color: 'white', border: 'none' }}>Pagar</button>
                                        <button onClick={() => consultarBoleto(b.nossoNumero)} style={{ marginRight: '5px', padding: '5px 10px', background: '#ffc107', color: 'black', border: 'none' }}>Consultar</button>
                                        <button onClick={() => alterarBoleto(b.nossoNumero)} style={{ marginRight: '5px', padding: '5px 10px', background: '#6f42c1', color: 'white', border: 'none' }}>Alterar</button>
                                        <button onClick={() => cancelarBoleto(b.nossoNumero)} style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none' }}>Cancelar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {boletos.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Nenhum boleto pendente</p>}
                </div>
            )}
        </div>
    );
}

export default App;
