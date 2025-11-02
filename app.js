/**
 * app.js
 * Cérebro da aplicação do Painel de Clientes.
 * Gerencia o carregamento de dados (clientes.json), o armazenamento local
 * de transações (localStorage) e toda a interatividade da UI.
 */

// --- VARIÁVEIS GLOBAIS E CONSTANTES ---

// Chave para salvar as transações no localStorage do navegador
const TRANSACTIONS_KEY = 'comissionManagerTransactions_v1';

// Armazenar os dados carregados na memória
let allClients = [];
let allTransactions = [];

// --- ELEMENTOS DA DOM (Interface) ---
// Usamos 'document.addEventListener' para garantir que o DOM está carregado
let domElements;

// --- FUNÇÕES AUXILIARES (Helpers) ---

/**
 * Formata um número para o padrão monetário BRL (R$ 1.234,56).
 * @param {number} value - O valor numérico a ser formatado.
 * @returns {string} - O valor formatado como moeda.
 */
const formatCurrency = (value) => {
    if (isNaN(value)) value = 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

/**
 * Formata uma string de data (ISO ou YYYY-MM-DD) para o padrão dd/mm/aaaa.
 * @param {string} dateString - A data em formato ISO ou 'yyyy-mm-dd'.
 * @returns {string} - A data formatada.
 */
const formatDate = (dateString) => {
    // Adiciona T00:00:00 para garantir que a data seja interpretada em fuso local
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

/**
 * Retorna a data de hoje no formato 'yyyy-mm-dd' para o input[type=date].
 * @returns {string} - Data de hoje.
 */
const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Converte uma data 'yyyy-mm-dd' para um objeto Date.
 * @param {string} dateString - A data em formato 'yyyy-mm-dd'.
 * @returns {Date} - O objeto Date.
 */
const parseDate = (dateString) => {
    return new Date(dateString + 'T00:00:00');
};

// --- FUNÇÕES DE DADOS (Clientes e Transações) ---

/**
 * Carrega a lista de clientes do arquivo clientes.json.
 */
const loadClients = async () => {
    try {
        const response = await fetch('clientes.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar clientes.json: ${response.statusText}`);
        }
        const data = await response.json();
        allClients = data.clientes || [];
        console.log('Clientes carregados:', allClients);
    } catch (error) {
        console.error(error);
        // ATUALIZADO: Substituído alert() por showAlert()
        showAlert('Erro Grave', 'Falha ao carregar o cadastro de clientes. Verifique o arquivo clientes.json e a conexão.');
    }
};

/**
 * Carrega as transações do localStorage.
 */
const loadTransactions = () => {
    const storedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
    allTransactions = storedTransactions ? JSON.parse(storedTransactions) : [];
    console.log('Transações carregadas:', allTransactions);
};

/**
 * Salva o array 'allTransactions' no localStorage.
 */
const saveTransactions = () => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(allTransactions));
    console.log('Transações salvas.');
};

/**
 * Adiciona uma nova transação à lista e salva no localStorage.
 * @param {string} clientId - ID do cliente.
 * @param {'entrada' | 'saida'} type - Tipo da transação.
 * @param {number} value - Valor da transação.
 * @param {string} date - Data no formato 'yyyy-mm-dd'.
 */
const addTransaction = (clientId, type, value, date) => {
    const newTransaction = {
        id: `trans_${Date.now()}`, // ID único baseado no timestamp
        clienteId: clientId,
        tipo: type,
        valor: parseFloat(value),
        data: date, // Salva no formato 'yyyy-mm-dd'
    };
    allTransactions.push(newTransaction);
    saveTransactions();
    console.log('Transação adicionada:', newTransaction);
};

// --- FUNÇÕES DE CÁLCULO ---

/**
 * Retorna todas as transações de um cliente específico.
 * @param {string} clientId - ID do cliente.
 * @returns {Array} - Lista de transações do cliente.
 */
const getTransactionsForClient = (clientId) => {
    return allTransactions.filter(t => t.clienteId === clientId);
};

/**
 * Calcula o saldo atual de um cliente (Entradas - Saídas).
 * @param {string} clientId - ID do cliente.
 * @returns {number} - O saldo do cliente.
 */
