import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000';

/* ============================================
   TOAST NOTIFICATION SYSTEM
   ============================================ */
let toastId = 0;

function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast--${t.type} ${t.exiting ? 'toast--exiting' : ''}`}>
                    <span className="toast__icon">
                        {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : t.type === 'warning' ? '⚠' : 'ℹ'}
                    </span>
                    <span className="toast__message">{t.message}</span>
                    <button className="toast__close" onClick={() => onRemove(t.id)}>×</button>
                </div>
            ))}
        </div>
    );
}

function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'info') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
        }, 4000);
    }, []);
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, []);
    return { toasts, addToast, removeToast };
}

/* ============================================
   BOLETO RESULT MODAL
   ============================================ */
function BoletoResultModal({ data, onClose }) {
    if (!data) return null;
    const b = data.boleto || {};
    const sacado = b.sacado || {};

    const valor = b.valor || b.valorNominal || 0;
    const vencimento = b.vencimento || b.dataVencimento;
    const nossoNumero = b.nossoNumero || data.nuTituloGerado || '';
    const linhaDigitavel = b.linhaDigitavel || data.linhaDigitavel || '';
    const codigoBarras = b.codigoBarras || data.cdBarras || '';

    const fmtDate = (d) => {
        if (!d) return '—';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('pt-BR');
    };
    const fmtValor = (v) => {
        if (!v && v !== 0) return 'R$ 0,00';
        return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };
    const fmtDoc = (doc) => {
        if (!doc) return '—';
        const d = String(doc).replace(/\D/g, '');
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return doc;
    };

    return (
        <div className="boleto-result" onClick={onClose}>
            <div className="boleto-result__card" onClick={e => e.stopPropagation()}>

                {/* Cabeçalho */}
                <div className="boleto-result__success">
                    <div className="boleto-result__icon">✓</div>
                    <h2 className="boleto-result__title">Boleto Registrado!</h2>
                    <p className="boleto-result__subtitle">{data.mensagem || data.dsRetorno || 'Boleto emitido com sucesso'}</p>
                    {data.cdRetorno !== undefined && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Retorno Bradesco:{' '}
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                                {data.cdRetorno} — {data.dsRetorno}
                            </span>
                        </p>
                    )}
                </div>

                {/* Dados do Título */}
                <div className="boleto-result__section">
                    <h4 className="boleto-result__section-title">📄 Dados do Título</h4>
                    <div className="boleto-result__row">
                        <span className="boleto-result__label">Nosso Número</span>
                        <span className="boleto-result__value boleto-result__value--mono">{nossoNumero}</span>
                    </div>
                    {b.seuNumero && (
                        <div className="boleto-result__row">
                            <span className="boleto-result__label">Seu Número</span>
                            <span className="boleto-result__value boleto-result__value--mono">{b.seuNumero}</span>
                        </div>
                    )}
                    <div className="boleto-result__row">
                        <span className="boleto-result__label">Valor do Documento</span>
                        <span className="boleto-result__value boleto-result__value--large">{fmtValor(valor)}</span>
                    </div>
                    {b.vlNominalTitulo !== undefined && (
                        <div className="boleto-result__row">
                            <span className="boleto-result__label">vlNominalTitulo (centavos)</span>
                            <span className="boleto-result__value boleto-result__value--mono">{b.vlNominalTitulo}</span>
                        </div>
                    )}
                    <div className="boleto-result__row">
                        <span className="boleto-result__label">Emissão</span>
                        <span className="boleto-result__value">{b.dtEmissaoTitulo || fmtDate(b.dataEmissao)}</span>
                    </div>
                    <div className="boleto-result__row">
                        <span className="boleto-result__label">Vencimento</span>
                        <span className="boleto-result__value">{b.dtVencimentoTitulo || fmtDate(vencimento)}</span>
                    </div>
                    <div className="boleto-result__row">
                        <span className="boleto-result__label">Status</span>
                        <span className="badge badge--success">● {b.statusDescricao || 'REGISTRADO'}</span>
                    </div>
                </div>

                {/* Dados do Sacado */}
                {(sacado.nome || b.cliente) && (
                    <div className="boleto-result__section">
                        <h4 className="boleto-result__section-title">👤 Sacado (Pagador)</h4>
                        <div className="boleto-result__row">
                            <span className="boleto-result__label">Nome</span>
                            <span className="boleto-result__value">{sacado.nome || b.cliente}</span>
                        </div>
                        {sacado.documento && (
                            <div className="boleto-result__row">
                                <span className="boleto-result__label">CPF/CNPJ</span>
                                <span className="boleto-result__value boleto-result__value--mono">{fmtDoc(sacado.documento)}</span>
                            </div>
                        )}
                        {sacado.endereco && (
                            <div className="boleto-result__row">
                                <span className="boleto-result__label">Endereço</span>
                                <span className="boleto-result__value" style={{ textAlign: 'right', maxWidth: '60%' }}>{sacado.endereco}</span>
                            </div>
                        )}
                        {sacado.cidade && (
                            <div className="boleto-result__row">
                                <span className="boleto-result__label">Cidade/UF</span>
                                <span className="boleto-result__value">{sacado.cidade}/{sacado.uf}</span>
                            </div>
                        )}
                        {sacado.email && (
                            <div className="boleto-result__row">
                                <span className="boleto-result__label">E-mail</span>
                                <span className="boleto-result__value">{sacado.email}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Linha Digitável */}
                {linhaDigitavel && (
                    <div className="boleto-result__barcode">
                        <div className="boleto-result__barcode-label">Linha Digitável</div>
                        <div className="boleto-result__barcode-value">{linhaDigitavel}</div>
                    </div>
                )}

                {/* Código de Barras */}
                {codigoBarras && (
                    <div className="boleto-result__barcode">
                        <div className="boleto-result__barcode-label">Código de Barras (cdBarras)</div>
                        <div className="boleto-result__barcode-value">{codigoBarras}</div>
                    </div>
                )}

                <div className="boleto-result__actions">
                    <button className="btn btn--primary" style={{ flex: 1 }} onClick={onClose}>Fechar</button>
                </div>
            </div>
        </div>
    );
}

/* ============================================
   ALTERAR MODAL
   ============================================ */
function AlterarModal({ nossoNumero, onClose, onConfirm }) {
    const [novaData, setNovaData] = useState('');
    if (!nossoNumero) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h3 className="modal__title">📅 Alterar Vencimento</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                    Boleto: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{nossoNumero}</span>
                </p>
                <div className="form-group">
                    <label className="form-label">Nova Data de Vencimento</label>
                    <input type="date" className="form-input" value={novaData} onChange={e => setNovaData(e.target.value)} />
                </div>
                <div className="modal__footer">
                    <button className="btn btn--danger btn--sm" onClick={onClose}>Cancelar</button>
                    <button className="btn btn--primary btn--sm" onClick={() => { onConfirm(novaData); onClose(); }} disabled={!novaData}>Confirmar</button>
                </div>
            </div>
        </div>
    );
}

/* ============================================
   CONFIRM MODAL (generic)
   ============================================ */
function ConfirmModal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', danger = false }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h3 className="modal__title">{title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>{message}</p>
                <div className="modal__footer">
                    <button className="btn btn--info btn--sm" onClick={onClose}>Cancelar</button>
                    <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'} btn--sm`} onClick={() => { onConfirm(); onClose(); }}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ============================================
   MAIN APP
   ============================================ */