const calculateClientBalance = (clientId) => {
    const clientTransactions = getTransactionsForClient(clientId);
    return clientTransactions.reduce((acc, trans) => {
        if (trans.tipo === 'entrada') {
            return acc + trans.valor;
        }
        if (trans.tipo === 'saida') {
            return acc - trans.valor;
        }
        return acc;
    }, 0);
};

/**
 * Calcula todas as estatísticas para o Dashboard baseado no filtro de data.
 * @param {string | null} startDate - Data de início ('yyyy-mm-dd').
 * @param {string | null} endDate - Data de fim ('yyyy-mm-dd').
 * @returns {object} - Objeto com as estatísticas.
 */
const calculateDashboardStats = (startDate, endDate) => {
    // 1. Total de Clientes (sempre o total)
    const totalClientes = allClients.length;

    // 2. Comissão Média (sempre a média de todos)
    let totalComissaoPct = 0;
    if (totalClientes > 0) {
        totalComissaoPct = allClients.reduce((acc, c) => acc + (c.comissaoPct || 0), 0);
    }
    const comissaoMediaPct = totalClientes > 0 ? totalComissaoPct / totalClientes : 0;

    // 3. Filtrar transações pelo período
    const start = startDate ? parseDate(startDate) : null;
    const end = endDate ? parseDate(endDate) : null;

    const filteredTransactions = allTransactions.filter(t => {
        const transDate = parseDate(t.data);
        if (start && transDate < start) return false;
        if (end && transDate > end) return false;
        return true;
    });

    // 4. Saldo Total e Comissão Total (baseados no filtro)
    let saldoTotal = 0;
    let comissaoTotalValor = 0;

    for (const trans of filteredTransactions) {
        if (trans.tipo === 'entrada') {
            saldoTotal += trans.valor;

            // Achar o cliente desta transação para pegar a comissão
            const client = allClients.find(c => c.id === trans.clienteId);
            if (client && client.comissaoPct) {
                comissaoTotalValor += trans.valor * (client.comissaoPct / 100);
            }
        } else if (trans.tipo === 'saida') {
            saldoTotal -= trans.valor;
        }
    }

    return {
        totalClientes,
        saldoTotal,
        comissaoTotalValor,
        comissaoMediaPct,
    };
};

// --- FUNÇÕES DE ATUALIZAÇÃO DA UI (Interface) ---

/**
 * Atualiza os 4 cards de estatísticas no topo da página.
 * @param {object} stats - Objeto retornado por `calculateDashboardStats`.
 */
const updateDashboardUI = (stats) => {
    domElements.statTotalClientes.textContent = stats.totalClientes;
    domElements.statSaldoTotal.textContent = formatCurrency(stats.saldoTotal);
    domElements.statComissaoTotal.textContent = formatCurrency(stats.comissaoTotalValor);
    domElements.statComissaoMedia.textContent = `${stats.comissaoMediaPct.toFixed(2).replace('.', ',')}%`;
};

/**
 * Cria e insere o card de um cliente nos resultados da busca.
 * @param {object} client - O objeto do cliente (de `allClients`).
 */
const renderClientCard = (client) => {
    // 1. Clonar o template
    const template = domElements.clientCardTemplate;
    const card = template.content.cloneNode(true);

    // 2. Selecionar elementos do card
    const elements = {
        nome: card.querySelector('[data-field="nome"]'),
        bandeira: card.querySelector('[data-field="bandeira"]'),
        saldo: card.querySelector('[data-field="saldo"]'),
        senha: card.querySelector('[data-field="senha"]'),
        empresa: card.querySelector('[data-field="empresa"]'),
        celular: card.querySelector('[data-field="celular"]'),
        vendedor: card.querySelector('[data-field="vendedor"]'),
        comissaoPct: card.querySelector('[data-field="comissaoPct"]'),
        enderecoCompleto: card.querySelector('[data-field="enderecoCompleto"]'),
        listaEntradas: card.querySelector('[data-list="entradas"]'),
        listaSaidas: card.querySelector('[data-list="saidas"]'),
        btnWhatsapp: card.querySelector('[data-action="whatsapp"]'),
        btnAddEntry: card.querySelector('[data-action="add-entry"]'),
        btnAddExit: card.querySelector('[data-action="add-exit"]'),
        btnToggleDetails: card.querySelector('[data-action="toggle-details"]'),
        detailsSection: card.querySelector('.details-section'),
        detailsLabel: card.querySelector('.details-label'),
        detailsIcon: card.querySelector('.details-icon'),
    };

    // 3. Preencher dados principais
    elements.nome.textContent = client.nome;
    elements.bandeira.textContent = client.bandeira;
    elements.senha.textContent = client.senha; // AVISO: Inseguro
    
    // Formatar endereço
    const addr = client.enderecoCompleto;
    elements.enderecoCompleto.textContent = `${addr.logouro}, ${addr.numero} - ${addr.bairro}, ${addr.cidade} - ${addr.estado}`;

    // 4. Preencher dados cadastrais (na seção retrátil)
    elements.empresa.textContent = client.empresa;
    elements.celular.textContent = client.celular;
    elements.vendedor.textContent = client.vendedor;
    elements.comissaoPct.textContent = `${client.comissaoPct.toFixed(1).replace('.', ',')}`;

    // 5. Calcular saldo e pegar transações
    // OTIMIZAÇÃO: O saldo agora é pré-calculado e passado no objeto 'client'
    const clientBalance = client.saldo; 
    elements.saldo.textContent = formatCurrency(clientBalance);

    const clientTransactions = getTransactionsForClient(client.id)
                                .sort((a, b) => parseDate(b.data) - parseDate(a.data)); // Mais recentes primeiro

    const entradas = clientTransactions.filter(t => t.tipo === 'entrada').slice(0, 4);
    const saidas = clientTransactions.filter(t => t.tipo === 'saida').slice(0, 4);

    // 6. Preencher listas de transações
    elements.listaEntradas.innerHTML = ''; // Limpar placeholder
    if (entradas.length > 0) {
        entradas.forEach(t => {
            const li = document.createElement('li');
            li.textContent = `${formatDate(t.data)}: ${formatCurrency(t.valor)}`;
            elements.listaEntradas.appendChild(li);
        });
    } else {
        elements.listaEntradas.innerHTML = '<li class="text-gray-400 italic">Nenhuma entrada recente.</li>';
    }

    elements.listaSaidas.innerHTML = ''; // Limpar placeholder
    if (saidas.length > 0) {
        saidas.forEach(t => {
            const li = document.createElement('li');
            li.textContent = `${formatDate(t.data)}: ${formatCurrency(t.valor)}`;
            elements.listaSaidas.appendChild(li);
        });
    } else {
        elements.listaSaidas.innerHTML = '<li class="text-gray-400 italic">Nenhuma saída recente.</li>';
    }

    // 7. Configurar Ações (Botões)
    
    // WhatsApp (usa o número do JSON)
    elements.btnWhatsapp.href = `https://wa.me/${client.celular}`;
    
    // Adicionar Entrada/Saída (guarda o ID do cliente no botão)
    elements.btnAddEntry.dataset.clientId = client.id;
    elements.btnAddExit.dataset.clientId = client.id;

    // 8. Adicionar Event Listeners do Card
    
    // Botão "Ver Mais Detalhes"
    elements.btnToggleDetails.addEventListener('click', () => {
        elements.detailsSection.classList.toggle('hidden');
        elements.detailsIcon.classList.toggle('rotate-180');
        elements.detailsLabel.textContent = elements.detailsSection.classList.contains('hidden') ? 'Ver Mais Detalhes' : 'Ocultar Detalhes';
    });

    // Botões de Transação
    elements.btnAddEntry.addEventListener('click', () => {
        showTransactionModal(client.id, 'entrada');
    });

    elements.btnAddExit.addEventListener('click', () => {
        showTransactionModal(client.id, 'saida');
    });

    // 9. Adicionar o card pronto na página
    domElements.searchResults.appendChild(card);
};

/**
 * Filtra e exibe os clientes com base nos filtros ativos (texto E saldo).
 */