function App() {
    const [clientes, setClientes] = useState([]);
    const [boletos, setBoletos] = useState([]);
    const [activeTab, setActiveTab] = useState('emitir');
    const [boletoResult, setBoletoResult] = useState(null);
    const [alterarTarget, setAlterarTarget] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const { toasts, addToast, removeToast } = useToast();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    const [clienteForm, setClienteForm] = useState({
        nome: '', documento: '', email: '', telefone: '',
        logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: ''
    });

    const [boletoForm, setBoletoForm] = useState({
        clienteId: '', seuNumero: '', valor: '', dataVencimento: ''
    });

    const carregarDados = useCallback(async () => {
        try {
            const [cliRes, pendRes, atrasRes] = await Promise.all([
                axios.get(`${API_URL}/clientes`),
                axios.get(`${API_URL}/boletos/pendentes`),
                axios.get(`${API_URL}/boletos/atrasados`)
            ]);
            setClientes(cliRes.data);
            // Combine pending + overdue boletos, deduplicate by id
            const allBoletos = [...pendRes.data, ...atrasRes.data];
            const unique = allBoletos.filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);
            setBoletos(unique);
        } catch (e) {
            // silently fail for polling
        }
    }, []);

    useEffect(() => {
        carregarDados();
        const interval = setInterval(carregarDados, 5000);
        return () => clearInterval(interval);
    }, [carregarDados]);

    const criarCliente = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/clientes`, clienteForm);
            addToast('Cliente cadastrado com sucesso!', 'success');
            setClienteForm({ nome: '', documento: '', email: '', telefone: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' });
            carregarDados();
        } catch (err) {
            addToast('Erro ao cadastrar: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const emitirBoleto = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...boletoForm, valor: parseFloat(boletoForm.valor) };
            const res = await axios.post(`${API_URL}/boletos`, payload);
            setBoletoResult(res.data);
            setBoletoForm({ clienteId: '', seuNumero: '', valor: '', dataVencimento: '' });
            carregarDados();
        } catch (err) {
            addToast('Erro ao emitir boleto: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const simularPagamento = async (nossoNumero) => {
        try {
            await axios.post(`${API_URL}/boletos/${nossoNumero}/pagar`);
            addToast('Pagamento simulado com sucesso!', 'success');
            carregarDados();
        } catch (err) {
            addToast('Erro: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const verBoleto = (nossoNumero) => {
        window.open(`${API_URL}/boletos/${nossoNumero}/pdf`, '_blank');
    };

    const consultarBoleto = async (nossoNumero) => {
        try {
            const res = await axios.get(`${API_URL}/boletos/${nossoNumero}/status`);
            const status = res.data.titulo?.status || res.data.status || 'Desconhecido';
            const valor = res.data.titulo?.valMoeda ? (res.data.titulo.valMoeda / 100).toFixed(2) : '0.00';
            addToast(`Status: ${status} | Valor: R$ ${valor}`, 'info');
        } catch (err) {
            addToast('Erro: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const alterarBoleto = async (nossoNumero, novaData) => {
        try {
            await axios.post(`${API_URL}/boletos/${nossoNumero}/alterar`, { vencimento: novaData });
            addToast('Vencimento alterado com sucesso!', 'success');
            carregarDados();
        } catch (err) {
            addToast('Erro: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const cancelarBoleto = async (nossoNumero) => {
        try {
            await axios.post(`${API_URL}/boletos/${nossoNumero}/cancelar`);
            addToast('Boleto cancelado com sucesso!', 'warning');
            carregarDados();
        } catch (err) {
            addToast('Erro: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const removerCliente = async (id, nome) => {
        try {
            await axios.delete(`${API_URL}/clientes/${id}`);
            addToast(`Cliente "${nome}" removido com sucesso!`, 'success');
            carregarDados();
        } catch (err) {
            addToast('Erro ao remover: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const removerTodosClientes = async () => {
        try {
            await axios.delete(`${API_URL}/clientes`);
            addToast('Todos os clientes foram removidos!', 'warning');
            carregarDados();
        } catch (err) {
            addToast('Erro ao remover: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const totalValor = boletos.reduce((acc, b) => acc + Number(b.valorNominal || 0), 0);

    const formatDoc = (doc) => {
        if (!doc) return '';
        const d = doc.replace(/\D/g, '');
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return doc;
    };

    return (
        <div className="app-container">
            <ToastContainer toasts={toasts} onRemove={removeToast} />

            {/* HEADER */}
            <header className="app-header">
                <div className="app-header__brand">
                    <div className="app-header__logo">🏦</div>
                    <div>
                        <h1 className="app-header__title">Sistema de Cobrança</h1>
                        <p className="app-header__subtitle">Bradesco — Registro e gestão de boletos</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}>
                        <span className="theme-toggle__icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
                        {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
                    </button>
                    <div className="app-header__status">
                        <span className="app-header__status-dot"></span>
                        Modo Teste
                    </div>
                </div>
            </header>

            {/* STATS */}
            <div className="stats-bar">
                <div className="stat-card">
                    <span className="stat-card__icon">👥</span>
                    <p className="stat-card__label">Clientes</p>
                    <p className="stat-card__value">{clientes.length}</p>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">📄</span>
                    <p className="stat-card__label">Boletos Pendentes</p>
                    <p className="stat-card__value">{boletos.length}</p>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">💰</span>
                    <p className="stat-card__label">Valor Total</p>
                    <p className="stat-card__value">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">📊</span>
                    <p className="stat-card__label">Status</p>
                    <p className="stat-card__value" style={{ fontSize: '16px', color: 'var(--success)' }}>Ativo</p>
                </div>
            </div>

            {/* NAVIGATION */}
            <nav className="nav-tabs">
                <button className={`nav-tab ${activeTab === 'emitir' ? 'nav-tab--active' : ''}`} onClick={() => setActiveTab('emitir')}>
                    <span className="nav-tab__icon">📝</span> Emitir Boleto
                </button>
                <button className={`nav-tab ${activeTab === 'clientes' ? 'nav-tab--active' : ''}`} onClick={() => setActiveTab('clientes')}>
                    <span className="nav-tab__icon">👤</span> Cadastrar Cliente
                </button>
                <button className={`nav-tab ${activeTab === 'clientesLista' ? 'nav-tab--active' : ''}`} onClick={() => setActiveTab('clientesLista')}>
                    <span className="nav-tab__icon">👥</span> Clientes Cadastrados
                </button>
                <button className={`nav-tab ${activeTab === 'lista' ? 'nav-tab--active' : ''}`} onClick={() => setActiveTab('lista')}>
                    <span className="nav-tab__icon">📋</span> Boletos Emitidos
                </button>
            </nav>

            {/* TAB: EMITIR BOLETO */}
            {activeTab === 'emitir' && (
                <div className="panel">
                    <div className="panel__header">
                        <div>
                            <h2 className="panel__title">
                                <span className="panel__title-icon">📝</span> Emitir Novo Boleto
                            </h2>
                            <p className="panel__description">Preencha os dados para registrar um novo boleto de cobrança</p>
                        </div>
                    </div>
                    <form onSubmit={emitirBoleto} className="form-grid form-grid--2col">
                        <div className="form-group form-group--full">
                            <label className="form-label">Pagador</label>
                            <select className="form-select" value={boletoForm.clienteId} onChange={e => setBoletoForm({ ...boletoForm, clienteId: e.target.value })} required>
                                <option value="">Selecione um cliente cadastrado...</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome} — {c.documento}</option>
                                ))}
                            </select>
                            {clientes.length === 0 && <span className="form-hint">Nenhum cliente cadastrado. Use a aba "Cadastrar Cliente" primeiro.</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Seu Número</label>
                            <input className="form-input" placeholder="Controle interno" value={boletoForm.seuNumero} onChange={e => setBoletoForm({ ...boletoForm, seuNumero: e.target.value })} required />
                            <span className="form-hint">Número de controle da sua empresa</span>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Valor (R$)</label>
                            <input className="form-input" placeholder="0,00" type="number" step="0.01" min="0.01" value={boletoForm.valor} onChange={e => setBoletoForm({ ...boletoForm, valor: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Data de Vencimento</label>
                            <input className="form-input" type="date" value={boletoForm.dataVencimento} onChange={e => setBoletoForm({ ...boletoForm, dataVencimento: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button type="submit" className="btn btn--primary btn--lg btn--full">🚀 Emitir Boleto</button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB: CADASTRAR CLIENTE */}
            {activeTab === 'clientes' && (
                <div className="panel">
                    <div className="panel__header">
                        <div>
                            <h2 className="panel__title">
                                <span className="panel__title-icon">👤</span> Novo Pagador
                            </h2>
                            <p className="panel__description">Cadastre um novo pagador para emitir boletos</p>
                        </div>
                    </div>
                    <form onSubmit={criarCliente}>
                        <div className="form-grid form-grid--2col" style={{ marginBottom: '24px' }}>
                            <div className="form-group form-group--full" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                                <span className="form-label" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>📋 Dados Pessoais</span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nome Completo</label>
                                <input className="form-input" placeholder="Nome do pagador" value={clienteForm.nome} onChange={e => setClienteForm({ ...clienteForm, nome: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CPF / CNPJ</label>
                                <input className="form-input" placeholder="Somente números" value={clienteForm.documento} onChange={e => setClienteForm({ ...clienteForm, documento: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-mail</label>
                                <input className="form-input" type="email" placeholder="email@exemplo.com" value={clienteForm.email} onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-input" placeholder="DDD + Número" value={clienteForm.telefone} onChange={e => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-grid form-grid--3col">
                            <div className="form-group form-group--full" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                                <span className="form-label" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>📍 Endereço</span>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Logradouro</label>
                                <input className="form-input" placeholder="Rua, Avenida..." value={clienteForm.logradouro} onChange={e => setClienteForm({ ...clienteForm, logradouro: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Número</label>
                                <input className="form-input" placeholder="Nº" value={clienteForm.numero} onChange={e => setClienteForm({ ...clienteForm, numero: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bairro</label>
                                <input className="form-input" placeholder="Bairro" value={clienteForm.bairro} onChange={e => setClienteForm({ ...clienteForm, bairro: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cidade</label>
                                <input className="form-input" placeholder="Cidade" value={clienteForm.cidade} onChange={e => setClienteForm({ ...clienteForm, cidade: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">UF</label>
                                <input className="form-input" placeholder="UF" maxLength="2" value={clienteForm.uf} onChange={e => setClienteForm({ ...clienteForm, uf: e.target.value.toUpperCase() })} required />
                            </div>
                            <div className="form-group form-group--full">
                                <label className="form-label">CEP</label>
                                <input className="form-input" placeholder="00000000" value={clienteForm.cep} onChange={e => setClienteForm({ ...clienteForm, cep: e.target.value })} required style={{ maxWidth: '250px' }} />
                            </div>
                        </div>
                        <div style={{ marginTop: '28px' }}>
                            <button type="submit" className="btn btn--primary btn--lg">✓ Cadastrar Pagador</button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB: CLIENTES CADASTRADOS */}
            {activeTab === 'clientesLista' && (
                <div className="panel">
                    <div className="panel__header">
                        <div>
                            <h2 className="panel__title">
                                <span className="panel__title-icon">👥</span> Clientes Cadastrados
                            </h2>
                            <p className="panel__description">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn--info btn--sm" onClick={carregarDados}>🔄 Atualizar</button>
                            {clientes.length > 0 && (
                                <button className="btn btn--danger btn--sm" onClick={() => setConfirmAction({
                                    title: '⚠️ Excluir Todos os Clientes',
                                    message: `Tem certeza que deseja remover TODOS os ${clientes.length} clientes? Todos os boletos associados também serão removidos. Esta ação é irreversível.`,
                                    confirmLabel: 'Excluir Todos',
                                    danger: true,
                                    onConfirm: removerTodosClientes
                                })}>
                                    🗑️ Excluir Todos
                                </button>
                            )}
                        </div>
                    </div>

                    {clientes.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>CPF/CNPJ</th>
                                    <th>E-mail</th>
                                    <th>Telefone</th>
                                    <th>Cidade/UF</th>
                                    <th>Boletos</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientes.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 500 }}>{c.nome}</td>
                                        <td><span className="cell-mono">{formatDoc(c.documento)}</span></td>
                                        <td><span className="cell-date">{c.email || '—'}</span></td>
                                        <td><span className="cell-date">{c.telefone || '—'}</span></td>
                                        <td><span className="cell-date">{c.cidade}/{c.uf}</span></td>
                                        <td>
                                            <span className="badge badge--info">{c._count?.boletos || 0}</span>
                                        </td>
                                        <td>
                                            <div className="cell-actions">
                                                <button className="btn btn--danger btn--sm" onClick={() => setConfirmAction({
                                                    title: '🗑️ Remover Cliente',
                                                    message: `Deseja remover "${c.nome}"? ${c._count?.boletos > 0 ? `Os ${c._count.boletos} boleto(s) associado(s) também serão removidos.` : ''}`,
                                                    confirmLabel: 'Remover',
                                                    danger: true,
                                                    onConfirm: () => removerCliente(c.id, c.nome)
                                                })}>
                                                    🗑️ Remover
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state__icon">👤</div>
                            <p className="empty-state__title">Nenhum cliente cadastrado</p>
                            <p className="empty-state__text">Cadastre um cliente pela aba "Cadastrar Cliente"</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: BOLETOS EMITIDOS */}
            {activeTab === 'lista' && (
                <div className="panel">
                    <div className="panel__header">
                        <div>
                            <h2 className="panel__title">
                                <span className="panel__title-icon">📋</span> Boletos Emitidos
                            </h2>
                            <p className="panel__description">{boletos.length} boleto{boletos.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button className="btn btn--info btn--sm" onClick={carregarDados}>🔄 Atualizar</button>
                    </div>

                    {boletos.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nosso Número</th>
                                    <th>Cliente</th>
                                    <th>Valor</th>
                                    <th>Vencimento</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {boletos.map(b => (
                                    <tr key={b.id}>
                                        <td><span className="cell-mono">{b.nossoNumero}</span></td>
                                        <td>{b.cliente?.nome || '—'}</td>
                                        <td>
                                            <span className="cell-value">
                                                R$ {Number(b.valorNominal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="cell-date">
                                                {new Date(b.dataVencimento).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="cell-actions">
                                                <button className="btn btn--info btn--sm" onClick={() => verBoleto(b.nossoNumero)} title="Visualizar PDF">📄 Ver</button>
                                                <button className="btn btn--success btn--sm" onClick={() => simularPagamento(b.nossoNumero)} title="Simular pagamento">💳 Pagar</button>
                                                <button className="btn btn--warning btn--sm" onClick={() => consultarBoleto(b.nossoNumero)} title="Consultar status">🔍 Status</button>
                                                <button className="btn btn--purple btn--sm" onClick={() => setAlterarTarget(b.nossoNumero)} title="Alterar vencimento">📅 Alterar</button>
                                                <button className="btn btn--danger btn--sm" onClick={() => setConfirmAction({
                                                    title: '⚠️ Cancelar Boleto',
                                                    message: `Deseja cancelar o boleto ${b.nossoNumero}?`,
                                                    confirmLabel: 'Cancelar Boleto',
                                                    danger: true,
                                                    onConfirm: () => cancelarBoleto(b.nossoNumero)
                                                })}>✗ Cancelar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state__icon">📭</div>
                            <p className="empty-state__title">Nenhum boleto pendente</p>
                            <p className="empty-state__text">Emita seu primeiro boleto pela aba "Emitir Boleto"</p>
                        </div>
                    )}
                </div>
            )}

            {/* MODALS */}
            <BoletoResultModal data={boletoResult} onClose={() => setBoletoResult(null)} />
            <AlterarModal
                nossoNumero={alterarTarget}
                onClose={() => setAlterarTarget(null)}
                onConfirm={(novaData) => alterarBoleto(alterarTarget, novaData)}
            />
            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmLabel={confirmAction.confirmLabel}
                    danger={confirmAction.danger}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={confirmAction.onConfirm}
                />
            )}
        </div>
    );
}

export default App;