const refreshSearchResults = () => {
    const query = domElements.searchInput.value;
    const balanceFilter = domElements.filterSaldo.value;
    domElements.searchResults.innerHTML = ''; // Limpar resultados anteriores
    
    // 1. Pré-calcular saldos para todos os clientes
    let results = allClients.map(client => ({
        ...client,
        saldo: calculateClientBalance(client.id)
    }));

    // 2. ATUALIZAÇÃO: Aplicar filtro de texto (se houver)
    if (query.length > 0) {
        const lowerQuery = query.toLowerCase();
        results = results.filter(client => 
            client.nome.toLowerCase().includes(lowerQuery) ||
            client.empresa.toLowerCase().includes(lowerQuery) ||
            client.id.toLowerCase().includes(lowerQuery)
        );
    }

    // 3. ATUALIZAÇÃO: Aplicar filtro de saldo (se houver) sobre os resultados já filtrados
    if (balanceFilter !== 'todos') {
        switch (balanceFilter) {
            case 'positivo':
                results = results.filter(c => c.saldo > 0);
                break;
            case '0-500':
                // Saldo positivo até 500
                results = results.filter(c => c.saldo > 0 && c.saldo <= 500);
                break;
            case '501-1000':
                results = results.filter(c => c.saldo >= 501 && c.saldo <= 1000);
                break;
            case '1001+':
                results = results.filter(c => c.saldo > 1000);
                break;
            case 'negativo':
                results = results.filter(c => c.saldo < 0);
                break;
            case 'zero':
                results = results.filter(c => c.saldo === 0);
                break;
        }
    }

    // 4. Renderizar resultados
    if (results.length > 0) {
        results.forEach(client => renderClientCard(client));
    } else {
        // Mostrar mensagem se nenhum resultado for encontrado
        domElements.searchResults.innerHTML = '<p class="text-gray-500 italic text-center">Nenhum cliente encontrado com os filtros aplicados.</p>';
    }
    
    // Re-inicializar ícones Lucide para os novos cards
    lucide.createIcons();
};

/**
 * ATUALIZAÇÃO: Manipulador para o envio do formulário de busca.
 * @param {Event} event - Evento de submit.
 */
const handleSearchSubmit = (event) => {
    event.preventDefault(); // Impedir recarregamento da página
    refreshSearchResults(); // Apenas chama a atualização
};

/**
 * Atualiza o Dashboard e os resultados da busca (se houver).
 */
const refreshAllData = () => {
    // 1. Pega datas do filtro
    const startDate = domElements.dateStart.value;
    const endDate = domElements.dateEnd.value;

    // 2. Calcula e atualiza o Dashboard
    const stats = calculateDashboardStats(startDate, endDate);
    updateDashboardUI(stats);

    // 3. Atualiza os cards da busca
    refreshSearchResults();
};

// --- FUNÇÕES DO MODAL (Pop-ups) ---

/**
 * Exibe um modal de alerta customizado.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem do alerta.
 */
const showAlert = (title, message) => {
    domElements.alertModalTitle.textContent = title;
    domElements.alertModalMessage.textContent = message;
    domElements.alertModal.classList.remove('hidden');
    domElements.btnAlertModalClose.focus();
};

/**
 * Esconde o modal de alerta.
 */
const hideAlertModal = () => {
    domElements.alertModal.classList.add('hidden');
};


/**
 * Exibe o modal para adicionar uma nova transação.
 * @param {string} clientId - ID do cliente.
 * @param {'entrada' | 'saida'} type - Tipo da transação.
 */
const showTransactionModal = (clientId, type) => {
    const isEntry = type === 'entrada';
    domElements.modalTitle.textContent = isEntry ? 'Nova Entrada' : 'Nova Saída';
    
    // Mudar cor do botão salvar
    domElements.btnModalSave.className = isEntry 
        ? 'flex-1 bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700' 
        : 'flex-1 bg-red-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-red-700';

    // Preencher dados escondidos
    domElements.modalTransactionType.value = type;
    domElements.modalClientId.value = clientId;

    // Limpar valores e focar
    domElements.modalValue.value = '';
    domElements.modalDate.value = getTodayDate();
    
    domElements.transactionModal.classList.remove('hidden');
    domElements.modalValue.focus();
};

/**
 * Esconde o modal de transação e reseta o formulário.
 */
const hideTransactionModal = () => {
    domElements.transactionModal.classList.add('hidden');
    domElements.transactionForm.reset();
};

/**
 * Manipulador para o envio do formulário de transação.
 * @param {Event} event - Evento de submit.
 */
const handleTransactionSubmit = (event) => {
    event.preventDefault(); // Impedir recarregamento da página
    
    const type = domElements.modalTransactionType.value;
    const clientId = domElements.modalClientId.value;
    const value = domElements.modalValue.value;
    const date = domElements.modalDate.value;

    if (!type || !clientId || !value || !date) {
        // ATUALIZADO: Substituído alert() por showAlert()
        showAlert('Campos Incompletos', 'Por favor, preencha todos os campos.');
        return;
    }

    addTransaction(clientId, type, value, date);
    hideTransactionModal();
    
    // Atualizar tudo na tela
    refreshAllData();
};

/**
 * Exibe o modal de Importação/Exportação.
 * @param {'import' | 'export'} mode - Modo do modal.
 * @param {string} [content=''] - Conteúdo (para exportação).
 */
const showIOModal = (mode, content = '') => {
    if (mode === 'export') {
        domElements.ioModalTitle.textContent = 'Exportar Transações (Backup)';
        domElements.ioModalDescription.textContent = 'Copie o texto abaixo e salve em um arquivo .json para fazer seu backup.';
        domElements.ioModalTextarea.value = content;
        domElements.ioModalTextarea.classList.remove('hidden');
    } else { // 'import'
        domElements.ioModalTitle.textContent = 'Importar Transações';
        domElements.ioModalDescription.textContent = 'Selecione um arquivo .json de backup para restaurar suas transações. ATENÇÃO: Isso irá substituir TODAS as transações atuais!';
        domElements.ioModalTextarea.classList.add('hidden');
    }
    domElements.ioModal.classList.remove('hidden');
};

/**
 * Esconde o modal de Importação/Exportação.
 */
const hideIOModal = () => {
    domElements.ioModal.classList.add('hidden');
};

/**
 * Prepara e exibe o modal de exportação com os dados.
 */
const handleExport = () => {
    try {
        const data = JSON.stringify(allTransactions, null, 2); // Formatação 'bonita'
        showIOModal('export', data);
    } catch (error) {
        console.error('Erro ao exportar:', error);
        // ATUALIZADO: Substituído alert() por showAlert()
        showAlert('Erro', 'Ocorreu um erro ao gerar o backup.');
    }
};

/**
 * Aciona o clique no input[type=file] escondido.
 */
const handleImportClick = () => {
    // Não vamos mostrar o modal de 'import' ainda, só o seletor de arquivo
    domElements.fileImporter.click();
};

/**
 * Manipulador para quando um arquivo é selecionado no importador.
 * @param {Event} event - Evento 'change' do input de arquivo.
 */
const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Confirmação (usando o modal, já que `confirm` é ruim)
    showIOModal('import');
    
    // Adicionar um listener temporário no botão de fechar para 'Confirmar'
    const btnClose = domElements.btnIoModalClose;
    const btnClone = btnClose.cloneNode(true); // Clonar para evitar listeners duplicados
    btnClose.parentNode.replaceChild(btnClone, btnClose);
    
    btnClone.textContent = 'Confirmar Importação (Substituir Tudo)';
    btnClone.classList.add('bg-red-600', 'hover:bg-red-700');
    
    btnClone.onclick = () => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    throw new Error('O arquivo não é um array JSON válido.');
                }
                
                // Salva os novos dados
                allTransactions = importedData;
                saveTransactions();
                
                // Recarrega a página inteira para refletir
                hideIOModal();
                // ATUALIZADO: Substituído alert() por showAlert()
                showAlert('Importação Concluída', 'Transações importadas com sucesso! A página será recarregada.');
                // Adiciona um listener ao botão OK do novo alerta para recarregar a página
                domElements.btnAlertModalClose.onclick = () => location.reload();

            } catch (error) {
                console.error('Erro ao importar:', error);
                // ATUALIZADO: Substituído alert() por showAlert()
                showAlert('Falha na Importação', `Falha na importação: ${error.message}`);
                // Restaura o botão
                btnClone.textContent = 'Fechar';
                btnClone.classList.remove('bg-red-600', 'hover:bg-red-700');
                btnClone.onclick = hideIOModal;
            }
        };
        reader.readAsText(file);
    };

    // Resetar o input para permitir selecionar o mesmo arquivo de novo
    event.target.value = null;
};

// --- INICIALIZAÇÃO DA APLICAÇÃO ---

/**
 * Função principal que inicializa a página.
 */
const initializePage = async () => {
    // Mapear todos os elementos da DOM
    domElements = {
        // Dashboard
        dateStart: document.getElementById('date-start'),
        dateEnd: document.getElementById('date-end'),
        btnFilter: document.getElementById('btn-filter'),
        statTotalClientes: document.getElementById('stat-total-clientes'),
        statSaldoTotal: document.getElementById('stat-saldo-total'),
        statComissaoTotal: document.getElementById('stat-comissao-total'),
        statComissaoMedia: document.getElementById('stat-comissao-media'),
        
        // Backup
        btnImportTransactions: document.getElementById('btn-import-transactions'),
        btnExportTransactions: document.getElementById('btn-export-transactions'),
        fileImporter: document.getElementById('file-importer'),

        // Busca
        searchForm: document.getElementById('search-form'), // ATUALIZAÇÃO
        searchInput: document.getElementById('search-input'),
        filterSaldo: document.getElementById('filter-saldo'),
        btnSearch: document.getElementById('btn-search'), // ATUALIZAÇÃO
        searchResults: document.getElementById('search-results'),
        
        // Template
        clientCardTemplate: document.getElementById('client-card-template'),
        
        // Modal Transação
        transactionModal: document.getElementById('transaction-modal'),
        transactionForm: document.getElementById('transaction-form'),
        modalTitle: document.getElementById('modal-title'),
        modalTransactionType: document.getElementById('modal-transaction-type'),
        modalClientId: document.getElementById('modal-client-id'),
        modalValue: document.getElementById('modal-value'),
        modalDate: document.getElementById('modal-date'),
        btnModalCancel: document.getElementById('btn-modal-cancel'),
        btnModalSave: document.getElementById('btn-modal-save'),

        // Modal I/O
        ioModal: document.getElementById('io-modal'),
        ioModalTitle: document.getElementById('io-modal-title'),
        ioModalDescription: document.getElementById('io-modal-description'),
        ioModalTextarea: document.getElementById('io-modal-textarea'),
        btnIoModalClose: document.getElementById('btn-io-modal-close'),

        // NOVO: Modal Alerta
        alertModal: document.getElementById('alert-modal'),
        alertModalTitle: document.getElementById('alert-modal-title'),
        alertModalMessage: document.getElementById('alert-modal-message'),
        btnAlertModalClose: document.getElementById('btn-alert-modal-close'),
    };

    // Carregar dados
    await loadClients();
    loadTransactions();

    // Configurar estado inicial da UI
    refreshAllData(); // Calcula e exibe o dashboard inicial
    // ATENÇÃO: A linha refreshSearchResults() foi removida daqui, pois refreshAllData() já a chama.

    // Configurar Event Listeners
    domElements.btnFilter.addEventListener('click', refreshAllData);
    
    // ATUALIZAÇÃO: Listener de busca agora está no 'submit' do formulário
    domElements.searchForm.addEventListener('submit', handleSearchSubmit);
    
    // Modal Transação
    domElements.transactionForm.addEventListener('submit', handleTransactionSubmit);
    domElements.btnModalCancel.addEventListener('click', hideTransactionModal);

    // Modal I/O
    domElements.btnExportTransactions.addEventListener('click', handleExport);
    domElements.btnImportTransactions.addEventListener('click', handleImportClick);
    domElements.fileImporter.addEventListener('change', handleImportFile);
    domElements.btnIoModalClose.addEventListener('click', hideIOModal);

    // NOVO: Modal Alerta
    // Configura o botão OK padrão para apenas fechar o modal
    domElements.btnAlertModalClose.addEventListener('click', hideAlertModal);
};

// Ponto de entrada: Inicia o app quando o HTML estiver pronto.
document.addEventListener('DOMContentLoaded', initializePage);
